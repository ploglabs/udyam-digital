"""Document extraction with Gemini vision -> strict JSON per document type."""
from __future__ import annotations

import json

from google.genai import types

from ..llm import generate

PROMPT = """You are a KYC document reader for an Indian telecom. Read the image and return JSON only.
First classify doc_type as one of: gst_certificate, udyam_certificate, signatory_id, address_proof, other.
Then extract fields exactly as printed (do not correct, guess or fill blanks; use null if a field is empty or absent):
- gst_certificate: gstin, legal_name, trade_name, constitution, address, date_of_liability, registration_type
- udyam_certificate: udyam_number, enterprise_name, major_activity, city, state, date_of_registration
- signatory_id: name, designation, for_business, id_number, valid_till
- address_proof: document_kind, consumer_number, billed_to, address, bill_date
Copy identifiers (GSTIN, Udyam number, ID number) character by character: keep the exact length, do not add or drop characters, and tell letter O from digit 0 by context.
Join addresses that wrap across lines into one string (e.g. 'A' + 'ndhra Pradesh' -> 'Andhra Pradesh').
Dates as YYYY-MM-DD. Also return "quality_issues": a list of anything odd (blank field, signs of editing, unreadable text).
Format: {"doc_type": "...", "fields": {...}, "quality_issues": [...]}"""


def extract_document(image_bytes: bytes, mime_type: str = "image/png") -> dict:
    resp = generate(
        [types.Part.from_bytes(data=image_bytes, mime_type=mime_type), PROMPT],
        config=types.GenerateContentConfig(response_mime_type="application/json", temperature=0),
    )
    data = json.loads(resp.text)
    data.setdefault("fields", {})
    data.setdefault("quality_issues", [])
    return data
