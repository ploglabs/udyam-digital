"""Gemini client with simple key fallback (rotates to the next key on quota/rate errors)."""
from __future__ import annotations

import itertools
import os
from pathlib import Path

from google import genai

_ENV = Path(__file__).resolve().parents[1] / ".env"


def _load_env() -> None:
    if _ENV.exists():
        for line in _ENV.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


_load_env()
MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
_KEYS = [k for k in os.environ.get("GEMINI_API_KEYS", "").split(",") if k]
_clients = [genai.Client(api_key=k) for k in _KEYS]
_cycle = itertools.cycle(range(len(_clients))) if _clients else None


def generate(contents, config=None, model: str = MODEL):
    if not _clients:
        raise RuntimeError("GEMINI_API_KEYS not set")
    last = None
    for _ in range(len(_clients)):
        client = _clients[next(_cycle)]
        try:
            return client.models.generate_content(model=model, contents=contents, config=config)
        except Exception as e:  # rotate on 429 / 5xx, re-raise others
            msg = str(e)
            if any(s in msg for s in ("429", "RESOURCE_EXHAUSTED", "503", "500", "UNAVAILABLE")):
                last = e
                continue
            raise
    raise last
