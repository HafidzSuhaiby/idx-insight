"""Evaluasi akurasi (PRD Bagian 9): metrik sistem vs IHSG dan kriteria kelayakan."""
from __future__ import annotations

import math

TRADING_DAYS = 252


def _pct(a: float, b: float) -> float | None:
    return None if not b else (a / b - 1) * 100


def _stats(xs: list[float]) -> tuple[float | None, float | None]:
    if len(xs) < 2:
        return None, None
    mean = sum(xs) / len(xs)
    var = sum((x - mean) ** 2 for x in xs) / (len(xs) - 1)
    return mean, math.sqrt(var)


def metrics(trades: list[dict], curve: list[dict], initial_cash: float) -> dict:
    """trades: catatan transaksi tertutup. curve: [{date, equity, ihsg}] urut tanggal."""
    eq = [c["equity"] for c in curve]
    days = len(curve)
    final = eq[-1] if eq else initial_cash
    rets = [eq[i] / eq[i - 1] - 1 for i in range(1, len(eq)) if eq[i - 1]]
    mean, sd = _stats(rets)
    downside = [r for r in rets if r < 0]
    _, dsd = _stats(downside)

    pnls = [t["pnl"] for t in trades]
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    rs = [t["r_multiple"] for t in trades if t.get("r_multiple") is not None]

    ihsg0 = curve[0]["ihsg"] if curve else None
    ihsg1 = curve[-1]["ihsg"] if curve else None
    bench_ret = _pct(ihsg1, ihsg0)
    total_ret = _pct(final, initial_cash)
    peak, mdd = -math.inf, 0.0
    for e in eq:
        peak = max(peak, e)
        if peak > 0:
            mdd = min(mdd, (e / peak - 1) * 100)

    by_score: dict[str, list[float]] = {}
    for t in trades:
        s = t.get("score_at_entry")
        if s is None:
            continue
        b = "<50" if s < 50 else ("50-59" if s < 60 else ("60-69" if s < 70 else "70+"))
        by_score.setdefault(b, []).append(t["return_pct"])

    return {
        "days": days,
        "n_trades": len(trades),
        "initial_cash": initial_cash,
        "final_equity": round(final, 2),
        "total_return_pct": None if total_ret is None else round(total_ret, 2),
        "annualized_return_pct": round(((final / initial_cash) ** (TRADING_DAYS / days) - 1) * 100, 2)
        if days >= 126 and initial_cash else None,
        "benchmark_return_pct": None if bench_ret is None else round(bench_ret, 2),
        "excess_return_pct": None if (total_ret is None or bench_ret is None) else round(total_ret - bench_ret, 2),
        "max_drawdown_pct": round(mdd, 2),
        "sharpe": None if (mean is None or not sd) else round(mean / sd * math.sqrt(TRADING_DAYS), 2),
        "sortino": None if (mean is None or not dsd) else round(mean / dsd * math.sqrt(TRADING_DAYS), 2),
        "profit_factor": round(sum(wins) / abs(sum(losses)), 2) if losses else None,
        "hit_rate_pct": round(len(wins) / len(pnls) * 100, 1) if pnls else None,
        "avg_win_pct": round(sum(t["return_pct"] for t in trades if t["pnl"] > 0) / len(wins), 2) if wins else None,
        "avg_loss_pct": round(sum(t["return_pct"] for t in trades if t["pnl"] <= 0) / len(losses), 2) if losses else None,
        "expectancy_r": round(sum(rs) / len(rs), 2) if rs else None,
        "avg_holding_days": round(sum(t["bars_held"] for t in trades) / len(trades), 1) if trades else None,
        "turnover_x": round(sum(t["cost_total"] for t in trades) / (sum(eq) / len(eq)), 2) if trades and eq else None,
        "robust_without_best": (round(sum(pnls) - max(pnls), 2) if pnls else None),
        "exit_reasons": {k: sum(1 for t in trades if t["reason"].startswith(k))
                         for k in ("stop", "target", "skor", "batas")} if trades else {},
        "calibration": {k: {"n": len(v), "avg_return_pct": round(sum(v) / len(v), 2)} for k, v in sorted(by_score.items())},
    }


def verdict(m: dict, sc: dict) -> dict:
    """Status 'Layak' hanya bila semua kriteria terpenuhi; selebihnya jujur 'Belum layak'."""
    if m["days"] < sc["min_days"] or m["n_trades"] < sc["min_trades"]:
        return {"status": "Data belum cukup",
                "note": f"butuh >= {sc['min_days']} hari bursa dan >= {sc['min_trades']} transaksi "
                        f"(sekarang {m['days']} hari, {m['n_trades']} transaksi)",
                "checks": {}}
    checks = {
        "return_neto_lebih_tinggi_dari_ihsg": (m["excess_return_pct"] or -1) > 0,
        "profit_factor_min": (m["profit_factor"] or 0) >= sc["min_profit_factor"],
        "drawdown_maks": m["max_drawdown_pct"] >= -sc["max_drawdown"],
        "expectancy_positif": (m["expectancy_r"] or 0) > 0,
        "tidak_bergantung_satu_transaksi": (m["robust_without_best"] or 0) > 0,
    }
    ok = all(checks.values())
    return {"status": "Layak" if ok else "Belum layak",
            "note": "Semua kriteria terpenuhi. Lolos kriteria pun tidak menjamin hasil di masa depan."
            if ok else "Jangan dipakai dengan uang asli sampai semua kriteria terpenuhi.",
            "checks": checks}