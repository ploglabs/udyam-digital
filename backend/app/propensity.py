"""Lead propensity score: which leads should a partner or field rep call first.

A small logistic regression on smb_leads.csv (numpy only, trained once on first use, < 1 s).
It uses only what is known when a lead arrives (source, segment, size, city tier, registrations,
current internet), never funnel dates or outcomes, so it can score a brand-new advisor lead.
"""
from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from .catalogue import DATA_DIR

SOURCES = ["Field sales", "Website form", "Channel partner", "Inbound call", "Referral", "WhatsApp campaign"]
SEGMENTS = ["Micro retail & services", "Professional offices", "Small multi-site businesses", "Small manufacturers"]
INTERNET = ["Mobile hotspot", "Home broadband", "Business broadband", "Leased line", "Mixed per site"]
TURNOVER = ["< 40 lakh", "40 lakh - 1.5 cr", "1.5 - 5 cr", "5 - 25 cr", "25 - 100 cr"]
SEG_CODE = {"micro": SEGMENTS[0], "prof": SEGMENTS[1], "multi": SEGMENTS[2], "mfg": SEGMENTS[3]}

# What the partner should do about each historical drop reason (and whether the digital journey already fixes it)
DROP_ACTIONS = {
    "Unreachable after 3 attempts": "Send the WhatsApp advisor link instead of calling again",
    "Owner had no time for a visit": "Send the advisor link; no visit needed",
    "Visit not scheduled by sales": "Send the advisor link; no visit needed",
    "Quote too complex to understand": "Share the one-price digital quote",
    "Quote took too long to arrive": "Share the instant digital quote",
    "Found paperwork too long": "Offer 3-minute Smart KYC",
    "Missing GST or Udyam document": "Help register Udyam (free, online); offer non-GST bundle meanwhile",
    "Document details did not match": "Re-run Smart KYC; it shows which detail differs",
    "Authorised signatory not available": "Send the KYC link to the signatory's phone",
    "Price too high": "Offer the budget bundle (advisor budget cap)",
    "Competitor offered cheaper plan": "Offer the budget bundle and one-bill savings",
    "Locked in with current provider": "Diarise contract end; call 30 days before",
    "Only wanted a mobile plan": "Offer business SIMs with a broadband trial",
    "Decided to wait": "Follow up in 30 days with the saved quote",
    "Not interested on first call": "Low priority; WhatsApp nurture only",
    "Installation delayed beyond 21 days": "Apologise; check feasibility and rebook with a firm date",
    "Customer cancelled before install": "Ask why; offer a firm install date",
    "Site not feasible for fibre": "Offer 5G FWA instead of fibre",
    "First payment failed": "Resend the payment link (UPI autopay)",
    "Wrong or invalid number": "Do not call; data quality issue",
}
DIGITAL_FIXES = {k for k, v in DROP_ACTIONS.items() if "advisor" in v or "quote" in v or "KYC" in v}


def _onehot(value: str, levels: list[str]) -> list[float]:
    return [1.0 if value == lv else 0.0 for lv in levels[1:]]  # first level is the baseline


def features(source: str, segment: str, city_tier: int, has_gstin: bool, has_udyam: bool,
             employees: int, sites: int, internet: str = "Mobile hotspot", turnover: str = "") -> list[float]:
    t = TURNOVER.index(turnover) if turnover in TURNOVER else 1
    return ([1.0] + _onehot(source, SOURCES) + _onehot(segment, SEGMENTS) + _onehot(internet, INTERNET)
            + [float(city_tier == 1), float(has_gstin), float(has_udyam), math.log1p(employees),
               float(sites > 1), t / 4])


def _row_features(r: dict) -> list[float]:
    return features(r["lead_source"], r["segment"], int(r["city_tier"]), r["has_gstin"] == "Y", r["has_udyam"] == "Y",
                    int(r["employee_count"]), int(r["num_sites"]), r["current_internet"], r["annual_turnover_band"])


def _fit(X: np.ndarray, y: np.ndarray, l2: float = 1.0, iters: int = 50) -> np.ndarray:
    """L2-regularised logistic regression by Newton's method."""
    w = np.zeros(X.shape[1])
    reg = l2 * np.eye(X.shape[1])
    reg[0, 0] = 0  # don't shrink the intercept
    for _ in range(iters):
        p = 1 / (1 + np.exp(-X @ w))
        g = X.T @ (p - y) + reg @ w
        H = (X * (p * (1 - p))[:, None]).T @ X + reg
        step = np.linalg.solve(H, g)
        w -= step
        if np.abs(step).max() < 1e-8:
            break
    return w


def _auc(y: np.ndarray, s: np.ndarray) -> float:
    order = np.argsort(s)
    ranks = np.empty(len(s))
    ranks[order] = np.arange(1, len(s) + 1)
    pos = y == 1
    n1, n0 = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


@dataclass
class Model:
    w: np.ndarray
    base_rate: float
    auc_holdout: float
    lift_top_decile: float
    rows: list[dict]
    scores: np.ndarray


@lru_cache
def model() -> Model:
    with open(DATA_DIR / "smb_leads.csv", newline="") as f:
        rows = list(csv.DictReader(f))
    X = np.array([_row_features(r) for r in rows])
    y = np.array([r["outcome"] == "Activated" for r in rows], dtype=float)
    # Holdout check on a fixed 25% split, then refit on everything
    rng = np.random.default_rng(7)
    test = rng.random(len(rows)) < 0.25
    w_cv = _fit(X[~test], y[~test])
    s_test = X[test] @ w_cv
    top = s_test >= np.quantile(s_test, 0.9)
    lift = float(y[test][top].mean() / y[test].mean())
    w = _fit(X, y)
    return Model(w, float(y.mean()), _auc(y[test], s_test), lift, rows, 1 / (1 + np.exp(-X @ w)))


def score(**kw) -> float:
    m = model()
    return float(1 / (1 + math.exp(-float(np.array(features(**kw)) @ m.w))))


def score_profile(profile: dict, source: str = "Website form") -> float:
    """Score a live advisor profile (segment code, city_tier, employees, sites, has_gstin)."""
    return score(source=source, segment=SEG_CODE.get(profile.get("segment", ""), SEGMENTS[0]),
                 city_tier=int(profile.get("city_tier") or 2), has_gstin=bool(profile.get("has_gstin")),
                 has_udyam=bool(profile.get("has_udyam")), employees=int(profile.get("employees") or 1),
                 sites=int(profile.get("sites") or 1))


def band(p: float) -> str:
    base = model().base_rate
    return "hot" if p >= 2 * base else "warm" if p >= base else "cold"


def explain() -> list[dict]:
    """Coefficients as plain odds multipliers, for the back-office 'why' panel."""
    names = (["intercept"] + [f"Source: {s}" for s in SOURCES[1:]] + [f"Segment: {s}" for s in SEGMENTS[1:]]
             + [f"Internet: {s}" for s in INTERNET[1:]]
             + ["Tier-1 city", "Has GSTIN", "Has Udyam", "log(1+employees)", "Multi-site", "Turnover band (0-1)"])
    w = model().w
    out = [{"feature": n, "odds_x": round(math.exp(c), 2)} for n, c in zip(names, w) if n != "intercept"]
    return sorted(out, key=lambda d: -abs(math.log(d["odds_x"])))


def winback(segment: str | None = None, source: str | None = None, digital_fix_only: bool = False,
            limit: int = 50) -> list[dict]:
    """Dropped leads ranked by propensity, with the drop reason and the suggested next action.
    Names and phone numbers are not returned; the rep opens the lead in CRM by its ID."""
    m = model()
    out = []
    for r, p in zip(m.rows, m.scores):
        if r["outcome"] != "Dropped" or r["drop_reason"] == "Wrong or invalid number":
            continue
        if segment and r["segment"] != segment:
            continue
        if source and r["lead_source"] != source:
            continue
        if digital_fix_only and r["drop_reason"] not in DIGITAL_FIXES:
            continue
        out.append({"lead_id": r["lead_id"], "business_type": r["business_type"], "segment": r["segment"],
                    "city": r["city"], "language": r["preferred_language"], "source": r["lead_source"],
                    "stage_reached": r["stage_reached"], "drop_reason": r["drop_reason"],
                    "action": DROP_ACTIONS.get(r["drop_reason"], "Review"),
                    "digital_fix": r["drop_reason"] in DIGITAL_FIXES,
                    "score": round(float(p), 3), "band": band(float(p))})
    out.sort(key=lambda d: -d["score"])
    return out[:limit]
