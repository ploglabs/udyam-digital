import csv

import pytest

from app.catalogue import DATA_DIR, BusinessProfile, eligibility_issues, products, quote, recommend_bundle
from app.kyc.validators import check_gstin_format, gstin_checksum, validate_application
from app.registry import gstin_registry, mask


def test_all_registry_gstins_pass_checksum():
    assert all(check_gstin_format(g)[0].severity == "pass" for g in gstin_registry())


def test_tampered_gstin_fails_checksum():
    g = next(iter(gstin_registry()))
    wrong = g[:14] + ("A" if g[14] != "A" else "B")
    assert check_gstin_format(wrong)[0].code == "GSTIN_CHECKSUM"


@pytest.mark.parametrize("pid,profile,expect", [
    ("P10", BusinessProfile("multi", 1, 20, 2, True), "sites"),
    ("P03", BusinessProfile("prof", 2, 10, 1, True), "tier"),
    ("P15", BusinessProfile("micro", 1, 2, 1, False), "GSTIN"),
    ("P05", BusinessProfile("mfg", 1, 5, 1, True), "employees"),
])
def test_eligibility(pid, profile, expect):
    assert any(expect in i for i in eligibility_issues(pid, profile))


def test_dependency_enforced_in_quote():
    q = quote([("P09", 1), ("P07", 1)])
    assert not q["valid"]
    assert quote([("P09", 1), ("P01", 1)])["valid"]


def _profile_from_lead(r):
    seg = {"Micro retail & services": "micro", "Professional offices": "prof",
           "Small multi-site businesses": "multi", "Small manufacturers": "mfg"}[r["segment"]]
    g = gstin_registry().get(r["gstin"])
    return BusinessProfile(segment=seg, city_tier=int(r["city_tier"]), employees=int(r["employee_count"]),
                           sites=int(r["num_sites"]), has_gstin=bool(g and g["status"] == "Active"),
                           fibre_available=r["current_internet"] != "None", wants_whatsapp=True,
                           wants_failover=True, wants_telephony=True, cameras=2, wants_firewall=True)


def test_every_lead_gets_valid_eligible_bundle():
    with open(DATA_DIR / "smb_leads.csv") as f:
        for r in csv.DictReader(f):
            p = _profile_from_lead(r)
            res = recommend_bundle(p)
            assert res["items"], r["lead_id"]
            assert res["quote"]["valid"], (r["lead_id"], res["quote"]["errors"])


def test_mask():
    assert mask("32TTNXB7384T1ZW") == "32TT********1ZW"


def test_kyc_old_address_and_missing_doc():
    g, reg = next((g, r) for g, r in gstin_registry().items() if r["status"] == "Active")
    out = validate_application({
        "gst_certificate": {"gstin": g, "legal_name": reg["legal_name"], "trade_name": reg["trade_name"]},
        "address_proof": {"billed_to": reg["trade_name"], "bill_date": "2026-01-01"},
    })
    codes = {x["code"] for x in out["findings"]}
    assert out["verdict"] == "rejected"
    assert {"ADDRESS_PROOF_OLD", "DOC_MISSING", "GSTIN_ACTIVE"} <= codes


def test_kyc_cancelled_gstin_rejected():
    g, reg = next((g, r) for g, r in gstin_registry().items() if r["status"] != "Active")
    out = validate_application({"gst_certificate": {"gstin": g, "legal_name": reg["legal_name"]}})
    assert any(x["code"] == "GSTIN_INACTIVE" for x in out["findings"])
