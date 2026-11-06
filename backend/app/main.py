"""Udyam Digital API. Run: uvicorn app.main:app --reload (from backend/)."""
from __future__ import annotations

import hashlib
import json
import logging
import os
import uuid
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import advisor, orders, propensity
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
        res = advisor.chat(body.message, body.session_id, body.language)
    except Exception as e:
        log.exception("advisor failed")
        if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
            raise HTTPException(429, "Advisor is busy, please retry in a few seconds")
        raise HTTPException(502, "Advisor unavailable")
    if res.get("bundle"):
        _track_lead(res["session_id"], "chat", body.language, res["bundle"])
    return res


def _track_lead(lead_id: str, channel: str, language: str, bundle: dict) -> None:
    try:
        orders.upsert_lead(lead_id, channel, language, bundle.get("profile", {}),
                           bundle.get("quote", {}).get("monthly_total_incl_gst"))
    except Exception:  # lead tracking must never break the owner's journey
        log.exception("lead tracking failed")


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
        res = recommend_bundle(BusinessProfile(**fields))
    except (ValueError, TypeError) as e:
        raise HTTPException(422, str(e))
    extra = body.model_extra or {}
    sid = str(extra.get("session_id") or "") or "F" + uuid.uuid4().hex[:11]
    _track_lead(sid, "form", str(extra.get("language") or "en"), res)
    return {**res, "session_id": sid}


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
    session_id: str | None = None


@app.post("/consent")
def consent(body: ConsentIn):
    try:
        c = orders.record_consent(body.purposes)
    except ValueError as e:
        raise HTTPException(422, str(e))
    kyc_id = orders.create_kyc(c["consent_id"])
    if body.session_id:
        orders.advance_lead(lead_id=body.session_id, status="kyc_started", new_kyc_id=kyc_id)
    return {**c, "kyc_id": kyc_id}


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
    status = {"approved": "kyc_approved", "manual_review": "kyc_review", "rejected": "kyc_rejected"}[result["verdict"]]
    orders.advance_lead(kyc_id=kyc_id, status=status, note=None if result["verdict"] == "approved" else result["summary"][0])
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
    orders.advance_lead(kyc_id=body.kyc_id, status="ordered", order_id=o["order_id"])
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


# ---------- Callback + back office (sales / partner view) ----------
class CallbackIn(BaseModel):
    phone: str = Field(pattern=r"^[6-9]\d{9}$")
    language: str = "en"
    session_id: str | None = None
    kyc_id: str | None = None
    reason: str = Field(default="Owner asked for a callback", max_length=200)


@app.post("/callback")
def callback(body: CallbackIn):
    lid = orders.request_callback(body.phone, body.language, body.session_id, body.kyc_id, body.reason)
    return {"lead_id": lid, "message": "A local NorthStar partner will call you within 2 working hours."}


BACKOFFICE_KEY = os.environ.get("BACKOFFICE_KEY", "demo-partner")
NEXT_ACTION = {
    "quoted": "Got a quote but didn't start KYC: call to answer questions on the bundle",
    "kyc_started": "Started KYC but didn't finish: help upload the missing documents",
    "kyc_approved": "KYC passed but no order placed: call to close",
    "kyc_review": "KYC needs a manual look: review the flagged item",
    "kyc_rejected": "KYC failed: call to explain the problem and help fix it",
}


def _backoffice(key: str | None):
    if key != BACKOFFICE_KEY:
        raise HTTPException(401, "Back-office key required")


@app.get("/backoffice/leads")
def backoffice_leads(x_backoffice_key: str | None = Header(default=None)):
    """Live journeys the digital flow did not close, ranked: callbacks first, then propensity."""
    _backoffice(x_backoffice_key)
    out = []
    for l in orders.list_leads():
        if l["status"] == "ordered":
            continue
        p = propensity.score_profile(l["profile"]) if l["profile"] else propensity.model().base_rate
        out.append({**l, "callback_phone": mask(l["callback_phone"], 2, 2) if l["callback_phone"] else None,
                    "score": round(p, 3), "band": propensity.band(p),
                    "next_action": "Owner asked for a call: call back within 2 hours" if l["callback_phone"]
                    else NEXT_ACTION.get(l["status"], "Review")})
    out.sort(key=lambda d: (d["callback_phone"] is None, -d["score"]))
    return out


@app.get("/backoffice/winback")
def backoffice_winback(segment: str | None = None, source: str | None = None, digital_fix_only: bool = False,
                       limit: int = 50, x_backoffice_key: str | None = Header(default=None)):
    """Dropped leads from last quarter, ranked by propensity, with a suggested next action."""
    _backoffice(x_backoffice_key)
    return propensity.winback(segment, source, digital_fix_only, min(max(limit, 1), 500))


@app.get("/backoffice/metrics")
def backoffice_metrics(x_backoffice_key: str | None = Header(default=None)):
    """Success metrics: last-quarter baseline (smb_leads.csv), targets, and live counts from this prototype."""
    _backoffice(x_backoffice_key)
    m = propensity.model()
    leads = orders.list_leads()
    by_status = {s: sum(1 for l in leads if l["status"] == s) for s in orders.LEAD_STATUSES}
    return {
        "kpis": [
            {"name": "Lead-to-activation conversion", "baseline": "7.4%", "target": "15%"},
            {"name": "Days from lead to activation", "baseline": "17.6", "target": "≤ 7"},
            {"name": "Acquisition cost per activation", "baseline": "₹15,000", "target": "≤ ₹6,000"},
            {"name": "Status-chase calls per customer", "baseline": "3", "target": "≤ 0.5"},
            {"name": "6-month churn", "baseline": "≈ 15%", "target": "≤ 10%"},
        ],
        "live": {"advisor_leads": len(leads), "callbacks": sum(1 for l in leads if l["callback_phone"]),
                 **by_status, **orders.order_stats()},
        "model": {"base_rate": round(m.base_rate, 4), "auc_holdout": round(m.auc_holdout, 3),
                  "lift_top_decile": round(m.lift_top_decile, 2), "drivers": propensity.explain()[:8]},
    }


@app.get("/health")
def health():
    return {"ok": True}
