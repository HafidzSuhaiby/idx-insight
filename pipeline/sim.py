"""Mesin simulasi portofolio IDX Insight (PRD Bagian 8).

Deterministik dan idempoten: satu pemanggilan `step()` memproses tepat satu hari bursa.
Asumsi yang disengaja:
- Order direncanakan setelah penutupan T, terisi di harga buka T+1 + slippage.
- Bila dalam satu hari stop DAN target tersentuh, dipakai asumsi pesimistis: stop lebih dulu
  (urutan intrabar tidak dapat diketahui dari data harian).
- Gap melewati stop -> keluar di harga buka, bukan di harga stop.
- Dana hasil jual tersedia T+2 (hari bursa).
"""
from __future__ import annotations

import math


def price_fraction(price: float, table: list) -> float:
    for lo, hi, frac in table:
        if price >= lo and (hi is None or price < hi):
            return float(frac)
    return float(table[-1][2])


def round_to_fraction(price: float, table: list) -> float:
    f = price_fraction(price, table)
    return round(price / f) * f


def new_state(acc_key: str, acc_cfg: dict, params_version: str) -> dict:
    return {
        "account": acc_key,
        "label": acc_cfg["label"],
        "initial_cash": acc_cfg["initial_cash"],
        "cash": acc_cfg["initial_cash"],
        "receivable": [],      # [{days_left, amount}] dana hasil jual menunggu T+2
        "positions": [],
        "pending_orders": [],  # order untuk hari bursa berikutnya
        "params_version": params_version,
        "n_trades": 0,
        "skipped": [],
    }


def equity(state: dict, closes: dict, lot_size: int) -> float:
    """Ekuitas = kas + piutang penjualan + nilai posisi pada harga penutupan."""
    val = sum(p["lots"] * lot_size * closes.get(p["code"], p["entry_price"]) for p in state["positions"])
    return state["cash"] + sum(r["amount"] for r in state["receivable"]) + val


def step(state: dict, day: str, next_day: str, bars: dict, recs: dict, cfg: dict,
         acc_cfg: dict, regime_state: str, regime_netral_factor: float) -> dict:
    """Proses satu hari bursa. bars[code] = {open, high, low, close} harga mentah hari itu."""
    frac, lot = cfg["price_fraction"], cfg["lot_size"]
    fee_buy, fee_sell = cfg["fee"]["buy"], cfg["fee"]["sell"]
    log = {"date": day, "orders": [], "trades": [], "skipped": []}

    # 0. piutang T+2 jatuh tempo
    for r in state["receivable"]:
        r["days_left"] -= 1
    for r in [r for r in state["receivable"] if r["days_left"] <= 0]:
        state["cash"] += r["amount"]
    state["receivable"] = [r for r in state["receivable"] if r["days_left"] > 0]

    # 1. keluar dulu (membebaskan kas & slot)
    exited_today = set()
    for pos in list(state["positions"]):
        bar = bars.get(pos["code"])
        if not bar:
            continue
        pos["bars_held"] += 1
        price = reason = None
        if bar["open"] <= pos["stop"]:
            price, reason = bar["open"], "stop (gap turun, keluar di harga buka)"
        elif bar["low"] <= pos["stop"]:
            price, reason = pos["stop"], "stop"
        elif bar["high"] >= pos["target"]:
            price, reason = pos["target"], "target"
        else:
            score = (recs.get(pos["code"]) or {}).get("score")
            if score is not None and score < cfg["exit_score"]:
                price, reason = bar["close"], "skor turun di bawah ambang"
            elif pos["bars_held"] >= cfg["max_hold_days"]:
                price, reason = bar["close"], "batas waktu holding"
        if price is None:
            continue
        price = round_to_fraction(price, frac)
        gross = pos["lots"] * lot * price
        proceeds = gross * (1 - fee_sell)
        state["receivable"].append({"days_left": cfg["settlement_days"], "amount": proceeds})
        ret_pct = (proceeds - pos["cost_total"]) / pos["cost_total"] * 100
        log["trades"].append({
            "code": pos["code"], "exit_date": day, "entry_date": pos["opened"],
            "lots": pos["lots"], "entry_price": pos["entry_price"], "exit_price": price,
            "cost_total": round(pos["cost_total"], 2), "proceeds": round(proceeds, 2),
            "pnl": round(proceeds - pos["cost_total"], 2), "return_pct": round(ret_pct, 2),
            "r_multiple": round((price - pos["entry_price"]) / pos["risk_per_share"], 2) if pos["risk_per_share"] else None,
            "bars_held": pos["bars_held"], "reason": reason, "params_version": state["params_version"],
            "score_at_entry": pos.get("score_at_entry"), "phase": state.get("phase", "live"),
            "regime_at_entry": pos.get("regime"),
        })
        state["positions"].remove(pos)
        state["n_trades"] += 1
        exited_today.add(pos["code"])

    # 2. isi order yang direncanakan sebelumnya (hari bursa pertama setelah order dibuat)
    kept = []
    for od in state["pending_orders"]:
        if od["for_date"] > day:
            kept.append(od)
            continue
        bar = bars.get(od["code"])
        if not bar:
            log["skipped"].append({"code": od["code"], "date": day, "reason": "tidak terisi (data harga hilang)"})
            continue
        fill = round_to_fraction(bar["open"] * (1 + cfg["slippage"]), frac)
        if cfg["ara_arb"]["enabled"] and od.get("prev_close"):
            ara = round_to_fraction(od["prev_close"] * (1 + cfg["ara_arb"]["ara"]), frac)
            if bar["open"] >= ara:
                log["skipped"].append({"code": od["code"], "date": day, "reason": "tidak terisi (harga buka menyentuh batas ARA)"})
                continue
        lots = min(od["lots"], int(state["cash"] // (fill * lot * (1 + fee_buy))))
        if lots < 1:
            log["skipped"].append({"code": od["code"], "date": day, "reason": "tidak terjangkau modal"})
            continue
        cost = lots * lot * fill
        fee = cost * fee_buy
        state["cash"] -= cost + fee
        state["positions"].append({
            "code": od["code"], "lots": lots, "entry_price": fill, "cost_total": cost + fee,
            "stop": od["stop"], "target": od["target"],
            "risk_per_share": max(fill - od["stop"], 0.0), "opened": day, "bars_held": 0,
            "score_at_entry": od["score"], "planned_lots": od["lots"], "regime": od.get("regime"),
        })
        log["orders"].append({
            "code": od["code"], "side": "beli", "status": "terisi", "date": day, "lots": lots,
            "price": fill, "cost": round(cost, 2), "fee": round(fee, 2),
            "stop": od["stop"], "target": od["target"], "score": od["score"],
            "params_version": state["params_version"],
        })
    state["pending_orders"] = kept

    # 3. rencanakan order untuk hari bursa berikutnya
    closes = {c: b["close"] for c, b in bars.items()}
    eq = equity(state, closes, lot)
    max_pos = acc_cfg["max_positions"]
    if regime_state == "Netral":
        max_pos = max(1, int(math.floor(max_pos * regime_netral_factor)))
    held = {p["code"] for p in state["positions"]} | exited_today
    slots = max(0, max_pos - len(state["positions"]))
    picks = sorted((r for r in recs.values() if r["signal"] == "Beli" and r["code"] not in held),
                   key=lambda r: -r["score"])
    for r in picks[:slots]:
        stop_dist = (r["entry_est"] or 0) - (r["stop"] or 0)
        if stop_dist <= 0:
            log["skipped"].append({"code": r["code"], "date": day, "reason": "jarak stop tidak valid"})
            continue
        lots = min(
            int((cfg["risk_per_trade"] * eq) // (stop_dist * lot)),
            int((eq * acc_cfg["max_weight_per_stock"]) // (r["entry_est"] * lot)),
        )
        if lots < 1:
            log["skipped"].append({"code": r["code"], "date": day, "reason": "tidak terjangkau modal"})
            continue
        state["pending_orders"].append({
            "code": r["code"], "for_date": next_day, "lots": lots, "stop": r["stop"],
            "target": r["target"], "score": r["score"], "prev_close": bars[r["code"]]["close"],
            "planned_entry": r["entry_est"], "planned_at": day, "regime": regime_state,
        })
        log["orders"].append({
            "code": r["code"], "side": "beli", "status": "direncanakan", "date": day,
            "for_date": next_day, "lots": lots, "stop": r["stop"], "target": r["target"],
            "score": r["score"], "params_version": state["params_version"],
        })

    state["skipped"] = (state["skipped"] + log["skipped"])[-200:]
    log["equity"] = round(eq, 2)
    log["cash"] = round(state["cash"], 2)
    log["n_positions"] = len(state["positions"])
    return log