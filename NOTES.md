# Udyam Digital: working notes

## Status (2026-11-02)
- [x] Rules engine: bundle + quote (`backend/app/catalogue.py`)
- [x] Mock GSTIN/Udyam registry + ID masking (`backend/app/registry.py`)
- [x] KYC validators (`backend/app/kyc/validators.py`) + Gemini vision extraction (`backend/app/kyc/extract.py`)
- [x] All 47 specimen documents extracted and validated (`analysis/kyc_extractions.json`, `analysis/kyc_report.json`)
- [x] 11 tests passing (`cd backend && python3 -m pytest -q`)
- [ ] Advisor `/chat` (Gemini function calling over `recommend_bundle`)
- [ ] FastAPI routes + SQLite orders/tracker
- [ ] Next.js frontend: advisor, quote, KYC, tracker
- [ ] Slides, architecture diagram, privacy note, demo video

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
