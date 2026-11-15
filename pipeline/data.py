"""Lapisan data: ambil OHLCV + fundamental dari Yahoo Finance, validasi, dan normalisasi.

Aturan (PRD 7.1): indikator memakai harga disesuaikan (adjusted), simulasi eksekusi memakai harga mentah.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import pandas as pd
import yfinance as yf

SUFFIX = ".JK"


def symbol(code: str) -> str:
    """Kode IDX polos -> simbol Yahoo Finance. Indeks (^JKSE) dan kode bersufiks dibiarkan apa adanya."""
    return code if code.startswith("^") or "." in code else code + SUFFIX


SECTOR_ID = {
    "Financial Services": "Keuangan",
    "Basic Materials": "Barang Baku",
    "Energy": "Energi",
    "Technology": "Teknologi",
    "Consumer Defensive": "Konsumen Primer",
    "Consumer Cyclical": "Konsumen Diskresioner",
    "Industrials": "Perindustrian",
    "Healthcare": "Kesehatan",
    "Communication Services": "Telekomunikasi",
    "Utilities": "Infrastruktur",
    "Real Estate": "Properti",
}


def download(codes: list[str], period: str = "5y", tries: int = 3) -> pd.DataFrame:
    """`codes` = kode IDX polos (mis. BBCA); simbol Yahoo diturunkan lewat symbol()."""
    syms = [symbol(c) for c in codes]
    last_err = None
    for attempt in range(tries):
        try:
            raw = yf.download(
                syms, period=period, interval="1d", progress=False,
                auto_adjust=False, group_by="ticker", threads=True,
            )
            if raw is not None and len(raw) > 0:
                return raw
            last_err = RuntimeError("Yahoo mengembalikan data kosong")
        except Exception as e:  # noqa: BLE001 - apa pun dari Yahoo, coba lagi
            last_err = e
        time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"gagal mengambil data setelah {tries} percobaan: {last_err}")


def frames(raw: pd.DataFrame, codes: list[str]) -> dict[str, pd.DataFrame]:
    """Pecah hasil download menjadi {kode polos: DataFrame} dengan kolom huruf kecil."""
    multi = isinstance(raw.columns, pd.MultiIndex)
    out: dict[str, pd.DataFrame] = {}
    for code in codes:
        sym = symbol(code)
        try:
            df = raw[sym].copy() if multi else raw.copy()
        except KeyError:
            continue
        df.columns = [str(c).lower().replace(" ", "_") for c in df.columns]
        if "close" not in df:
            continue
        df = df[df["close"].notna()].sort_index()
        df = df[~df.index.duplicated(keep="last")]
        if not df.empty:
            out[code] = df
    return out


def adjusted(df: pd.DataFrame) -> pd.DataFrame:
    """OHLC yang disesuaikan terhadap adj_close (untuk indikator & chart)."""
    out = df.copy()
    if "adj_close" in df:
        f = (df["adj_close"] / df["close"].replace(0, np.nan)).fillna(1.0)
        for k in ("open", "high", "low"):
            if k in out:
                out[k] = df[k] * f
        out["close"] = df["adj_close"]
    return out


def validate(df: pd.DataFrame, code: str, bench_last: pd.Timestamp | None, min_bars: int, max_stale_days: int) -> list[dict]:
    """Cek kewajaran data. level=error berarti saham dibuang, warn hanya ditandai."""
    issues: list[dict] = []

    def add(level, msg):
        issues.append({"code": code, "level": level, "msg": msg})

    if len(df) < min_bars:
        add("error", f"riwayat {len(df)} bar < {min_bars} hari bursa")
    if not df.index.is_monotonic_increasing:
        add("error", "tanggal tidak berurutan")
    if df.index.has_duplicates:
        add("error", "tanggal ganda")
    cols = [c for c in ("open", "high", "low", "close") if c in df]
    if df[cols].le(0).to_numpy().any():
        add("error", "ada harga <= 0")
    if df["volume"].lt(0).any():
        add("error", "ada volume negatif")
    jump = df["close"].pct_change().abs()
    if (jump > 0.5).any():
        n = int((jump > 0.5).sum())
        add("warn", f"{n} lonjakan harga >50% (kemungkinan corporate action, harga disesuaikan)")
    if bench_last is not None:
        gap = (bench_last - df.index[-1]).days
        if gap > max_stale_days:
            add("error", f"data basi: terakhir {df.index[-1].date()}, benchmark {bench_last.date()}")
    return issues


def info(code: str, tries: int = 2) -> dict:
    for attempt in range(tries):
        try:
            return yf.Ticker(symbol(code)).info or {}
        except Exception:  # noqa: BLE001
            time.sleep(1.5 * (attempt + 1))
    return {}


def _num(v):
    return float(v) if isinstance(v, (int, float)) and not (isinstance(v, float) and np.isnan(v)) else None


def dividend_yield(code: str, close: float) -> float | None:
    try:
        div = yf.Ticker(symbol(code)).dividends
        if div is None or len(div) == 0 or not close:
            return None
        idx = div.index
        now = pd.Timestamp.now(tz=idx.tz) if getattr(idx, "tz", None) is not None else pd.Timestamp.now()
        total = float(div[idx >= now - pd.Timedelta(days=365)].sum())
        return total / close * 100
    except Exception:  # noqa: BLE001
        return None


def fundamentals(code: str, close: float, i: dict | None = None) -> dict:
    """Fundamental best-effort. Nilai None = 'tidak tersedia' (jangan dikarang)."""
    i = i if i is not None else info(code)
    roe, der = _num(i.get("returnOnEquity")), _num(i.get("debtToEquity"))
    growth = _num(i.get("earningsGrowth"))
    return {
        "name": i.get("longName") or code,
        "sector": SECTOR_ID.get(i.get("sector") or "", i.get("sector")),
        "industry": i.get("industry"),
        "per": _num(i.get("trailingPE")),
        "pbv": _num(i.get("priceToBook")),
        "roe": roe * 100 if roe is not None else None,
        "der": der / 100 if der is not None else None,   # Yahoo memberi persen
        "eps": _num(i.get("trailingEps")),
        "eps_growth": growth * 100 if growth is not None else None,
        "dividend_yield": dividend_yield(code, close),
        "market_cap": _num(i.get("marketCap")),
    }


def fundamentals_many(codes: list[str], closes: dict[str, float], workers: int = 4) -> dict[str, dict]:
    def one(code):
        return code, fundamentals(code, closes.get(code, 0.0))

    out = {}
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for code, f in ex.map(one, codes):
            out[code] = f
    return out