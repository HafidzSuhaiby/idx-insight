"""Uji ujung-ke-ujung pipeline pada 3 saham (butuh internet + yfinance).

Jalankan: python tests/test_pipeline.py
Menulis ke direktori sementara, tidak mengganggu web/public/data.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pipeline import config, run  # noqa: E402


def main() -> int:
    cfg = config.load()
    codes = config.tickers(cfg)[:3]
    config.tickers = lambda c: codes              # batasi universe agar cepat
    tmp = Path(tempfile.mkdtemp(prefix="idx-insight-test-"))
    run.OUT = tmp
    rc = run.main([])
    assert rc == 0, f"pipeline keluar dengan kode {rc}"

    meta = json.loads((tmp / "meta.json").read_text(encoding="utf-8"))
    assert meta["status"] in ("ok", "warn"), meta
    assert meta["universe_ok"] == 3, meta

    uni = json.loads((tmp / "universe.json").read_text(encoding="utf-8"))
    assert len(uni["rows"]) == 3, len(uni["rows"])
    for r in uni["rows"]:
        assert r["signal"] in ("Beli", "Tahan", "Hindari"), r
        assert r["score"] is None or 0 <= r["score"] <= 100, r
        assert r["price"] and r["price"] > 0, r
        assert (tmp / "indicators" / f"{r['code']}.json").exists()
        assert (tmp / "prices" / f"{r['code']}.json").exists()
    assert (tmp / "signals" / "latest.json").exists()
    assert (tmp / "signals" / "history.jsonl").exists()

    card = json.loads((tmp / "eval" / "scorecard.json").read_text(encoding="utf-8"))
    for acc in ("A", "B"):
        assert acc in card["accounts"], card
        m = card["accounts"][acc]["all"]
        assert m["days"] > 0 and m["final_equity"] > 0, m
        assert card["accounts"][acc]["verdict"]["status"] in ("Layak", "Belum layak", "Data belum cukup")

    chart = json.loads((tmp / "prices" / f"{uni['rows'][0]['code']}.json").read_text(encoding="utf-8"))
    assert len(chart["dates"]) == len(chart["close"]) > 100
    assert chart["close"][-1] == round(uni["rows"][0]["price"]) or chart["close"][-1] > 0

    print(f"LULUS · {meta['as_of']} · {meta['universe_ok']} saham · "
          f"Akun B: {card['accounts']['B']['verdict']['status']} · output di {tmp}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())