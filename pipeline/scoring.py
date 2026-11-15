"""Skor komposit, sinyal, level risiko, rezim pasar, dan penjelasan berbasis template.

Deterministik: tidak ada LLM yang menghitung angka di sini (PRD Prinsip Produk).
Semua bobot/ambang dibaca dari config/scoring.yaml.
"""
from __future__ import annotations

import numpy as np


def interp(points: list, value: float) -> float:
    """Interpolasi linear kurva [[nilai, skor], ...]; dijepit di ujung kurva."""
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return float(np.clip(np.interp(value, xs, ys), 0, 100))


def factor_scores(snap: dict, fund: dict, cfg: dict) -> dict:
    """Skor tiap faktor 0-100 per kategori. Faktor tanpa data dibiarkan None."""
    values = {
        "trend": {"ema_stack": snap.get("ema_stack"), "ema50_slope": snap.get("ema50_slope"),
                  "adx": snap.get("adx"), "ma_cross": snap.get("ma_cross")},
        "momentum": {"rsi": snap.get("rsi"), "macd_hist_pct": snap.get("macd_hist_pct"),
                     "stoch": snap.get("stoch_k"), "roc20": snap.get("roc20"), "rs_ihsg": snap.get("rs_ihsg")},
        "volume": {"volume_ratio": snap.get("volume_ratio"), "obv_net": snap.get("obv_net"),
                   "breakout": snap.get("breakout")},
        "risk": {"atr_pct": snap.get("atr_pct"), "vol60": snap.get("vol60"),
                 "mdd_1y": abs(snap["dd_1y"]) if snap.get("dd_1y") is not None else None,
                 "beta": snap.get("beta")},
        "fundamental": {k: fund.get(k) for k in ("per", "pbv", "roe", "der", "eps_growth", "dividend_yield")},
    }
    out = {}
    for cat, spec in cfg["factors"].items():
        out[cat] = {}
        for name, fs in spec.items():
            v = values.get(cat, {}).get(name)
            out[cat][name] = {
                "value": None if v is None else round(float(v), 4),
                "score": None if v is None else round(interp(fs["points"], float(v)), 2),
                "weight": fs["weight"],
                "desc": fs["desc"],
            }
    return out


def composite(scores: dict, cfg: dict) -> dict:
    """Skor 0-100 per kategori + total. Kategori tanpa data dibagikan ulang bobotnya."""
    cats, available_weight, total = {}, 0.0, 0.0
    for cat, spec in cfg["factors"].items():
        w_sum = sum(f["weight"] for f in scores[cat].values() if f["score"] is not None)
        if w_sum == 0:
            cats[cat] = {"score": None, "weight": cfg["categories"][cat]["weight"], "label": cfg["categories"][cat]["label"]}
            continue
        s = sum(f["score"] * f["weight"] for f in scores[cat].values() if f["score"] is not None) / w_sum
        cats[cat] = {"score": round(s, 2), "weight": cfg["categories"][cat]["weight"], "label": cfg["categories"][cat]["label"]}
        available_weight += cfg["categories"][cat]["weight"]
        total += s * cfg["categories"][cat]["weight"]
    if available_weight == 0:
        return {"total": None, "categories": cats, "redistributed": []}
    redistributed = [c for c, v in cats.items() if v["score"] is None]
    return {"total": round(total / available_weight, 2), "categories": cats, "redistributed": redistributed}


def contributions(scores: dict, cfg: dict) -> list[dict]:
    """Kontribusi tiap faktor ke skor total, dalam poin skor (relatif terhadap netral 50)."""
    cats = cfg["categories"]
    avail = [c for c in cfg["factors"] if any(f["score"] is not None for f in scores[c].values())]
    denom = sum(cats[c]["weight"] for c in avail) or 1
    out = []
    for cat in avail:
        w_sum = sum(f["weight"] for f in scores[cat].values() if f["score"] is not None)
        for name, f in scores[cat].items():
            if f["score"] is None:
                continue
            share = cats[cat]["weight"] / denom * (f["weight"] / w_sum)
            out.append({
                "factor": name, "category": cat, "label": cats[cat]["label"], "desc": f["desc"],
                "value": f["value"], "score": f["score"],
                "contribution": round(share * (f["score"] - 50) / 50 * cats[cat]["weight"], 2),
            })
    out.sort(key=lambda x: -x["contribution"])
    return out


def regime(bench_snap: dict) -> dict:
    """Risk-on / Netral / Risk-off dari IHSG terhadap EMA50/EMA200 (PRD 7.5)."""
    c, e50, e200 = bench_snap.get("close"), bench_snap.get("ema50"), bench_snap.get("ema200")
    if not c or not e50 or not e200:
        return {"state": "Netral", "note": "data benchmark tidak lengkap"}
    if c > e50 > e200:
        state, note = "Risk-on", "IHSG di atas EMA50, EMA50 di atas EMA200"
    elif c < e50 < e200:
        state, note = "Risk-off", "IHSG di bawah EMA50, EMA50 di bawah EMA200"
    else:
        state, note = "Netral", "susunan EMA50/EMA200 belum selaras"
    return {"state": state, "note": note, "close": c, "ema50": e50, "ema200": e200}


def levels(snap: dict, cfg: dict) -> dict:
    """Level entry/stop/target + rasio risiko:imbalan. Entry = estimasi harga penutupan terakhir."""
    lv = cfg["levels"]
    entry = snap.get("close")
    atr = snap.get("atr")
    if not entry or not atr:
        return {"entry": entry, "stop": None, "target": None, "rr": None, "note": "ATR tidak tersedia"}
    stop = entry - lv["stop_atr_mult"] * atr
    if snap.get("swing_low"):
        stop = min(stop, float(snap["swing_low"]))
    risk = entry - stop
    if risk <= 0:
        return {"entry": entry, "stop": None, "target": None, "rr": None, "note": "jarak stop tidak valid"}
    target = entry + lv["target_rr"] * risk
    # dibatasi resistance terdekat (pivot R1 / high 52 minggu) yang masih di atas entry
    res = [r for r in (snap.get("pivots", {}).get("r1"), snap.get("high_52w")) if r and r > entry * 1.02]
    capped = False
    if res:
        nearest = min(res)
        if nearest < target:
            target, capped = nearest, True
    rr = (target - entry) / risk
    return {"entry": round(float(entry), 2), "stop": round(float(stop), 2), "target": round(float(target), 2),
            "rr": round(float(rr), 2), "risk_per_share": round(float(risk), 2), "capped_by_resistance": capped}


def signal_for(total: float | None, regime_state: str, liquid: bool, rr: float | None, cfg: dict) -> dict:
    """Sinyal Beli/Tahan/Hindari beserta alasan penurunan bila ada."""
    sig = cfg["signal"]
    if total is None:
        return {"signal": "Hindari", "reasons": ["skor tidak dapat dihitung"]}
    reasons = []
    if total < sig["hold"]:
        return {"signal": "Hindari", "reasons": [f"skor {total} < {sig['hold']}"]}
    if total < sig["buy"]:
        return {"signal": "Tahan", "reasons": [f"skor {total} di antara {sig['hold']} dan {sig['buy']}"]}
    if regime_state == "Risk-off":
        reasons.append("rezim pasar Risk-off")
    if not liquid:
        reasons.append("tidak lolos filter likuiditas")
    if rr is not None and rr < cfg["levels"]["min_rr"]:
        reasons.append(f"rasio risiko:imbalan {rr} < {cfg['levels']['min_rr']}")
    if reasons:
        return {"signal": "Tahan", "reasons": reasons}
    return {"signal": "Beli", "reasons": [f"skor {total} >= {sig['buy']}, rezim {regime_state}, likuid"]}


def explain(code: str, name: str, total: float, sig: str, sig_reasons: list[str], snap: dict, fund: dict,
            cons: list[dict], lv: dict, reg: dict) -> str:
    """Paragraf penjelasan dari template berdasarkan aturan yang terpenuhi (bukan LLM)."""
    pos = [c for c in cons if c["contribution"] > 0][:3]
    neg = [c for c in cons if c["contribution"] < 0][-3:]

    def fmt(c):
        return f"{c['desc']} ({_val(c['value'])} → skor faktor {c['score']:.0f})"

    def para(items, head):
        return f"{head} " + "; ".join(fmt(c) for c in items) + "." if items else ""

    bits = [f"{code} ({name}) mendapat skor total {total:.0f} dengan sinyal {sig} saat rezim pasar {reg['state']}."]
    if snap.get("ema_stack") is not None:
        arah = "naik" if snap["ema_stack"] > 0 else ("turun" if snap["ema_stack"] < 0 else "campuran")
        bits.append(f"Susunan tren {arah} (keselarasan EMA {int(snap['ema_stack']):+d} dari -4..+4).")
    if snap.get("rsi") is not None:
        bits.append(f"RSI(14) {snap['rsi']:.1f}, ADX(14) {_val(snap.get('adx'))}.")
    if lv.get("stop") and lv.get("target"):
        bits.append(
            f"Level: entry ±{_rp(lv['entry'])}, stop {_rp(lv['stop'])}, target {_rp(lv['target'])} "
            f"(risiko:imbalan 1:{lv['rr']:.1f}, risiko per lembar {_rp(lv['risk_per_share'])})."
            + (" Target dipotong ke resistance terdekat." if lv.get("capped_by_resistance") else "")
        )
    parts = [" ".join(bits), para(pos, "Faktor pendukung: ").strip(), para(neg, "Faktor penentang: ").strip()]
    if sig != "Beli" and sig_reasons:
        parts.append("Alasan sinyal tidak penuh: " + "; ".join(sig_reasons) + ".")
    miss = [k for k in ("per", "pbv", "roe", "der", "eps_growth", "dividend_yield") if fund.get(k) is None]
    if miss:
        parts.append("Fundamental tidak tersedia sebagian (" + ", ".join(miss) + "); bobotnya dibagikan ke kategori lain.")
    return " ".join(p for p in parts if p)


def _val(v) -> str:
    if v is None:
        return "tidak tersedia"
    if isinstance(v, (int, float)):
        return f"{v:,.2f}".rstrip("0").rstrip(".").replace(",", ".")
    return str(v)


def _rp(v) -> str:
    return "Rp" + f"{v:,.0f}".replace(",", ".")