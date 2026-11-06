"""Orders, consent and KYC records in SQLite. Stores masked identifiers only; document images are never persisted."""
from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path(os.environ.get("UDYAM_DB", Path(__file__).resolve().parents[1] / "udyam.db"))

STAGES = [
    ("placed", "Order placed", "We have your order and quote."),
    ("kyc_verified", "KYC verified", "Your documents were checked automatically."),
    ("feasibility", "Site feasibility confirmed", "Our team confirmed fibre/5G coverage at your address."),
    ("install_scheduled", "Installation scheduled", "An engineer visit is booked; you'll get an SMS/WhatsApp the day before."),
    ("activated", "Activated", "All services are live. One bill, one support number."),
]
CONSENT_PURPOSES = {
    "kyc_verification": "Verify business identity with GST/Udyam registries and documents (required)",
    "service_activation": "Use your address and contact to install and activate services (required)",
    "marketing": "Send offers on WhatsApp/SMS (optional)",
}
RETENTION = "Document images are deleted right after verification. Extracted KYC fields are kept for the contract term + 8 years as required by DoT/telecom KYC rules."


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    c.executescript("""
    CREATE TABLE IF NOT EXISTS consents(id TEXT PRIMARY KEY, created TEXT, purposes TEXT, withdrawn TEXT);
    CREATE TABLE IF NOT EXISTS kyc(id TEXT PRIMARY KEY, consent_id TEXT, created TEXT, docs TEXT, quality TEXT, result TEXT);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, created TEXT, business_name TEXT, gstin_masked TEXT,
        phone_masked TEXT, language TEXT, items TEXT, quote TEXT, kyc_id TEXT, stage INTEGER, history TEXT, eta TEXT);
    CREATE TABLE IF NOT EXISTS leads(id TEXT PRIMARY KEY, created TEXT, updated TEXT, channel TEXT, language TEXT,
        profile TEXT, monthly_incl_gst REAL, status TEXT, kyc_id TEXT, order_id TEXT, note TEXT,
        callback_phone TEXT, callback_at TEXT);
    """)
    return c


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def record_consent(purposes: list[str]) -> dict:
    missing = {"kyc_verification", "service_activation"} - set(purposes)
    if missing:
        raise ValueError(f"Required consent missing: {', '.join(sorted(missing))}")
    unknown = set(purposes) - CONSENT_PURPOSES.keys()
    if unknown:
        raise ValueError(f"Unknown purposes: {unknown}")
    cid = "C" + uuid.uuid4().hex[:10].upper()
    with _conn() as c:
        c.execute("INSERT INTO consents VALUES(?,?,?,NULL)", (cid, _now(), json.dumps(sorted(purposes))))
    return {"consent_id": cid, "purposes": sorted(purposes), "retention": RETENTION}


def withdraw_consent(cid: str) -> bool:
    with _conn() as c:
        n = c.execute("UPDATE consents SET withdrawn=? WHERE id=? AND withdrawn IS NULL", (_now(), cid)).rowcount
        c.execute("DELETE FROM kyc WHERE consent_id=?", (cid,))  # erase KYC data on withdrawal
    return bool(n)


def consent_valid(cid: str) -> bool:
    with _conn() as c:
        r = c.execute("SELECT withdrawn FROM consents WHERE id=?", (cid,)).fetchone()
    return bool(r) and r["withdrawn"] is None


def create_kyc(consent_id: str) -> str:
    kid = "K" + uuid.uuid4().hex[:10].upper()
    with _conn() as c:
        c.execute("INSERT INTO kyc VALUES(?,?,?,?,?,NULL)", (kid, consent_id, _now(), "{}", "{}"))
    return kid


def get_kyc(kid: str) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM kyc WHERE id=?", (kid,)).fetchone()
    if not r:
        return None
    return {"id": r["id"], "consent_id": r["consent_id"], "docs": json.loads(r["docs"]),
            "quality": json.loads(r["quality"]), "result": json.loads(r["result"]) if r["result"] else None}


def save_kyc_doc(kid: str, doc_type: str, fields: dict, quality: list[str]) -> None:
    k = get_kyc(kid)
    k["docs"][doc_type] = fields
    k["quality"][doc_type] = quality
    with _conn() as c:
        c.execute("UPDATE kyc SET docs=?, quality=? WHERE id=?", (json.dumps(k["docs"]), json.dumps(k["quality"]), kid))


def save_kyc_result(kid: str, result: dict) -> None:
    with _conn() as c:
        c.execute("UPDATE kyc SET result=? WHERE id=?", (json.dumps(result), kid))


def create_order(business_name: str, gstin_masked: str, phone_masked: str, language: str,
                 quote: dict, kyc_id: str | None) -> dict:
    oid = "UD" + uuid.uuid4().hex[:6].upper()
    created = date.today()
    install = quote.get("expected_activation_days") or 5
    eta = (created + timedelta(days=install + 1)).isoformat()
    stage = 1 if kyc_id else 0
    history = [{"stage": STAGES[0][0], "at": _now()}] + ([{"stage": STAGES[1][0], "at": _now()}] if kyc_id else [])
    with _conn() as c:
        c.execute("INSERT INTO orders VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                  (oid, _now(), business_name, gstin_masked, phone_masked, language,
                   json.dumps(quote.get("lines", [])), json.dumps({k: v for k, v in quote.items() if k != "lines"}),
                   kyc_id, stage, json.dumps(history), eta))
    return get_order(oid)


def get_order(oid: str) -> dict | None:
    with _conn() as c:
        r = c.execute("SELECT * FROM orders WHERE id=?", (oid.upper(),)).fetchone()
    if not r:
        return None
    hist = {h["stage"]: h["at"] for h in json.loads(r["history"])}
    created = datetime.fromisoformat(r["created"]).date()
    eta = date.fromisoformat(r["eta"])
    span = max((eta - created).days, 4)
    planned = [created, created, created + timedelta(days=1), created + timedelta(days=2), eta]
    timeline = []
    for i, (key, label, desc) in enumerate(STAGES):
        status = "done" if i <= r["stage"] else ("current" if i == r["stage"] + 1 else "upcoming")
        timeline.append({"key": key, "label": label, "description": desc, "status": status,
                         "completed_at": hist.get(key), "expected_by": planned[i].isoformat()})
    return {"order_id": r["id"], "created": r["created"], "business_name": r["business_name"],
            "gstin": r["gstin_masked"], "phone": r["phone_masked"], "language": r["language"],
            "items": json.loads(r["items"]), "quote": json.loads(r["quote"]), "stage": STAGES[r["stage"]][0],
            "eta": r["eta"], "days_total": span, "timeline": timeline}


def advance_order(oid: str) -> dict | None:
    """Demo/back-office: move the order to the next stage."""
    o = get_order(oid)
    if not o:
        return None
    with _conn() as c:
        r = c.execute("SELECT stage, history FROM orders WHERE id=?", (o["order_id"],)).fetchone()
        if r["stage"] < len(STAGES) - 1:
            hist = json.loads(r["history"]) + [{"stage": STAGES[r["stage"] + 1][0], "at": _now()}]
            c.execute("UPDATE orders SET stage=?, history=? WHERE id=?", (r["stage"] + 1, json.dumps(hist), o["order_id"]))
    return get_order(oid)


# ---------- Leads (back-office view of journeys the digital flow did not close) ----------
# Status: quoted -> kyc_started -> kyc_approved | kyc_review | kyc_rejected -> ordered
LEAD_STATUSES = ["quoted", "kyc_started", "kyc_approved", "kyc_review", "kyc_rejected", "ordered"]


def upsert_lead(lead_id: str, channel: str, language: str, profile: dict, monthly_incl_gst: float | None) -> None:
    """Called when the advisor (chat or form) produces a bundle. Stores the business profile only, no name or contact."""
    keep = {k: profile.get(k) for k in ("segment", "city_tier", "employees", "sites", "has_gstin")}
    with _conn() as c:
        c.execute("""INSERT INTO leads(id, created, updated, channel, language, profile, monthly_incl_gst, status)
                     VALUES(?,?,?,?,?,?,?, 'quoted')
                     ON CONFLICT(id) DO UPDATE SET updated=excluded.updated, profile=excluded.profile,
                       monthly_incl_gst=excluded.monthly_incl_gst, language=excluded.language""",
                  (lead_id, _now(), _now(), channel, language, json.dumps(keep), monthly_incl_gst))


def advance_lead(*, lead_id: str | None = None, kyc_id: str | None = None, status: str,
                 note: str | None = None, order_id: str | None = None, new_kyc_id: str | None = None) -> None:
    with _conn() as c:
        r = (c.execute("SELECT id, status FROM leads WHERE id=?", (lead_id,)).fetchone() if lead_id
             else c.execute("SELECT id, status FROM leads WHERE kyc_id=?", (kyc_id,)).fetchone())
        if not r:
            return
        # a re-verify after a rejection may move kyc_rejected -> kyc_review/ordered; never move backwards past ordered
        if r["status"] == "ordered":
            return
        c.execute("UPDATE leads SET status=?, updated=?, note=COALESCE(?, note), order_id=COALESCE(?, order_id),"
                  " kyc_id=COALESCE(?, kyc_id) WHERE id=?", (status, _now(), note, order_id, new_kyc_id, r["id"]))


def request_callback(phone: str, language: str, lead_id: str | None, kyc_id: str | None, reason: str) -> str:
    """Owner asked for a human. The phone number is stored only for this purpose and shown masked in the back office."""
    with _conn() as c:
        r = None
        if lead_id:
            r = c.execute("SELECT id FROM leads WHERE id=?", (lead_id,)).fetchone()
        if not r and kyc_id:
            r = c.execute("SELECT id FROM leads WHERE kyc_id=?", (kyc_id,)).fetchone()
        lid = r["id"] if r else (lead_id or "CB" + uuid.uuid4().hex[:10])
        if not r:
            c.execute("""INSERT INTO leads(id, created, updated, channel, language, profile, status, kyc_id)
                         VALUES(?,?,?,'callback',?,'{}','quoted',?)""", (lid, _now(), _now(), language, kyc_id))
        c.execute("UPDATE leads SET callback_phone=?, callback_at=?, updated=?, note=COALESCE(note, ?) WHERE id=?",
                  (phone, _now(), _now(), reason, lid))
    return lid


def list_leads() -> list[dict]:
    with _conn() as c:
        rows = c.execute("SELECT * FROM leads ORDER BY updated DESC").fetchall()
    return [{"lead_id": r["id"], "created": r["created"], "updated": r["updated"], "channel": r["channel"],
             "language": r["language"], "profile": json.loads(r["profile"] or "{}"),
             "monthly_incl_gst": r["monthly_incl_gst"], "status": r["status"], "kyc_id": r["kyc_id"],
             "order_id": r["order_id"], "note": r["note"], "callback_phone": r["callback_phone"],
             "callback_at": r["callback_at"]} for r in rows]


def order_stats() -> dict:
    with _conn() as c:
        rows = c.execute("SELECT stage FROM orders").fetchall()
    done = sum(1 for r in rows if r["stage"] == len(STAGES) - 1)
    return {"orders": len(rows), "activated": done, "in_progress": len(rows) - done}
