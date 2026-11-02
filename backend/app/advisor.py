"""Conversational bundle advisor.

Gemini talks to the owner (any Indian language) and gathers a profile; it must call
recommend_bundle() to get products and prices. The rules engine decides; the LLM explains.
"""

import csv
import uuid
from functools import lru_cache

from google.genai import types

from .catalogue import DATA_DIR, BusinessProfile, products, recommend_bundle
from .llm import generate
from .registry import lookup_gstin, mask

SYSTEM = """You are "Accel Saathi", the digital advisor of Accel Business (a telecom) for small businesses in India.
Goal: in a few short questions, recommend the right bundle with one clear monthly price.

Rules:
- Reply in the language the owner writes in (Hindi, Marathi, Tamil, etc.; Hinglish is fine). Keep messages short and friendly, no jargon or product codes.
- Ask at most 2 questions per message. Gather: type of business, city, number of staff, number of locations/shops,
  GST registration (offer to verify the GSTIN), current internet, and needs (billing/POS, CCTV cameras, WhatsApp for customers,
  business email, website, backup internet, phone lines/IVR, vehicles, machines, budget). Don't ask for things that are irrelevant to the business type.
- Map the business to a segment: micro (kirana, salon, pharmacy, bakery, small shop), prof (clinic, CA firm, coaching, law/insurance office),
  multi (restaurant chain or retailer with 2+ sites), mfg (factory, workshop, textile/auto-parts unit).
- Use get_city_tier for the city. If the owner gives a GSTIN, call check_gstin; only an Active GSTIN counts as has_gstin=true.
- As soon as you know segment, city, staff and sites, call recommend_bundle. Set a wants_* flag or a count (cameras, pos_counters, ...)
  ONLY if the owner asked for it or clearly described the need; otherwise leave the default (the engine already adds segment essentials). NEVER invent products,
  prices or discounts: only state what recommend_bundle returns. Re-call it whenever the owner changes something.
- Describe ONLY the items returned in "items". Anything the owner asked for that appears in "excluded" is NOT added: say so plainly,
  never claim it was added.
- After recommending: list each item with a one-line plain-language reason, the monthly total (+18% GST), one-time setup, contract length
  and expected activation days. If items were excluded (e.g. need GSTIN), say why in one line and what would unlock them.
- Then invite them to review the quote and continue to quick KYC. If they need something complex (leased line feasibility, 10+ sites)
  or ask for a human, offer a callback from a local Accel partner.
- Never ask for Aadhaar, PAN, bank details or documents in chat; KYC happens on a separate consent screen."""


@lru_cache
def _city_tiers() -> dict[str, int]:
    with open(DATA_DIR / "smb_leads.csv", newline="") as f:
        return {r["city"].lower(): int(r["city_tier"]) for r in csv.DictReader(f)}


def get_city_tier(city: str) -> dict:
    """Return the Accel city tier (1 or 2) for an Indian city."""
    tier = _city_tiers().get(city.strip().lower())
    if tier is None:
        return {"city": city, "tier": 2, "known": False, "note": "City not in serviceable list; assume tier 2 and confirm feasibility"}
    return {"city": city, "tier": tier, "known": True}


def check_gstin(gstin: str) -> dict:
    """Verify a GSTIN against the GST registry. Returns status and business name."""
    from .kyc.validators import check_gstin_format

    fmt = check_gstin_format(gstin)[0]
    if fmt.severity != "pass":
        return {"valid": False, "reason": fmt.message}
    reg = lookup_gstin(fmt.value or gstin)
    if not reg:
        return {"valid": False, "reason": "GSTIN not found in registry"}
    return {"valid": reg["status"] == "Active", "status": reg["status"], "trade_name": reg["trade_name"],
            "state": reg["state"], "gstin_masked": mask(reg["gstin"])}


class Session:
    def __init__(self):
        self.id = uuid.uuid4().hex[:12]
        self.history: list[types.Content] = []
        self.bundle: dict | None = None
        self.gstin: str | None = None


_sessions: dict[str, Session] = {}


def chat(message: str, session_id: str | None = None) -> dict:
    s = _sessions.get(session_id or "") or Session()
    _sessions[s.id] = s

    def recommend_bundle_tool(
        segment: str, city_tier: int, employees: int, sites: int, has_gstin: bool,
        fibre_available: bool = True, mobile_lines: int = 0, pcs: int = 0, cameras: int = 0,
        pos_counters: int = 0, vehicles: int = 0, machines: int = 0,
        wants_whatsapp: bool = False, wants_website: bool = False, wants_email: bool = False,
        wants_backup: bool = False, wants_guest_wifi: bool = False, wants_failover: bool = False,
        wants_static_ip: bool = False, wants_telephony: bool = False, wants_toll_free: bool = False,
        wants_sms: bool = False, wants_firewall: bool = False, high_bandwidth: bool = False,
        budget_inr_per_month: int = 0,
    ) -> dict:
        """Get the eligible bundle and exact quote from the Accel catalogue rules engine.
        segment: micro | prof | multi | mfg. city_tier: 1 or 2. has_gstin: true only for an Active GSTIN."""
        args = {k: v for k, v in locals().items() if k in BusinessProfile.__dataclass_fields__}
        args["budget_inr_per_month"] = budget_inr_per_month or None
        res = recommend_bundle(BusinessProfile(**args))
        s.bundle = res
        return {"items": [{k: i[k] for k in ("name", "qty", "monthly", "setup", "reason")} for i in res["items"]],
                "excluded": res["excluded"], "quote": res["quote"]}

    recommend_bundle_tool.__name__ = "recommend_bundle"

    s.history.append(types.Content(role="user", parts=[types.Part(text=message)]))
    resp = generate(
        s.history,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM,
            tools=[recommend_bundle_tool, get_city_tier, check_gstin],
            temperature=0.3,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(maximum_remote_calls=6),
        ),
    )
    afc = resp.automatic_function_calling_history or []
    if afc:  # includes the user turn + tool calls/results
        s.history = list(afc)
    reply = resp.text or ""
    s.history.append(types.Content(role="model", parts=[types.Part(text=reply)]))
    return {"session_id": s.id, "reply": reply, "bundle": s.bundle}


def get_session(session_id: str) -> Session | None:
    return _sessions.get(session_id)


def catalogue_public() -> list[dict]:
    return [{"id": p.id, "category": p.category, "name": p.name, "description": p.description, "unit": p.unit,
             "price": p.price_min, "setup": p.setup, "min_contract": p.min_contract, "install_days": p.install_days,
             "requires_gstin": p.requires_gstin, "requires_one_of": sorted(p.requires_one_of)}
            for p in products().values()]
