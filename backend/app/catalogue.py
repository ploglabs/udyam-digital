"""Product catalogue + deterministic rules engine (eligibility, dependencies, bundle, quote).

The LLM never invents products or prices: it collects a BusinessProfile and calls
recommend_bundle()/quote(), then explains the result in the owner's language.
"""
from __future__ import annotations

import csv
from dataclasses import dataclass, field, asdict
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data"

SEGMENTS = {"micro", "prof", "multi", "mfg"}
SEGMENT_LABELS = {
    "micro": "Micro retail & services",
    "prof": "Professional offices",
    "multi": "Small multi-site businesses",
    "mfg": "Small manufacturers",
}
BASE_CONNECTIVITY = {"P01", "P02", "P03", "P04", "P05", "P06"}


@dataclass(frozen=True)
class Product:
    id: str
    category: str
    name: str
    description: str
    unit: str
    price_min: int
    price_max: int
    setup: int
    min_contract: int
    tiers: frozenset[int]
    min_employees: int
    min_sites: int
    requires_gstin: bool
    requires_one_of: frozenset[str]
    install_days: int
    segments: frozenset[str]


@lru_cache
def products() -> dict[str, Product]:
    out = {}
    with open(DATA_DIR / "product_catalogue.csv", newline="") as f:
        for r in csv.DictReader(f):
            out[r["product_id"]] = Product(
                id=r["product_id"],
                category=r["category"],
                name=r["product_name"],
                description=r["description"],
                unit=r["unit"],
                price_min=int(r["price_min_inr_per_month"]),
                price_max=int(r["price_max_inr_per_month"]),
                setup=int(r["one_time_setup_inr"]),
                min_contract=int(r["min_contract_months"]),
                tiers=frozenset(int(t) for t in r["available_city_tiers"].split(";")),
                min_employees=int(r["min_employees"]),
                min_sites=int(r["min_sites"]),
                requires_gstin=r["requires_gstin"] == "Y",
                requires_one_of=frozenset(x for x in r["requires_one_of"].split("|") if x),
                install_days=int(r["typical_install_days"]),
                segments=frozenset(r["target_segments"].split(";")),
            )
    return out


@dataclass
class BusinessProfile:
    segment: str = "micro"              # micro | prof | multi | mfg
    city_tier: int = 1
    employees: int = 1
    sites: int = 1
    has_gstin: bool = False             # valid AND active GSTIN
    fibre_available: bool = True
    mobile_lines: int = 0               # 0 = let engine decide
    pcs: int = 0                        # devices needing endpoint security
    cameras: int = 0
    pos_counters: int = 0
    vehicles: int = 0
    machines: int = 0
    wants_whatsapp: bool = False
    wants_website: bool = False
    wants_email: bool = False
    wants_backup: bool = False
    wants_guest_wifi: bool = False
    wants_failover: bool = False
    wants_static_ip: bool = False
    wants_telephony: bool = False
    wants_toll_free: bool = False
    wants_sms: bool = False
    wants_firewall: bool = False
    high_bandwidth: bool = False        # heavy cloud/ERP/video use
    budget_inr_per_month: int | None = None


@dataclass
class Line:
    product_id: str
    qty: int
    reason: str = ""


def eligibility_issues(pid: str, p: BusinessProfile, in_bundle: set[str] | None = None) -> list[str]:
    """Return human-readable reasons the product cannot be sold; empty list = eligible."""
    prod = products()[pid]
    issues = []
    if p.city_tier not in prod.tiers:
        issues.append(f"{prod.name} is only available in tier {'/'.join(map(str, sorted(prod.tiers)))} cities")
    if p.employees < prod.min_employees:
        issues.append(f"{prod.name} needs at least {prod.min_employees} employees")
    if p.sites < prod.min_sites:
        issues.append(f"{prod.name} needs at least {prod.min_sites} sites")
    if prod.requires_gstin and not p.has_gstin:
        issues.append(f"{prod.name} needs a valid, active GSTIN")
    if in_bundle is not None and prod.requires_one_of and not (prod.requires_one_of & in_bundle):
        names = ", ".join(products()[x].name for x in sorted(prod.requires_one_of))
        issues.append(f"{prod.name} needs one of: {names} in the same bundle")
    return issues


def _connectivity(p: BusinessProfile) -> tuple[str, str]:
    """Pick the main link per site."""
    def ok(pid):
        return not eligibility_issues(pid, p)

    if p.segment == "mfg" and p.employees >= 25 and p.high_bandwidth and ok("P06"):
        return "P06", "Dedicated 100 Mbps line with 99.9% SLA for a larger plant"
    if p.segment in ("mfg", "multi") and p.employees >= 10 and ok("P05") and (p.segment == "mfg" or p.high_bandwidth):
        return "P05", "Dedicated 1:1 leased line with SLA, so machines and billing never share bandwidth"
    if not p.fibre_available:
        return "P04", "5G AirFiber is plug-and-play and works where fibre is not laid"
    if p.high_bandwidth and ok("P03"):
        return "P03", "1 Gbps fibre with priority support for heavy cloud use"
    if p.segment in ("prof", "multi") and (p.employees >= 5 or p.segment == "multi"):
        return "P02", "300 Mbps fibre handles several staff on video calls and cloud apps at once"
    return "P01", "100 Mbps business fibre is enough for UPI, POS and WhatsApp, at the lowest price"


def recommend_bundle(p: BusinessProfile) -> dict:
    if p.segment not in SEGMENTS:
        raise ValueError(f"segment must be one of {sorted(SEGMENTS)}")
    lines: list[Line] = []
    sites = max(1, p.sites)

    base, why = _connectivity(p)
    lines.append(Line(base, sites, why))

    # Mobile lines
    n_lines = p.mobile_lines or (2 if p.segment == "micro" else max(2, min(p.employees // 3, 10)))
    sim = "P07" if p.segment == "micro" else "P08"
    lines.append(Line(sim, n_lines, "Business SIMs on one bill for owner and staff"))

    # Segment defaults
    if p.segment == "micro":
        lines.append(Line("P19", max(1, p.pos_counters), "GST-ready billing with UPI/card acceptance"))
        if p.wants_guest_wifi:
            lines.append(Line("P22", sites, "Separate guest Wi-Fi keeps your billing network safe"))
    if p.segment in ("prof", "multi", "mfg") or p.wants_email:
        users = max(1, p.employees if p.segment != "micro" else 1)
        if p.segment != "micro" or p.wants_email:
            lines.append(Line("P16", users, "Email on your own domain instead of personal Gmail"))
    if p.segment in ("prof", "mfg") or p.wants_backup:
        lines.append(Line("P17", 1, "Automatic backup of PCs and phones"))
    if p.segment in ("prof", "multi", "mfg") or p.pcs:
        devices = p.pcs or max(1, p.employees // 2)
        lines.append(Line("P20", devices, "Protects PCs and phones against ransomware"))
    if p.segment == "multi":
        if p.pos_counters:
            lines.append(Line("P19", p.pos_counters, "Same billing on every counter, one dashboard"))
        lines.append(Line("P09", sites, "Automatic 4G/5G failover so no site goes offline"))
        lines.append(Line("P10", sites, "Manage all sites' links centrally"))
    if p.segment == "mfg" and p.machines:
        lines.append(Line("P24", p.machines, "Track machine uptime and energy use"))

    # Explicit needs (any segment)
    if p.cameras:
        lines.append(Line("P23", p.cameras, "Cloud CCTV with 30-day recording, viewable on your phone"))
    if p.vehicles:
        lines.append(Line("P25", p.vehicles, "Live GPS tracking of delivery vehicles"))
    if p.wants_whatsapp:
        lines.append(Line("P15", 1, "Verified WhatsApp channel with catalogue to reach customers"))
    if p.wants_website:
        lines.append(Line("P18", 1, "Website on your own domain"))
    if p.wants_failover and p.segment != "multi":
        lines.append(Line("P09", sites, "Backup link for when the main internet is down"))
    if p.wants_static_ip:
        lines.append(Line("P11", 1, "Fixed IP for CCTV or remote access"))
    if p.wants_telephony:
        lines.append(Line("P12", max(2, min(p.employees // 3, 10)), "Business phone lines with IVR and call recording"))
    if p.wants_toll_free:
        lines.append(Line("P13", 1, "1800 number for customers"))
    if p.wants_sms:
        lines.append(Line("P14", 1, "SMS alerts and promotions"))
    if p.wants_firewall or (p.segment in ("mfg", "multi") and p.employees >= 10):
        lines.append(Line("P21", sites, "Managed firewall monitored by NorthStar SOC"))

    # De-duplicate (keep max qty)
    merged: dict[str, Line] = {}
    for ln in lines:
        if ln.product_id in merged:
            merged[ln.product_id].qty = max(merged[ln.product_id].qty, ln.qty)
        else:
            merged[ln.product_id] = ln

    # Eligibility filter, dependency-aware
    kept: dict[str, Line] = {}
    excluded = []
    for pid, ln in merged.items():
        issues = eligibility_issues(pid, p)
        if issues:
            excluded.append({"product_id": pid, "name": products()[pid].name, "reasons": issues})
        else:
            kept[pid] = ln
    for pid in list(kept):
        dep = eligibility_issues(pid, p, set(kept))
        if dep:
            excluded.append({"product_id": pid, "name": products()[pid].name, "reasons": dep})
            del kept[pid]

    bundle = list(kept.values())
    q = quote([(ln.product_id, ln.qty) for ln in bundle], p)
    # Budget trim: drop optional add-ons (most expensive first) until within budget
    if p.budget_inr_per_month and q["monthly_total"] > p.budget_inr_per_month:
        core = {base, sim}
        for ln in sorted(bundle, key=lambda l: -products()[l.product_id].price_min * l.qty):
            if q["monthly_total"] <= p.budget_inr_per_month:
                break
            if ln.product_id in core:
                continue
            trial = [x for x in bundle if x is not ln]
            if any(eligibility_issues(x.product_id, p, {y.product_id for y in trial}) for x in trial):
                continue
            bundle = trial
            excluded.append({"product_id": ln.product_id, "name": products()[ln.product_id].name,
                             "reasons": ["Removed to fit your monthly budget (you can add it back)"]})
            q = quote([(x.product_id, x.qty) for x in bundle], p)

    return {
        "segment": SEGMENT_LABELS[p.segment],
        "items": [
            {**q_line, "reason": next(l.reason for l in bundle if l.product_id == q_line["product_id"])}
            for q_line in q["lines"]
        ],
        "excluded": excluded,
        "quote": {k: v for k, v in q.items() if k != "lines"},
        "profile": asdict(p),
    }


def quote(items: list[tuple[str, int]], p: BusinessProfile | None = None) -> dict:
    """Single transparent monthly price. Uses list (min) price; validates dependencies."""
    cat = products()
    ids = {pid for pid, q in items if q > 0}
    lines, errors = [], []
    for pid, qty in items:
        if qty <= 0:
            continue
        if pid not in cat:
            errors.append(f"Unknown product {pid}")
            continue
        prod = cat[pid]
        if prod.requires_one_of and not (prod.requires_one_of & ids):
            errors.append(f"{prod.name} needs one of {', '.join(sorted(prod.requires_one_of))} in the bundle")
        if p is not None:
            errors += [e for e in eligibility_issues(pid, p) if e not in errors]
        lines.append({
            "product_id": pid,
            "name": prod.name,
            "category": prod.category,
            "unit": prod.unit,
            "qty": qty,
            "unit_price": prod.price_min,
            "monthly": prod.price_min * qty,
            "setup": prod.setup * qty,
            "install_days": prod.install_days,
            "min_contract": prod.min_contract,
        })
    monthly = sum(l["monthly"] for l in lines)
    return {
        "lines": lines,
        "monthly_total": monthly,
        "gst_18pct": round(monthly * 0.18),
        "monthly_total_incl_gst": round(monthly * 1.18),
        "one_time_setup": sum(l["setup"] for l in lines),
        "contract_months": max((l["min_contract"] for l in lines), default=0),
        "expected_activation_days": max((l["install_days"] for l in lines), default=0),
        "valid": not errors,
        "errors": errors,
    }
