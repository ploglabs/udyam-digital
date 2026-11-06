"""Lead tracking through the journey, callback, back-office views and the propensity model."""
import os

os.environ.setdefault("UDYAM_DB", "/tmp/udyam_test.db")

from fastapi.testclient import TestClient  # noqa: E402

from app import propensity  # noqa: E402
from app.catalogue import DATA_DIR  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
KEY = {"X-Backoffice-Key": "demo-partner"}
DOCS = DATA_DIR / "kyc_documents"


def _lead(lead_id):
    return next((l for l in client.get("/backoffice/leads", headers=KEY).json() if l["lead_id"] == lead_id), None)


def _upload(kyc_id, applicant):
    for t in ("gst_certificate", "udyam_certificate", "signatory_id", "address_proof"):
        f = DOCS / f"{applicant}_{t}.png"
        if f.exists():
            client.post(f"/kyc/{kyc_id}/document", files={"file": (f.name, f.read_bytes(), "image/png")})


def test_backoffice_needs_key():
    assert client.get("/backoffice/leads").status_code == 401
    assert client.get("/backoffice/winback", headers={"X-Backoffice-Key": "wrong"}).status_code == 401


def test_lead_follows_journey_and_leaves_list_when_ordered():
    r = client.post("/recommend", json={"segment": "prof", "city_tier": 1, "employees": 6, "sites": 1, "has_gstin": True}).json()
    sid = r["session_id"]
    lead = _lead(sid)
    assert lead["status"] == "quoted" and lead["channel"] == "form" and lead["callback_phone"] is None
    assert "name" not in lead["profile"]  # profile only, no identity

    kyc_id = client.post("/consent", json={"purposes": ["kyc_verification", "service_activation"], "session_id": sid}).json()["kyc_id"]
    assert _lead(sid)["status"] == "kyc_started"
    _upload(kyc_id, "K11")  # old address proof -> rejected
    client.post(f"/kyc/{kyc_id}/verify")
    lead = _lead(sid)
    assert lead["status"] == "kyc_rejected" and "days old" in lead["note"]

    client.post("/callback", json={"phone": "9876543210", "kyc_id": kyc_id})
    lead = client.get("/backoffice/leads", headers=KEY).json()[0]  # callbacks sort first
    assert lead["lead_id"] == sid and lead["callback_phone"] == "98******10"

    # second attempt with good documents, then order: lead is closed and drops off the list
    kyc2 = client.post("/consent", json={"purposes": ["kyc_verification", "service_activation"], "session_id": sid}).json()["kyc_id"]
    _upload(kyc2, "K12")
    assert client.post(f"/kyc/{kyc2}/verify").json()["verdict"] == "approved"
    assert _lead(sid)["status"] == "kyc_approved"
    o = client.post("/orders", json={"items": [["P01", 1]], "kyc_id": kyc2, "phone": "9876543210"})
    assert o.status_code == 200, o.text
    assert _lead(sid) is None


def test_callback_without_journey():
    lid = client.post("/callback", json={"phone": "9123456789", "language": "hi"}).json()["lead_id"]
    assert _lead(lid)["next_action"].startswith("Owner asked for a call")
    assert client.post("/callback", json={"phone": "12345"}).status_code == 422


def test_propensity_model_is_useful_and_leak_free():
    m = propensity.model()
    assert m.auc_holdout > 0.65 and m.lift_top_decile > 1.5
    hot = propensity.score_profile({"segment": "prof", "city_tier": 1, "employees": 10, "sites": 1, "has_gstin": True})
    cold = propensity.score_profile({"segment": "micro", "city_tier": 2, "employees": 1, "sites": 1, "has_gstin": False})
    assert hot > 3 * cold


def test_winback_ranked_and_filtered():
    rows = client.get("/backoffice/winback", params={"digital_fix_only": True, "limit": 20}, headers=KEY).json()
    assert len(rows) == 20 and all(r["digital_fix"] for r in rows)
    assert [r["score"] for r in rows] == sorted((r["score"] for r in rows), reverse=True)
    assert not any("contact_name" in r or "business_name" in r for r in rows)


def test_metrics():
    m = client.get("/backoffice/metrics", headers=KEY).json()
    assert len(m["kpis"]) == 5 and m["model"]["drivers"]
