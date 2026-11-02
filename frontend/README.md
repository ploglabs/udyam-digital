# Udyam Digital: web app

Mobile-first Next.js 16 + Tailwind 4 frontend for the owner journey: Advisor → Quote → KYC → Track.

```bash
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local
npm run dev        # http://localhost:3000
```

| Route | What it does |
|---|---|
| `/` | Landing, language toggle (EN/हिं) |
| `/advisor` | Chat with Saathi (Gemini), quick replies, voice input (Web Speech API), quick-form fallback |
| `/quote` | Live quote from the rules engine: change quantities, remove items, add add-ons; dependency/eligibility errors shown |
| `/kyc` | DPDP consent → document upload (camera/file; demo sample applicants) → per-check results → place order |
| `/track?id=UD…` | Order timeline with ETA, polling, WhatsApp share, demo "next stage" |

Journey state is kept in `sessionStorage` only; the language preference is kept in `localStorage`.
