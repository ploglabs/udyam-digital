# Udyam Digital

Airtel SYNC hackathon, Track A: a digital-first acquisition and onboarding journey for MSMEs. The owner gets a bundle advisor, a transparent quote, Smart KYC and an order tracker.

## Layout
- `frontend/`: Next.js mobile web app (advisor, quote, KYC, tracker), see `frontend/README.md`
- `backend/`: FastAPI app, rules engine (`app/catalogue.py`), mock registries, KYC extraction and validation
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
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local
npm run dev                     # http://localhost:3000

# Browser test of the whole journey (both servers running)
python3 tests/e2e_journey.py
```
