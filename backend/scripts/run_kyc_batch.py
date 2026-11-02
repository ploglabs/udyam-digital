"""Run every specimen applicant (K01-K12) through extraction + validation.

Writes analysis/kyc_results.json (cached extractions) and prints a verdict table.
Usage: python -m scripts.run_kyc_batch [--refresh]
"""
import json
import sys
from collections import defaultdict
import time
from pathlib import Path

from app.catalogue import DATA_DIR
from app.kyc.extract import extract_document
from app.kyc.validators import validate_application

OUT = Path(__file__).resolve().parents[2] / "analysis" / "kyc_extractions.json"


def main():
    cache = json.loads(OUT.read_text()) if OUT.exists() and "--refresh" not in sys.argv else {}
    files = sorted((DATA_DIR / "kyc_documents").glob("*.png"))
    todo = [f for f in files if f.name not in cache]
    OUT.parent.mkdir(exist_ok=True)
    for f in todo:  # free tier = 5 req/min, so go one by one and back off on 429
        for attempt in range(6):
            try:
                cache[f.name] = extract_document(f.read_bytes())
                break
            except Exception as e:
                if "429" not in str(e) or attempt == 5:
                    raise
                time.sleep(30)
        OUT.write_text(json.dumps(cache, indent=1, ensure_ascii=False))
        print("extracted", f.name, cache[f.name]["doc_type"], file=sys.stderr, flush=True)

    apps, quality = defaultdict(dict), defaultdict(dict)
    for name, res in cache.items():
        apps[name[:3]][res["doc_type"]] = res["fields"]
        quality[name[:3]][res["doc_type"]] = res["quality_issues"]
    report = {}
    for k in sorted(apps):
        v = validate_application(apps[k], quality=quality[k])
        notes = [f"{n}: {q}" for n, r in cache.items() if n.startswith(k) for q in r["quality_issues"]]
        report[k] = {**v, "ocr_notes": notes}
        print(f"\n{k}  {v['verdict'].upper()}  ({v['business_name']})")
        for s in v["summary"]:
            print("   -", s)
    (OUT.parent / "kyc_report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
