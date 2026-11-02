"""Udyam Digital API. Run: uvicorn app.main:app --reload (from backend/)."""
from __future__ import annotations

import hashlib
import json
import logging
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import advisor, orders
from .catalogue import DATA_DIR, BusinessProfile, products, quote as build_quote, recommend_bundle
from .kyc.validators import REQUIRED_DOCS, validate_application
from .registry import lookup_gstin, lookup_udyam, mask

log = logging.getLogger("udyam")
app = FastAPI(title="Udyam Digital API", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
# Synthetic specimen documents, served so the demo UI can "upload" a sample applicant
app.mount("/samples", StaticFiles(directory=DATA_DIR / "kyc_documents"), name="samples")

EXTRACTIONS = Path(__file__).resolve().parents[2] / "analysis" / "kyc_extractions.json"
MAX_UPLOAD = 8 * 1024 * 1024
ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp", "application/pdf"}


@lru_cache
def _specimen_cache() -> dict[str, dict]:
    """sha256 of specimen image -> cached extraction (saves Gemini quota during demos)."""
    if not EXTRACTIONS.exists():
        return {}
    cached = json.loads(EXTRACTIONS.read_text())
    out = {}
    for f in (DATA_DIR / "kyc_documents").glob("*.png"):
        if f.name in cached:
            out[hashlib.sha256(f.read_bytes()).hexdigest()] = cached[f.name]
    return out


def _mask_fields(fields: dict) -> dict:
    out = dict(fields)
    for k in ("gstin", "udyam_number", "id_number", "consumer_number"):
        if out.get(k):
            out[k] = mask(out[k], 4 if k != "udyam_number" else 9, 3)
    return out


# ---------- Advisor ----------
class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str | None = None
    language: str = "en"


@app.post("/chat")
def chat(body: ChatIn):
    try:
        return advisor.chat(body.message, body.session_id, body.language)
    except Exception as e:
        log.exception("advisor failed")
        if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
            raise HTTPException(429, "Advisor is busy, please retry in a few seconds")
        raise HTTPException(502, "Advisor unavailable")


@app.get("/catalogue")
def catalogue():
    return advisor.catalogue_public()


class ProfileIn(BaseModel):
    segment: str
    city_tier: int = 1
    employees: int = 1
    sites: int = 1
    has_gstin: bool = False
    model_config = {"extra": "allow"}


@app.post("/recommend")
def recommend(body: ProfileIn):
    """Deterministic recommendation without the LLM (form fallback + tests)."""
    fields = {k: v for k, v in body.model_dump().items() if k in BusinessProfile.__dataclass_fields__}
    try:
        return recommend_bundle(BusinessProfile(**fields))
    except (ValueError, TypeError) as e:
        raise HTTPException(422, str(e))


class QuoteIn(BaseModel):
    items: list[tuple[str, int]]
    profile: ProfileIn | None = None


@app.post("/quote")
def quote(body: QuoteIn):
    p = None
    if body.profile:
        p = BusinessProfile(**{k: v for k, v in body.profile.model_dump().items() if k in BusinessProfile.__dataclass_fields__})
    return build_quote(body.items, p)


# ---------- Registry lookups (mock APIs) ----------
@app.get("/lookup/gstin/{gstin}")
def gstin_lookup(gstin: str):
    r = lookup_gstin(gstin)
    if not r:
        raise HTTPException(404, "GSTIN not found")
    return {**r, "gstin": mask(r["gstin"])}


@app.get("/lookup/udyam/{udyam}")
def udyam_lookup(udyam: str):
    r = lookup_udyam(udyam)
    if not r:
        raise HTTPException(404, "Udyam number not found")
    return {**r, "udyam_number": mask(r["udyam_number"], 9, 3)}


# ---------- Consent + KYC ----------
@app.get("/consent/notice")
def consent_notice():
    return {"purposes": orders.CONSENT_PURPOSES, "retention": orders.RETENTION,
            "data_collected": ["GSTIN", "Udyam number", "Business name and address", "Authorised signatory name and ID validity",
                               "Address proof date"],
            "not_collected": ["Aadhaar number", "Bank details", "Personal photos"],
            "grievance_contact": "privacy@accelbusiness.example"}


class ConsentIn(BaseModel):
    purposes: list[str]


@app.post("/consent")
def consent(body: ConsentIn):
    try:
        c = orders.record_consent(body.purposes)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return {**c, "kyc_id": orders.create_kyc(c["consent_id"])}


@app.delete("/consent/{consent_id}")
def withdraw(consent_id: str):
    if not orders.withdraw_consent(consent_id):
        raise HTTPException(404, "Consent not found or already withdrawn")
    return {"withdrawn": True, "kyc_data_erased": True}


def _kyc_or_404(kyc_id: str) -> dict:
    k = orders.get_kyc(kyc_id)
    if not k:
        raise HTTPException(404, "KYC application not found")
    if not orders.consent_valid(k["consent_id"]):
        raise HTTPException(403, "Consent missing or withdrawn")
    return k


@app.post("/kyc/{kyc_id}/document")
async def upload_document(kyc_id: str, file: UploadFile = File(...)):
    _kyc_or_404(kyc_id)
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(415, "Upload a PNG, JPEG, WEBP or PDF")
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "File too large (max 8 MB)")
    digest = hashlib.sha256(data).hexdigest()
    res = _specimen_cache().get(digest)
    source = "cache"
    if res is None:
        from .kyc.extract import extract_document
        try:
            res = extract_document(data, file.content_type)
            source = "gemini"
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                raise HTTPException(429, "Document reader is busy, retry in a few seconds")
            raise HTTPException(502, "Could not read the document")
    del data  # image is never stored
    doc_type = res.get("doc_type", "other")
    if doc_type not in REQUIRED_DOCS:
        raise HTTPException(422, "This doesn't look like a GST certificate, Udyam certificate, signatory ID or address proof")
    orders.save_kyc_doc(kyc_id, doc_type, res["fields"], res.get("quality_issues", []))
    log.info("kyc %s doc %s extracted via %s", kyc_id, doc_type, source)
    k = orders.get_kyc(kyc_id)
    return {"doc_type": doc_type, "fields": _mask_fields(res["fields"]), "quality_issues": res.get("quality_issues", []),
            "uploaded": sorted(k["docs"]), "missing": [d for d in REQUIRED_DOCS if d not in k["docs"]]}


@app.post("/kyc/{kyc_id}/verify")
def verify(kyc_id: str):
    k = _kyc_or_404(kyc_id)
    result = validate_application(k["docs"], quality=k["quality"])
    orders.save_kyc_result(kyc_id, result)
    return result


# ---------- Orders / tracker ----------
class OrderIn(BaseModel):
    items: list[tuple[str, int]]
    kyc_id: str
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    language: str = "en"


@app.post("/orders")
def create_order(body: OrderIn):
    k = _kyc_or_404(body.kyc_id)
    res = k["result"]
    if not res or res["verdict"] == "rejected":
        raise HTTPException(409, "KYC must pass before the order can be placed")
    q = build_quote(body.items)
    if not q["valid"]:
        raise HTTPException(422, "; ".join(q["errors"]))
    needs_gst = [l["name"] for l in q["lines"] if products()[l["product_id"]].requires_gstin]
    if needs_gst and not res["gstin_active"]:
        raise HTTPException(409, f"An active GSTIN is required for: {', '.join(needs_gst)}")
    gstin = k["docs"].get("gst_certificate", {}).get("gstin")
    o = orders.create_order(res["business_name"] or "Business", mask(gstin), mask(body.phone, 2, 2),
                            body.language, q, kyc_id=body.kyc_id if res["verdict"] == "approved" else None)
    return o


@app.get("/orders/{order_id}")
def track(order_id: str):
    o = orders.get_order(order_id)
    if not o:
        raise HTTPException(404, "Order not found")
    return o


@app.post("/orders/{order_id}/advance")
def advance(order_id: str):
    o = orders.advance_order(order_id)
    if not o:
        raise HTTPException(404, "Order not found")
    return o


@app.get("/health")
def health():
    return {"ok": True}
