"""Pemuatan konfigurasi IDX Insight. Semua parameter ada di /config, tidak ada yang hardcode."""
from __future__ import annotations

import json
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "web" / "public" / "data"


def _yaml(name: str) -> dict:
    return yaml.safe_load((CONFIG_DIR / name).read_text(encoding="utf-8"))


def _json(name: str) -> dict:
    return json.loads((CONFIG_DIR / name).read_text(encoding="utf-8"))


def load() -> dict:
    """Kembalikan seluruh konfigurasi dalam satu dict: universe, scoring, sim, blacklist."""
    return {
        "universe": _yaml("universe.yaml"),
        "scoring": _yaml("scoring.yaml"),
        "sim": _yaml("sim.yaml"),
        "blacklist": _json("blacklist.json"),
    }


def tickers(cfg: dict) -> list[str]:
    """Kode saham yang dipantau, sudah dibersihkan dari blacklist."""
    blocked = set(cfg["blacklist"].get("blocked", []))
    codes = [c.upper() for c in cfg["universe"]["lq45"]] + [c.upper() for c in cfg["universe"].get("watchlist") or []]
    seen, out = set(), []
    for c in codes:
        if c not in seen and c not in blocked:
            seen.add(c)
            out.append(c)
    return out
