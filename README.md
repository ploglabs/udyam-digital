# Udyam Digital

Airtel SYNC hackathon, Track A: a digital-first acquisition and onboarding journey for MSMEs. The owner gets a bundle advisor, a transparent quote, Smart KYC and an order tracker.

## Layout
- `backend/`: FastAPI app, rules engine (`app/catalogue.py`), mock registries, KYC extraction and validation
- `data/`: synthetic hackathon dataset (catalogue, leads, GSTIN/Udyam registries, KYC specimens)
- `analysis/`: KYC batch results
- `NOTES.md`: progress, KYC answer key, data insights

## Run
```bash
cd backend
cp .env.example .env   # add Gemini keys
python3 -m pytest -q
python3 -m scripts.run_kyc_batch
```
