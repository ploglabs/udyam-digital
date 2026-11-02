"""Smart KYC validation rules. Pure functions over extracted document fields.

Each check returns a Finding(code, severity, message). severity: "fail" blocks the
order, "warn" routes to manual review, "pass" is shown as a green tick.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from datetime import date, datetime
from difflib import SequenceMatcher

from ..registry import lookup_gstin, lookup_udyam, mask

TODAY = date(2026, 7, 15)          # README: use as "today" for date checks
ADDRESS_PROOF_MAX_AGE_DAYS = 90
REQUIRED_DOCS = ("gst_certificate", "udyam_certificate", "signatory_id", "address_proof")

GST_STATE_CODES = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
}
UDYAM_STATE_CODES = {
    "JK": "Jammu and Kashmir", "HP": "Himachal Pradesh", "PB": "Punjab", "CH": "Chandigarh",
    "UK": "Uttarakhand", "HR": "Haryana", "DL": "Delhi", "RJ": "Rajasthan", "UP": "Uttar Pradesh",
    "BR": "Bihar", "SK": "Sikkim", "AR": "Arunachal Pradesh", "NL": "Nagaland", "MN": "Manipur",
    "MZ": "Mizoram", "TR": "Tripura", "ML": "Meghalaya", "AS": "Assam", "WB": "West Bengal",
    "JH": "Jharkhand", "OD": "Odisha", "CG": "Chhattisgarh", "MP": "Madhya Pradesh", "GJ": "Gujarat",
    "MH": "Maharashtra", "KA": "Karnataka", "GA": "Goa", "KL": "Kerala", "TN": "Tamil Nadu",
    "PY": "Puducherry", "TS": "Telangana", "AP": "Andhra Pradesh", "LA": "Ladakh",
}

_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
# PAN 4th char normally in CPHFATBLJG; README says accept X for this synthetic data.
GSTIN_RE = re.compile(r"^(\d{2})([A-Z]{3}[CPHFATBLJGX][A-Z]\d{4}[A-Z])([1-9A-Z])Z([0-9A-Z])$")
UDYAM_RE = re.compile(r"^UDYAM-([A-Z]{2})-(\d{2})-(\d{7})$")


@dataclass
class Finding:
    code: str
    severity: str  # pass | warn | fail
    message: str
    doc: str | None = None
    value: str | None = None   # normalised value, e.g. corrected GSTIN


def gstin_checksum(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        prod = _CHARS.index(ch) * (2 if i % 2 else 1)
        total += prod // 36 + prod % 36
    return _CHARS[(36 - total % 36) % 36]


_TO_LETTER = {"0": "O", "1": "I", "5": "S", "8": "B", "2": "Z", "6": "G"}
_TO_DIGIT = {v: k for k, v in _TO_LETTER.items()}
_LETTER_POS, _DIGIT_POS = {2, 3, 4, 5, 6, 11}, {0, 1, 7, 8, 9, 10}


def _fix_positions(g: str) -> str:
    out = []
    for i, ch in enumerate(g):
        if i in _LETTER_POS:
            ch = _TO_LETTER.get(ch, ch)
        elif i in _DIGIT_POS:
            ch = _TO_DIGIT.get(ch, ch)
        out.append(ch)
    return "".join(out)


def repair_gstin(raw: str) -> str | None:
    """Undo common OCR confusions (O/0, S/5, I/1, B/8, extra/dropped char).
    A repair is only accepted if the result passes format AND check digit, so a
    genuinely mistyped GSTIN (wrong digit in a digit slot) still fails."""
    g = raw.strip().upper().replace(" ", "")
    cands = [g] if len(g) == 15 else [g[:i] + g[i + 1:] for i in range(len(g))] if len(g) == 16 else []
    for c in cands:
        for variant in (c, _fix_positions(c)):
            # last char may be O/0 ambiguous in monospace fonts
            for last in {variant[14], _TO_LETTER.get(variant[14], variant[14]), _TO_DIGIT.get(variant[14], variant[14])}:
                v = variant[:14] + last
                if GSTIN_RE.match(v) and v[:2] in GST_STATE_CODES and gstin_checksum(v[:14]) == v[14]:
                    return v
    return None


def check_gstin_format(gstin: str | None) -> list[Finding]:
    if not gstin:
        return [Finding("GSTIN_MISSING", "fail", "GSTIN not found on the certificate", "gst_certificate")]
    g = gstin.strip().upper().replace(" ", "")
    fixed = repair_gstin(g)
    if fixed and fixed != g:
        return [Finding("GSTIN_FORMAT", "pass",
                        f"GSTIN read as {mask(g)}, auto-corrected OCR confusion to {mask(fixed)} (check digit valid)",
                        "gst_certificate", fixed)]
    m = GSTIN_RE.match(g)
    if not m:
        return [Finding("GSTIN_FORMAT", "fail", f"GSTIN {mask(g)} is not in the 15-character GSTIN format", "gst_certificate")]
    if m.group(1) not in GST_STATE_CODES:
        return [Finding("GSTIN_STATE_CODE", "fail", f"GSTIN state code {m.group(1)} does not exist", "gst_certificate")]
    if gstin_checksum(g[:14]) != g[14]:
        return [Finding("GSTIN_CHECKSUM", "fail", f"GSTIN {mask(g)} has an invalid check digit (likely a typo or tampering)", "gst_certificate")]
    return [Finding("GSTIN_FORMAT", "pass", "GSTIN format and check digit are valid", "gst_certificate")]


def norm_name(s: str | None) -> str:
    s = (s or "").lower()
    s = re.sub(r"\(prop\.?\s*", "", s)
    s = re.sub(r"\b(m/s|pvt|private|ltd|limited|llp|the)\b", " ", s)
    s = re.sub(r"[^a-z0-9& ]", " ", s).replace("&", " and ")
    return re.sub(r"\s+", " ", s).strip()


def name_similarity(a: str | None, b: str | None) -> float:
    a, b = norm_name(a), norm_name(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    # Token-wise: every word of the shorter name must match a word in the longer one
    # (tolerates OCR typos within a word, but a swapped word like Shri->Neelgiri fails).
    ta, tb = a.split(), b.split()
    short, long_ = (ta, tb) if len(ta) <= len(tb) else (tb, ta)
    hits = sum(max(SequenceMatcher(None, w, x).ratio() for x in long_) >= 0.85 for w in short)
    return hits / len(short)


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(s.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _state_in(address: str | None, state: str | None) -> bool:
    return bool(address and state and norm_name(state).replace(" ", "") in norm_name(address).replace(" ", ""))


def _pincode(address: str | None) -> str | None:
    m = re.search(r"\b(\d{6})\b", (address or "").replace(" ", "")) or re.search(r"(\d{6})\s*$", address or "")
    return m.group(1) if m else None


def validate_application(docs: dict[str, dict], today: date = TODAY,
                         quality: dict[str, list[str]] | None = None) -> dict:
    """docs: {doc_type: extracted_fields}; quality: {doc_type: OCR quality notes}."""
    f: list[Finding] = []
    for d, notes in (quality or {}).items():
        if any(w in n.lower() for n in notes for w in ("blur", "unreadable", "illegible", "low resolution")):
            f.append(Finding("IMAGE_QUALITY", "warn", f"{d.replace('_', ' ').title()} image is blurry, so ask the customer to re-upload a clearer photo", d))

    # 1. Completeness
    for d in REQUIRED_DOCS:
        if d not in docs or not docs[d]:
            f.append(Finding("DOC_MISSING", "fail", f"{d.replace('_', ' ').title()} was not uploaded", d))

    gst = docs.get("gst_certificate") or {}
    udy = docs.get("udyam_certificate") or {}
    sig = docs.get("signatory_id") or {}
    adr = docs.get("address_proof") or {}

    # 2. GSTIN: format, checksum, registry, status, details match
    reg = None
    if gst:
        fmt = check_gstin_format(gst.get("gstin"))
        f += fmt
        if fmt[0].severity == "pass":
            g = fmt[0].value or gst["gstin"].strip().upper()
            reg = lookup_gstin(g)
            if not reg:
                f.append(Finding("GSTIN_NOT_FOUND", "fail", f"GSTIN {mask(g)} not found in the GST registry", "gst_certificate"))
            else:
                if reg["status"] != "Active":
                    f.append(Finding("GSTIN_INACTIVE", "fail", f"GST registration is {reg['status']} in the registry", "gst_certificate"))
                else:
                    f.append(Finding("GSTIN_ACTIVE", "pass", "GST registration is Active in the registry", "gst_certificate"))
                if name_similarity(gst.get("legal_name"), reg["legal_name"]) < 0.85:
                    f.append(Finding("GST_NAME_MISMATCH", "fail",
                                     f"Legal name on certificate ('{gst.get('legal_name')}') does not match registry ('{reg['legal_name']}')",
                                     "gst_certificate"))
                cert_addr, reg_addr = gst.get("address"), reg["principal_place_of_business"]
                if cert_addr and name_similarity(cert_addr, reg_addr) < 0.85:
                    f.append(Finding("GST_ADDRESS_MISMATCH", "warn", "Address on certificate differs from registry", "gst_certificate"))
                state_from_code = GST_STATE_CODES.get(g[:2])
                if state_from_code and reg["state"] != state_from_code:
                    f.append(Finding("GSTIN_STATE_MISMATCH", "fail",
                                     f"GSTIN state code {g[:2]} ({state_from_code}) does not match registered state {reg['state']}",
                                     "gst_certificate"))
            addr_ref = (reg or {}).get("principal_place_of_business") or gst.get("address")
            if addr_ref and GST_STATE_CODES.get(g[:2]) and not _state_in(addr_ref, GST_STATE_CODES[g[:2]]):
                f.append(Finding("GSTIN_ADDRESS_STATE", "warn",
                                 f"GSTIN state code points to {GST_STATE_CODES[g[:2]]}, but the address is elsewhere",
                                 "gst_certificate"))

    business_name = (reg or {}).get("trade_name") or gst.get("trade_name") or gst.get("legal_name")
    legal_name = (reg or {}).get("legal_name") or gst.get("legal_name")
    constitution = (reg or {}).get("constitution") or gst.get("constitution") or ""

    # 3. Udyam
    if udy:
        num = (udy.get("udyam_number") or "").strip().upper()
        if not num:
            f.append(Finding("UDYAM_NUMBER_MISSING", "fail", "Udyam registration number is blank on the certificate", "udyam_certificate"))
        elif not (m := UDYAM_RE.match(num)):
            f.append(Finding("UDYAM_FORMAT", "fail", "Udyam number is not in UDYAM-XX-00-0000000 format", "udyam_certificate"))
        else:
            ureg = lookup_udyam(num)
            if not ureg:
                f.append(Finding("UDYAM_NOT_FOUND", "fail", f"Udyam {mask(num, 9, 3)} not found in the Udyam registry", "udyam_certificate"))
            else:
                f.append(Finding("UDYAM_FOUND", "pass", f"Udyam registered as {ureg['enterprise_type']} enterprise", "udyam_certificate"))
                if name_similarity(udy.get("enterprise_name"), ureg["enterprise_name"]) < 0.85:
                    f.append(Finding("UDYAM_NAME_MISMATCH", "fail", "Enterprise name on certificate does not match the Udyam registry", "udyam_certificate"))
                if business_name and name_similarity(ureg["enterprise_name"], business_name) < 0.85 \
                        and name_similarity(ureg["enterprise_name"], legal_name) < 0.85:
                    f.append(Finding("UDYAM_GST_MISMATCH", "fail",
                                     f"Udyam enterprise ('{ureg['enterprise_name']}') is a different business from the GST certificate ('{business_name}')",
                                     "udyam_certificate"))
            if UDYAM_STATE_CODES.get(m.group(1)) and udy.get("state") and UDYAM_STATE_CODES[m.group(1)] != udy["state"]:
                f.append(Finding("UDYAM_STATE_MISMATCH", "warn", "Udyam number state code differs from the state on the certificate", "udyam_certificate"))
        if business_name and udy.get("enterprise_name") and name_similarity(udy["enterprise_name"], business_name) < 0.85 \
                and name_similarity(udy["enterprise_name"], legal_name) < 0.85 \
                and not any(x.code == "UDYAM_GST_MISMATCH" for x in f):
            f.append(Finding("UDYAM_GST_MISMATCH", "fail", "Udyam certificate is for a different business than the GST certificate", "udyam_certificate"))

    # 4. Signatory ID
    if sig:
        if business_name and sig.get("for_business") and name_similarity(sig["for_business"], business_name) < 0.85 \
                and name_similarity(sig["for_business"], legal_name) < 0.85:
            f.append(Finding("SIGNATORY_BUSINESS_MISMATCH", "fail",
                             f"Signatory ID is issued for '{sig['for_business']}', not this business", "signatory_id"))
        valid_till = _parse_date(sig.get("valid_till"))
        if sig.get("valid_till") and not valid_till:
            f.append(Finding("SIGNATORY_DATE_UNREADABLE", "warn", "Could not read the ID validity date", "signatory_id"))
        elif valid_till and valid_till < today:
            f.append(Finding("SIGNATORY_ID_EXPIRED", "fail", f"Signatory ID expired on {valid_till}", "signatory_id"))
        elif valid_till:
            f.append(Finding("SIGNATORY_ID_VALID", "pass", "Signatory ID is within validity", "signatory_id"))
        # Proprietorship: signatory should be the proprietor named in the legal name
        if "propriet" in constitution.lower() and sig.get("name") and legal_name:
            prop = re.split(r"\(", legal_name)[0]
            if name_similarity(sig["name"], prop) < 0.85:
                f.append(Finding("SIGNATORY_NOT_PROPRIETOR", "fail",
                                 f"For a proprietorship the signatory must be the proprietor ({prop.strip()}), not {sig['name']}",
                                 "signatory_id"))

    # 5. Address proof
    if adr:
        bill_date = _parse_date(adr.get("bill_date"))
        if not bill_date:
            f.append(Finding("ADDRESS_DATE_MISSING", "fail", "Address proof date could not be read", "address_proof"))
        else:
            age = (today - bill_date).days
            if age > ADDRESS_PROOF_MAX_AGE_DAYS:
                f.append(Finding("ADDRESS_PROOF_OLD", "fail",
                                 f"Address proof is dated {bill_date} ({age} days old; must be within {ADDRESS_PROOF_MAX_AGE_DAYS} days)",
                                 "address_proof"))
            elif age < 0:
                f.append(Finding("ADDRESS_PROOF_FUTURE", "fail", f"Address proof is dated in the future ({bill_date})", "address_proof"))
            else:
                f.append(Finding("ADDRESS_PROOF_RECENT", "pass", f"Address proof is {age} days old", "address_proof"))
        if business_name and adr.get("billed_to") and name_similarity(adr["billed_to"], business_name) < 0.85 \
                and name_similarity(adr["billed_to"], legal_name) < 0.85:
            f.append(Finding("ADDRESS_NAME_MISMATCH", "fail", f"Address proof is billed to '{adr['billed_to']}', not this business", "address_proof"))
        ref_addr = (reg or {}).get("principal_place_of_business") or gst.get("address")
        if ref_addr and adr.get("address"):
            if _pincode(ref_addr) and _pincode(adr["address"]) and _pincode(ref_addr) != _pincode(adr["address"]):
                f.append(Finding("ADDRESS_MISMATCH", "fail", "Address proof PIN code differs from the GST principal place of business", "address_proof"))
            elif name_similarity(ref_addr, adr["address"]) < 0.8:
                f.append(Finding("ADDRESS_MISMATCH", "warn", "Address proof differs from the GST principal place of business", "address_proof"))
            else:
                f.append(Finding("ADDRESS_MATCH", "pass", "Address matches the GST principal place of business", "address_proof"))

    fails = [x for x in f if x.severity == "fail"]
    warns = [x for x in f if x.severity == "warn"]
    verdict = "rejected" if fails else ("manual_review" if warns else "approved")
    return {
        "verdict": verdict,
        "gstin_active": bool(reg and reg["status"] == "Active"),
        "business_name": business_name,
        "findings": [asdict(x) for x in f],
        "summary": [x.message for x in fails + warns] or ["All checks passed"],
    }
