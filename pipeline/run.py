"""Orkestrator pipeline IDX Insight (PRD Bagian 11).

Alur: ambil data -> validasi -> indikator -> skor/sinyal -> simulasi -> evaluasi -> tulis JSON.

Jalankan dari akar repo:
    python -m pipeline.run              # replay historis + hari terakhir
    python -m pipeline.run --no-replay  # hanya hari terakhir (simulasi mulai dari nol)

Catatan harga: indikator dihitung dari harga disesuaikan (adjusted), sedangkan level entry/stop/target,
harga di chart, dan seluruh eksekusi simulasi memakai harga mentah (PRD 7.1).
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

from . import config, data, evaluate, indicators, scoring, sim

WIB = timezone(timedelta(hours=7))
OUT = config.DATA_DIR

# Bidang snapshot yang harus dikembalikan ke skala harga mentah.
PRICE_FIELDS = ("close", "atr", "ema20", "ema50", "ema200", "sma50", "sma200", "macd", "macd_signal",
                "macd_hist", "bb_upper", "bb_mid", "bb_lower", "swing_high", "swing_low",
                "high_52w", "low_52w", "value_avg20")


# ---------------------------------------------------------------- util
def _num(v):
    """float aman-JSON: NaN/inf -> None."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return v
    return None if (math.isnan(f) or math.isinf(f)) else f


def _row_to_snap(rec: dict, date: str, scale: float = 1.0) -> dict:
    snap = {k: _num(v) for k, v in rec.items()}
    if scale and scale != 1.0:
        for k in PRICE_FIELDS:
            if snap.get(k) is not None:
                snap[k] = snap[k] * scale
    snap["date"] = date
    if snap.get("close") and snap.get("high_52w") and snap.get("low_52w"):
        snap["pivots"] = indicators.pivots(snap["high_52w"], snap["low_52w"], snap["close"])
    else:
        snap["pivots"] = {}
    return snap


def dump(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def dump_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")


def engine_cfg(cfg: dict) -> dict:
    """Parameter mesin simulasi = sim.yaml + ambang keluar di scoring.yaml."""
    sm, sc = cfg["sim"], cfg["scoring"]
    return {
        "price_fraction": sm["price_fraction"], "lot_size": sm["lot_size"], "slippage": sm["slippage"],
        "fee": sm["fee"], "settlement_days": sm["settlement_days"], "risk_per_trade": sm["risk_per_trade"],
        "ara_arb": sm["ara_arb"], "exit_score": sc["signal"]["exit_score"],
        "max_hold_days": sc["levels"]["max_hold_days"], "params_version": sm["params_version"],
    }


def _trend_label(stack) -> str:
    if stack is None:
        return "tidak tersedia"
    return "Naik" if stack >= 2 else ("Turun" if stack <= -2 else "Sideways")


def _regime_at(rec: dict) -> str:
    c, e50, e200 = rec.get("close"), rec.get("ema50"), rec.get("ema200")
    if not c or not e50 or not e200:
        return "Netral"
    if c > e50 > e200:
        return "Risk-on"
    if c < e50 < e200:
        return "Risk-off"
    return "Netral"


def _median(values):
    xs = sorted(v for v in values if v is not None)
    if not xs:
        return None
    n = len(xs)
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2


# ---------------------------------------------------------------- skor
class Scorer:
    """Skor satu snapshot. `use_fund=False` untuk replay historis (fundamental hari ini = look-ahead)."""

    def __init__(self, cfg: dict, filters: dict):
        self.cfg, self.filters = cfg, filters

    def score(self, snap: dict, fund: dict, regime_state: str, use_fund: bool = True) -> dict:
        f = scoring.factor_scores(snap, fund, self.cfg["scoring"])
        if not use_fund:
            f["fundamental"] = {k: {**v, "score": None, "value": None} for k, v in f["fundamental"].items()}
        comp = scoring.composite(f, self.cfg["scoring"])
        lv = scoring.levels(snap, self.cfg["scoring"])
        liquid = (snap.get("value_avg20") or 0) >= self.filters["min_avg_value_20d"]
        sg = scoring.signal_for(comp["total"], regime_state, liquid, lv.get("rr"), self.cfg["scoring"])
        return {"total": comp["total"], "categories": comp["categories"], "factors": f, "levels": lv,
                "signal": sg["signal"], "signal_reasons": sg["reasons"], "liquid": liquid,
                "contributions": scoring.contributions(f, self.cfg["scoring"])}


# ---------------------------------------------------------------- simulasi
def run_sim(cfg: dict, codes: list[str], bench_series: pd.DataFrame, frames: dict, series: dict,
            scales: dict, scorer: Scorer, fund: dict, use_replay: bool) -> dict:
    """Jalankan mesin simulasi untuk Akun A & B. Kembalikan ringkasan per akun."""
    sm = cfg["sim"]
    e_cfg = engine_cfg(cfg)
    netral_f = cfg["scoring"]["regime"]["netral_position_factor"]
    dates = [str(pd.Timestamp(i).date()) for i in bench_series.index]
    brows = bench_series.to_dict("records")

    rec_rows = {c: series[c].to_dict("records") for c in codes}
    rec_pos = {c: {str(pd.Timestamp(i).date()): n for n, i in enumerate(series[c].index)} for c in codes}
    bar_days = {c: {str(pd.Timestamp(i).date()) for i in frames[c].index} for c in codes}
    scale_of = {c: {str(pd.Timestamp(i).date()): float(v) for i, v in scales[c].items()} for c in codes}

    replay_from = sm.get("replay_from") if use_replay else None
    start = len(dates) - 1
    if replay_from:
        idx = [i for i, d in enumerate(dates) if d >= replay_from]
        if idx:
            start = idx[0]

    cache: dict[tuple, dict | None] = {}

    def rec_for(code: str, day: str, regime_state: str, use_fund: bool):
        key = (code, day, use_fund)
        if key in cache:
            return cache[key]
        n = rec_pos[code].get(day)
        if n is None:
            cache[key] = None
            return None
        s = scorer.score(_row_to_snap(rec_rows[code][n], day, scale_of[code].get(day, 1.0)),
                         fund[code], regime_state, use_fund)
        cache[key] = s
        return s

    summary = {}
    for acc_key in sm["accounts"]:
        acc_cfg = sm["accounts"][acc_key]
        state = sim.new_state(acc_key, acc_cfg, sm["params_version"])
        equity_rows, trade_rows, order_rows = [], [], []
        for i in range(start, len(dates)):
            day, live = dates[i], i == len(dates) - 1
            regime_state = _regime_at(brows[i])
            bars, recs = {}, {}
            for c in codes:
                if day in bar_days[c]:
                    r = frames[c].loc[day]
                    bars[c] = {"open": float(r["open"]), "high": float(r["high"]),
                               "low": float(r["low"]), "close": float(r["close"])}
                s = rec_for(c, day, regime_state, use_fund=live)
                if s and s["total"] is not None:
                    lv = s["levels"]
                    recs[c] = {"code": c, "score": s["total"], "signal": s["signal"],
                               "entry_est": lv.get("entry"), "stop": lv.get("stop"), "target": lv.get("target")}
            if i + 1 < len(dates):
                nxt = dates[i + 1]
            else:
                d = bench_series.index[i] + pd.Timedelta(days=1)
                while d.weekday() >= 5:
                    d += pd.Timedelta(days=1)
                nxt = d.strftime("%Y-%m-%d")
            state["phase"] = "live" if live else "replay"
            log = sim.step(state, day, nxt, bars, recs, e_cfg, acc_cfg, regime_state, netral_f)
            equity_rows.append({"date": day, "equity": log["equity"], "cash": log["cash"],
                                "n_positions": log["n_positions"], "ihsg": float(brows[i]["close"]),
                                "phase": state["phase"]})
            trade_rows += log["trades"]
            order_rows += log["orders"]

        base = equity_rows[0]["ihsg"] if equity_rows else None
        for r in equity_rows:
            r["ihsg_norm"] = round(r["ihsg"] / base * 100, 2) if base else None
            r["equity_norm"] = round(r["equity"] / acc_cfg["initial_cash"] * 100, 2)
        final = equity_rows[-1]["equity"] if equity_rows else acc_cfg["initial_cash"]
        p = OUT / "sim" / acc_key
        state_out = {**state, "account": acc_key, "label": acc_cfg["label"],
                     "initial_cash": acc_cfg["initial_cash"], "max_positions": acc_cfg["max_positions"],
                     "position_size_pct": acc_cfg["max_weight_per_stock"], "equity": final,
                     "return_pct": round((final / acc_cfg["initial_cash"] - 1) * 100, 2),
                     "replay_from": replay_from, "last_update": dates[-1] if dates else None}
        dump(p / "state.json", state_out)
        dump_jsonl(p / "orders.jsonl", order_rows)
        dump_jsonl(p / "trades.jsonl", trade_rows)
        dump_jsonl(p / "equity.jsonl", equity_rows)
        summary[acc_key] = {"state": state_out, "equity": equity_rows, "trades": trade_rows,
                            "orders": order_rows, "account": acc_cfg}
    return summary


# ---------------------------------------------------------------- utama
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Pipeline IDX Insight")
    ap.add_argument("--no-replay", action="store_true", help="lewati replay historis")
    args = ap.parse_args(argv)

    cfg = config.load()
    codes = config.tickers(cfg)
    filters = cfg["universe"]["filters"]
    params_version = cfg["scoring"]["params_version"]
    started = datetime.now(WIB)
    messages: list[str] = []

    try:
        bench_code = cfg["universe"]["benchmark"]
        raw = data.download(codes + [bench_code], period="5y")
        split = data.frames(raw, codes + [bench_code])
        if bench_code not in split:
            raise RuntimeError("data benchmark IHSG tidak tersedia")
        bench_raw = split[bench_code]
        bench_last = bench_raw.index[-1]

        issues, ok_frames = [], {}
        for c in codes:
            df = split.get(c)
            if df is None:
                issues.append({"code": c, "level": "error", "msg": "tidak ada data"})
                continue
            iss = data.validate(df, c, bench_last, filters["min_history_days"], filters["max_stale_days"])
            issues += iss
            if not any(i["level"] == "error" for i in iss):
                ok_frames[c] = df
        if len(ok_frames) < max(3, len(codes) * 0.7):
            raise RuntimeError(f"terlalu banyak saham gagal validasi ({len(ok_frames)}/{len(codes)} lolos)")

        bench = data.adjusted(bench_raw)
        bench_series = indicators.snapshot_series(bench)
        adj = {c: data.adjusted(df) for c, df in ok_frames.items()}
        series = {c: indicators.snapshot_series(adj[c], bench) for c in adj}
        scales = {c: (ok_frames[c]["close"] / adj[c]["close"]).ffill().fillna(1.0) for c in adj}
        closes = {c: float(ok_frames[c]["close"].iloc[-1]) for c in ok_frames}
        fund = data.fundamentals_many(list(ok_frames), closes)
        bench_snap = indicators.snapshot(bench)
        reg = scoring.regime(bench_snap)

        medians = {k: _median([fund[c].get(k) for c in fund])
                   for k in ("per", "pbv", "roe", "der", "eps_growth", "dividend_yield")}
        scorer = Scorer(cfg, filters)
        last_date = str(pd.Timestamp(bench_last).date())

        rows, latest_items = [], []
        for c in ok_frames:
            recs = series[c].to_dict("records")
            rdates = [str(pd.Timestamp(i).date()) for i in series[c].index]
            scale_last = float(scales[c].iloc[-1])
            snap = _row_to_snap(recs[-1], last_date, scale_last)
            s = scorer.score(snap, fund[c], reg["state"], use_fund=True)
            prev = scorer.score(_row_to_snap(recs[-2], rdates[-2], float(scales[c].iloc[-2])),
                                fund[c], reg["state"]) if len(recs) > 1 else None
            delta = None if (prev is None or prev["total"] is None or s["total"] is None) \
                else round(s["total"] - prev["total"], 2)
            chg = round((snap["close"] / float(ok_frames[c]["close"].iloc[-2]) - 1) * 100, 2) \
                if len(ok_frames[c]) > 1 else None

            rows.append({
                "code": c, "name": fund[c]["name"], "sector": fund[c]["sector"], "price": snap["close"],
                "change_pct": chg, "score": s["total"], "score_delta": delta,
                "scores": {k: v["score"] for k, v in s["categories"].items()}, "signal": s["signal"],
                "rsi": snap.get("rsi"), "trend": _trend_label(snap.get("ema_stack")),
                "volume_ratio": snap.get("volume_ratio"), "per": fund[c]["per"], "pbv": fund[c]["pbv"],
                "roe": fund[c]["roe"], "der": fund[c]["der"], "atr_pct": snap.get("atr_pct"),
                "rr": s["levels"].get("rr"), "entry": s["levels"].get("entry"), "stop": s["levels"].get("stop"),
                "target": s["levels"].get("target"), "value_avg20": snap.get("value_avg20"),
                "liquid": s["liquid"],
            })

            # riwayat sinyal: return aktual 5/10/20 hari bursa setelah sinyal Beli (harga mentah)
            close_raw = ok_frames[c]["close"].astype(float)
            hist, scan_from = [], max(len(rdates) - 320, 250)
            for i in range(scan_from, len(rdates)):
                sd = scorer.score(_row_to_snap(recs[i], rdates[i], float(scales[c].iloc[i])),
                                  fund[c], _regime_at(recs[i]), use_fund=False)
                if sd["signal"] != "Beli":
                    continue
                fut = {}
                for h in (5, 10, 20):
                    if i + h < len(close_raw):
                        fut[f"ret{h}"] = round((float(close_raw.iloc[i + h]) / float(close_raw.iloc[i]) - 1) * 100, 2)
                hist.append({"date": rdates[i], "score": sd["total"], "entry": sd["levels"].get("entry"),
                             "stop": sd["levels"].get("stop"), "target": sd["levels"].get("target"), **fut})
            hist = hist[-12:]

            dump(OUT / "indicators" / f"{c}.json", {
                "code": c, "name": fund[c]["name"], "sector": fund[c]["sector"], "industry": fund[c]["industry"],
                "date": last_date, "price": snap["close"], "score": s["total"], "signal": s["signal"],
                "signal_reasons": s["signal_reasons"], "categories": s["categories"], "factors": s["factors"],
                "levels": s["levels"], "contributions": s["contributions"], "fundamentals": fund[c],
                "medians": medians, "snapshot": snap, "signal_history": hist, "params_version": params_version,
                "risk": {k: snap.get(k) for k in ("atr", "atr_pct", "vol20", "vol60", "dd_1y", "beta",
                                                  "corr_ihsg", "value_avg20", "high_52w", "low_52w",
                                                  "dist_high_52w", "swing_high", "swing_low", "pivots")},
                "explanation": scoring.explain(c, fund[c]["name"], s["total"], s["signal"], s["signal_reasons"],
                                               snap, fund[c], s["contributions"], s["levels"], reg),
            })
            dump(OUT / "prices" / f"{c}.json", indicators.chart_series(ok_frames[c], adj[c], bench))

        rows.sort(key=lambda r: -(r["score"] or 0))
        dump(OUT / "universe.json", {"date": last_date, "benchmark": cfg["universe"]["benchmark_label"],
                                     "regime": reg, "params_version": params_version,
                                     "params": {
                                         "categories": [{"key": k, "label": v["label"], "weight": v["weight"]}
                                                        for k, v in cfg["scoring"]["categories"].items()],
                                         "signal": cfg["scoring"]["signal"],
                                         "levels": cfg["scoring"]["levels"],
                                         "risk_per_trade": cfg["sim"]["risk_per_trade"],
                                         "fees": cfg["sim"]["fee"],
                                         "slippage": cfg["sim"]["slippage"],
                                         "lot_size": cfg["sim"]["lot_size"],
                                     },
                                     "rows": rows, "count": len(rows)})

        top = [r for r in rows if r["signal"] == "Beli"][:10]
        latest_items = [{"code": r["code"], "name": r["name"], "sector": r["sector"], "score": r["score"],
                         "signal": r["signal"], "entry": r["entry"], "stop": r["stop"], "target": r["target"],
                         "rr": r["rr"], "price": r["price"], "change_pct": r["change_pct"]} for r in top]
        latest = {"date": last_date, "params_version": params_version, "regime": reg, "items": latest_items,
                  "n_buy": sum(1 for r in rows if r["signal"] == "Beli"),
                  "n_hold": sum(1 for r in rows if r["signal"] == "Tahan"),
                  "n_avoid": sum(1 for r in rows if r["signal"] == "Hindari")}
        dump(OUT / "signals" / "latest.json", latest)

        hist_path = OUT / "signals" / "history.jsonl"
        if not hist_path.exists() or last_date not in hist_path.read_text(encoding="utf-8")[-4000:]:
            with hist_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps({"date": last_date, "params_version": params_version,
                                     "regime": reg["state"], "items": latest_items},
                                    ensure_ascii=False, separators=(",", ":")) + "\n")
            messages.append("rekomendasi dicatat permanen ke signals/history.jsonl")

        summary = run_sim(cfg, list(ok_frames), bench_series, ok_frames, series, scales, scorer, fund,
                          use_replay=not args.no_replay)

        scorecard = {"params_version": params_version, "date": last_date, "accounts": {}}
        for acc_key, sm_ in summary.items():
            init = sm_["account"]["initial_cash"]
            m_all = evaluate.metrics(sm_["trades"], sm_["equity"], init)
            m_live = evaluate.metrics([t for t in sm_["trades"] if t.get("phase") == "live"],
                                      [r for r in sm_["equity"] if r.get("phase") == "live"], init)
            scorecard["accounts"][acc_key] = {
                "label": sm_["account"]["label"], "initial_cash": init,
                "basis": "replay historis (in-sample) + real-time" if sm_["state"]["replay_from"] else "real-time",
                "replay_note": cfg["sim"].get("replay_note"), "all": m_all, "live": m_live,
                "verdict": evaluate.verdict(m_live, cfg["sim"]["scorecard"]),
            }
        dump(OUT / "eval" / "scorecard.json", scorecard)
        dump(OUT / "sim" / "portfolio.json", {
            "date": last_date, "params_version": params_version,
            "accounts": {k: {"state": v["state"], "equity": v["equity"], "trades": v["trades"],
                             "orders": v["orders"][-40:]} for k, v in summary.items()},
            "scorecard": scorecard["accounts"],
        })

        n_err = sum(1 for i in issues if i["level"] == "error")
        n_warn = sum(1 for i in issues if i["level"] == "warn")
        dump(OUT / "meta.json", {
            "as_of": last_date, "run_at": started.isoformat(timespec="seconds"),
            "duration_s": round((datetime.now(WIB) - started).total_seconds(), 1),
            "status": "ok" if n_err == 0 else "warn", "params_version": params_version,
            "universe_total": len(codes), "universe_ok": len(ok_frames), "regime": reg,
            "benchmark": {"label": cfg["universe"]["benchmark_label"], "close": bench_snap.get("close"),
                          "change_pct": round((bench_snap["close"] / float(bench_raw["close"].iloc[-2]) - 1) * 100, 2),
                          "ema50": bench_snap.get("ema50"), "ema200": bench_snap.get("ema200")},
            "issues": issues[:80], "n_errors": n_err, "n_warnings": n_warn, "messages": messages,
            "data_note": "Data EOD Yahoo Finance (pemakaian pribadi), dapat tertunda ±10 menit.",
            "pipeline_order": ["ambil data", "validasi", "indikator", "skor & sinyal", "simulasi",
                               "evaluasi", "tulis JSON"],
        })

        print(f"OK {last_date} · {len(ok_frames)}/{len(codes)} saham · Beli {latest['n_buy']} · "
              f"rezim {reg['state']} · {n_err} error, {n_warn} peringatan")
        for acc_key, sc in scorecard["accounts"].items():
            a = sc["all"]
            print(f"  Akun {acc_key} ({sc['basis']}): Rp{a['final_equity']:,.0f} "
                  f"({a['total_return_pct']}% vs IHSG {a['benchmark_return_pct']}%) · "
                  f"{a['n_trades']} transaksi · verdict: {sc['verdict']['status']}")
        return 0

    except Exception as exc:  # noqa: BLE001 - pipeline harus menandai kegagalan, bukan diam
        traceback.print_exc()
        dump(OUT / "meta.json", {
            "as_of": None, "run_at": started.isoformat(timespec="seconds"), "status": "gagal",
            "error": f"{type(exc).__name__}: {exc}", "params_version": params_version,
            "messages": ["Pipeline berhenti: tidak ada rekomendasi baru yang dibuat dari data yang gagal validasi."],
        })
        print(f"GAGAL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())