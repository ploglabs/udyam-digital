"""Mock GSTIN / Udyam registry lookups backed by the provided CSVs."""
from __future__ import annotations

import csv
from functools import lru_cache

from .catalogue import DATA_DIR


@lru_cache
def gstin_registry() -> dict[str, dict]:
    with open(DATA_DIR / "mock_gstin_registry.csv", newline="") as f:
        return {r["gstin"]: r for r in csv.DictReader(f)}


@lru_cache
def udyam_registry() -> dict[str, dict]:
    with open(DATA_DIR / "mock_udyam_registry.csv", newline="") as f:
        return {r["udyam_number"]: r for r in csv.DictReader(f)}


def lookup_gstin(gstin: str) -> dict | None:
    return gstin_registry().get(gstin.strip().upper())


def lookup_udyam(udyam: str) -> dict | None:
    return udyam_registry().get(udyam.strip().upper())


def mask(value: str | None, keep_start: int = 4, keep_end: int = 3) -> str:
    """Mask identifiers for UI and logs: 32TTNXB7384T1ZW -> 32TT********1ZW."""
    if not value:
        return ""
    if len(value) <= keep_start + keep_end:
        return "*" * len(value)
    return value[:keep_start] + "*" * (len(value) - keep_start - keep_end) + value[-keep_end:]
