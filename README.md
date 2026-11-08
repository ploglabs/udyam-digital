# Udyam Digital

Airtel SYNC hackathon, Track A: a digital-first acquisition and onboarding journey for MSMEs. The owner gets a bundle advisor, a transparent quote, Smart KYC and an order tracker.

**Demo video (2:15):** https://youtu.be/fFOwhewZ7_E · **Submission deck:** `deliverables/hooray_VITChennai.pdf`

## Layout
- `frontend/`: Next.js mobile web app (advisor, quote, KYC, tracker) + partner & sales desk at `/partner` (demo key `demo-partner`), see `frontend/README.md`
- `backend/`: FastAPI app, rules engine (`app/catalogue.py`), mock registries, KYC extraction and validation, lead propensity score (`app/propensity.py`)
- `data/`: synthetic hackathon dataset (catalogue, leads, GSTIN/Udyam registries, KYC specimens)
- `analysis/`: KYC batch results
- `tests/e2e_journey.py`: browser test of the whole journey
- `NOTES.md`: progress, KYC answer key, data insights

## Run
```bash
# API
cd backend
cp .env.example .env            # add Gemini keys
python3 -m pytest -q
uvicorn app.main:app --port 8000

# Web (another terminal)
cd frontend
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local   # must match the API port
npm run dev                     # http://localhost:3000

# Browser test of the whole journey (both servers running)
python3 tests/e2e_journey.py
```
