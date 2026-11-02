"""End-to-end API flow without the LLM (specimen documents hit the extraction cache)."""
import os

import pytest

os.environ["UDYAM_DB"] = "/tmp/udyam_test.db"  # set before app import
if os.path.exists(os.environ["UDYAM_DB"]):
    os.remove(os.environ["UDYAM_DB"])

from fastapi.testclient import TestClient  # noqa: E402

from app.catalogue import DATA_DIR  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
DOCS = DATA_DIR / "kyc_documents"
TYPES = ("gst_certificate", "udyam_certificate", "signatory_id", "address_proof")


def _apply(applicant: str) -> tuple[str, dict]:
    r = client.post("/consent", json={"purposes": ["kyc_verification", "service_activation"]})
    assert r.status_code == 200
    kyc_id = r.json()["kyc_id"]
    for t in TYPES:
        f = DOCS / f"{applicant}_{t}.png"
        if f.exists():
            r = client.post(f"/kyc/{kyc_id}/document", files={"file": (f.name, f.read_bytes(), "image/png")})
            assert r.status_code == 200, r.text
            assert "*" in (r.json()["fields"].get("gstin") or "*")  # masked
    return kyc_id, client.post(f"/kyc/{kyc_id}/verify").json()


def test_consent_requires_mandatory_purposes():
    assert client.post("/consent", json={"purposes": ["marketing"]}).status_code == 422


def test_happy_path_order_and_tracker():
    kyc_id, res = _apply("K12")
    assert res["verdict"] == "approved"
    o = client.post("/orders", json={"items": [["P01", 1], ["P07", 2], ["P19", 1]], "kyc_id": kyc_id,
                                     "phone": "9876543210"})
    assert o.status_code == 200, o.text
    oid = o.json()["order_id"]
    t = client.get(f"/orders/{oid}").json()
    assert t["stage"] == "kyc_verified" and t["phone"] == "98******10"
    for _ in range(3):
        t = client.post(f"/orders/{oid}/advance").json()
    assert t["stage"] == "activated"
    assert all(s["status"] == "done" for s in t["timeline"])


def test_rejected_kyc_blocks_order():
    kyc_id, res = _apply("K11")
    assert res["verdict"] == "rejected"
    r = client.post("/orders", json={"items": [["P01", 1]], "kyc_id": kyc_id, "phone": "9876543210"})
    assert r.status_code == 409


def test_missing_doc_detected():
    _, res = _apply("K05")
    assert any(f["code"] == "DOC_MISSING" for f in res["findings"])


def test_withdraw_consent_erases_kyc():
    r = client.post("/consent", json={"purposes": ["kyc_verification", "service_activation"]}).json()
    assert client.delete(f"/consent/{r['consent_id']}").status_code == 200
    assert client.post(f"/kyc/{r['kyc_id']}/verify").status_code == 404


def test_invalid_dependency_quote():
    assert client.post("/quote", json={"items": [["P09", 1]]}).json()["valid"] is False


def test_lookup_masks():
    from app.registry import gstin_registry
    g = next(iter(gstin_registry()))
    assert "*" in client.get(f"/lookup/gstin/{g}").json()["gstin"]
    assert client.get("/lookup/gstin/XX").status_code == 404


@pytest.mark.parametrize("profile,must,must_not", [
    ({"segment": "micro", "city_tier": 2, "employees": 3, "sites": 1, "has_gstin": False, "wants_whatsapp": True},
     {"P01", "P07"}, {"P15"}),
    ({"segment": "multi", "city_tier": 1, "employees": 40, "sites": 5, "has_gstin": True}, {"P09", "P10"}, set()),
    ({"segment": "multi", "city_tier": 1, "employees": 12, "sites": 2, "has_gstin": True}, {"P09"}, {"P10"}),
    ({"segment": "prof", "city_tier": 2, "employees": 8, "sites": 1, "has_gstin": True, "high_bandwidth": True}, {"P02"}, {"P03"}),
    ({"segment": "mfg", "city_tier": 1, "employees": 30, "sites": 1, "has_gstin": True, "machines": 4}, {"P05", "P24"}, set()),
    ({"segment": "mfg", "city_tier": 2, "employees": 8, "sites": 1, "has_gstin": False, "machines": 4}, set(), {"P05", "P24"}),
    ({"segment": "micro", "city_tier": 1, "employees": 2, "sites": 1, "has_gstin": False, "fibre_available": False,
      "cameras": 2}, {"P04", "P23"}, {"P01"}),
])
def test_recommend_scenarios(profile, must, must_not):
    r = client.post("/recommend", json=profile).json()
    ids = {i["product_id"] for i in r["items"]}
    assert must <= ids, (ids, r["excluded"])
    assert not (must_not & ids)
    assert r["quote"]["valid"]
