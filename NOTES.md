# Udyam Digital: working notes

## Status (2026-11-02)
- [x] Rules engine: bundle + quote (`backend/app/catalogue.py`)
- [x] Mock GSTIN/Udyam registry + ID masking (`backend/app/registry.py`)
- [x] KYC validators (`backend/app/kyc/validators.py`) + Gemini vision extraction (`backend/app/kyc/extract.py`)
- [x] All 47 specimen documents extracted and validated (`analysis/kyc_extractions.json`, `analysis/kyc_report.json`)
- [x] Advisor `/chat` (`backend/app/advisor.py`): Gemini function calling over `recommend_bundle`, `get_city_tier`, `check_gstin`; tested live in Hindi
- [x] FastAPI routes (`backend/app/main.py`) + SQLite consent/KYC/orders/tracker (`backend/app/orders.py`)
- [x] 25 tests passing (rules, KYC, end-to-end API flow, 7 advisor scenarios through `/recommend`)
- [x] Next.js frontend (`frontend/`): landing, advisor chat (EN/HI, quick replies, voice, form fallback), live quote, KYC (consent → upload → results → order), tracker
- [x] Browser test of the whole journey (`tests/e2e_journey.py`): passes at 390×844, no console errors
- [x] Business case deck, 10 slides on the SYNC template (`deliverables/Udyam_Digital_Business_Case.pptx` + `.pdf`; rebuild with `deliverables/build_deck.js`)
- [x] 1-page privacy & security note (`deliverables/Privacy_Note.pdf`, source `privacy_note.html`)
- [x] Stretch goals (2026-11-06): partner & sales desk `/partner` (leads the digital journey didn't close + win-back list + metrics), propensity score (`backend/app/propensity.py`), working "Talk to a person" callback on failed KYC
- [x] Architecture diagram, 1 page (`deliverables/Architecture.pdf`, source `architecture.html`)
- [x] KYC check messages shown in Hindi in Hindi mode (map by finding code in `frontend/src/app/kyc/page.tsx`; English detail kept underneath for failures)
- [ ] Deploy, demo video
- [ ] Follow-ups: confirm the KYC retention period with legal; deck and privacy note still say "Accel Business" (app was rebranded to NorthStar)

## Gemini
- Keys are in `backend/.env` (git-ignored), as `GEMINI_API_KEYS=k1,k2,...`. `app/llm.py` moves to the next key on a 429 error.
- **All keys share one free-tier quota: 5 requests per minute for gemini-2.5-flash.** A live KYC check uses 4 calls. Turn on billing before the demo, or pre-cache the extraction for the demo applicant.

## KYC answer key (our own; the judges have the official one)
| Applicant | Business | Verdict | Problem caught |
|---|---|---|---|
| K01 | Vindhya Tours & Travels | Rejected | GSTIN **Cancelled** in the registry + Udyam number **blank** on the certificate |
| K02 | Harmony Dental Care | Approved | none (GSTIN OCR'd as `E0G…`, auto-corrected to `EOG…`) |
| K03 | Ganesh Woodcraft | Approved | none (address wraps over 2 lines, "Maharashtr / a") |
| K04 | Saffron Dental Care LLP | Manual review | GST certificate **blurred** → ask to re-upload (GSTIN still recovered by auto-correction) |
| K05 | Balaji Realty LLP | Rejected | **Udyam certificate missing** (only 3 documents) |
| K06 | Saffron Unisex Salon | Rejected | GSTIN **check digit invalid**: certificate `…S8189…`, registry `…S5189…` (a tampered digit) |
| K07 | Neelgiri Physio Clinic | Rejected | GST certificate legal name **"Shri Physio Clinic"** ≠ registry and other documents "Neelgiri" (an edited certificate) |
| K08 | Green Leaf Legal Associates | Approved | none (GSTIN `X0R…` → `XOR…` auto-corrected) |
| K09 | Kaveri Insurance Advisors | Approved | none |
| K10 | Kaveri Stays LLP | Approved | none (Gemini added an extra character to the GSTIN; repaired by dropping one character, then the check digit passes) |
| K11 | Trinity Bake House Pvt Ltd | Rejected | Address proof dated 2025-10-31, **257 days old** (limit 90) |
| K12 | Star Electronics | Approved | none |

Still worth checking by eye before the demo: K09, K10 and K12. The designations ("Owner" on LLP/company IDs) and PIN codes look random across the data, so we don't treat them as planted signals.

### What made extraction reliable
- OCR confuses `O`/`0`, `S`/`5` and `I`/`1`, and sometimes adds or drops a character. `repair_gstin()` fixes letters and digits based on their position in the GSTIN, and accepts a repair **only if the check digit then passes**. So a genuinely wrong digit (K06) is still rejected.
- Name matching is **word by word**. Whole-string similarity let "Shri" vs "Neelgiri" pass at 0.87.
- The address state is checked against the **registry address**, not the OCR'd text, which can be cut off at a line wrap.
- Gemini's `quality_issues` notes are used: "blurry" → warn + ask for a re-upload.

## Data insights for the slides
- Activation by segment: micro retail 4.1% · professional offices 11.1% · multi-site 11.0% · manufacturers 12.8%
- Micro retail: 6-month churn 23%, average bundle ₹2,505/month
- Acquisition cost per activation by source: field sales ₹24.3k, channel partner ₹20.9k, website ₹6.4k, inbound ₹5.1k, referral ₹4.1k (14.8% activation), WhatsApp ₹4.0k
- 22 activated customers have a Cancelled or Suspended GSTIN: a compliance leak
- Churn by status-chase calls: 1 call 6% → 5 calls 28%

## API (run: `cd backend && uvicorn app.main:app --reload`, docs at /docs)
| Method | Path | Purpose |
|---|---|---|
| POST | `/chat` | Advisor turn `{message, session_id}` → `{reply, bundle}` |
| GET | `/catalogue` | Public product list |
| POST | `/recommend` | Deterministic bundle from a profile (form fallback if the LLM is down) |
| POST | `/quote` | `{items: [[pid, qty]], profile?}` → monthly total, GST, setup, contract, ETA, dependency errors |
| GET | `/lookup/gstin/{id}`, `/lookup/udyam/{id}` | Mock registries (IDs masked) |
| GET | `/consent/notice` | DPDP notice: purposes, data collected/not collected, retention |
| POST/DELETE | `/consent`, `/consent/{id}` | Record consent (returns `kyc_id`) / withdraw consent (erases KYC data) |
| POST | `/kyc/{kyc_id}/document` | Upload one document → extracted fields (masked); image not stored |
| POST | `/kyc/{kyc_id}/verify` | Run all checks → verdict + findings |
| POST | `/orders` | Place order (needs KYC that isn't rejected; GST-only products need an active GSTIN) |
| GET | `/orders/{id}` | Tracker timeline + ETA |
| POST | `/orders/{id}/advance` | Demo/back-office: move to the next stage |
| POST | `/callback` | Owner asks for a human `{phone, session_id?, kyc_id?, reason?}` |
| GET | `/backoffice/leads` | Live unclosed journeys, callbacks first, then by propensity (header `X-Backoffice-Key`, default `demo-partner`, env `BACKOFFICE_KEY`) |
| GET | `/backoffice/winback` | Last quarter's dropped leads ranked by propensity, with next action (`segment`, `source`, `digital_fix_only`, `limit`) |
| GET | `/backoffice/metrics` | 5 KPIs (baseline → target), live counts, model quality + drivers |

### Leads and propensity
- Every bundle from `/chat` or `/recommend` upserts a `leads` row keyed by the advisor session id (profile only, no name). `/consent` (with `session_id`), `/kyc/{id}/verify` and `/orders` move its status: quoted → kyc_started → kyc_approved / kyc_review / kyc_rejected → ordered. Ordered leads leave the partner list.
- Propensity: L2 logistic regression (numpy, Newton) on lead-time features only (source, segment, tier, GSTIN, Udyam, employees, multi-site, internet, turnover). Holdout AUC 0.71, top-decile lift 1.9×. Biggest drivers: has GSTIN ×3.6, referral ×2.3, WhatsApp campaign ×0.4.
- Live advisor leads are scored as source "Website form" (the closest historical channel).

Uploads that match a specimen image (by SHA-256) reuse `analysis/kyc_extractions.json`, so the demo uses no Gemini quota.

### Gotchas
- Next 16 scaffold enables `cacheComponents`. Pages are client components that fetch in the browser; `/track` reads `?id=` inside `<Suspense>`.
- The advisor gets the UI language with each message (`[app language: …]`); without it, Gemini sometimes answered English questions in Hindi.
- Don't `pkill -f "next start"` from a shell whose own command line contains that text: it kills itself. Stop the servers by port instead.
- Don't use `from __future__ import annotations` in `advisor.py`: the Gemini SDK can't convert string type hints for tool functions (every tool call errors out).
- The advisor prompt must forbid setting `wants_*` flags the owner didn't ask for; otherwise Gemini adds email/backup to a kirana bundle.
