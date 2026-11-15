"""Indikator teknikal IDX Insight — implementasi sendiri (tanpa library TA), diuji terhadap nilai acuan.

Konvensi:
- EMA memakai span = n, adjust=False.
- RSI/ATR/ADX memakai smoothing Wilder: seed = rata-rata n nilai pertama, lalu rata-rata bergerak 1/n.
  (Library `ta` memakai seed berbeda sehingga nilainya menyimpang ~0.07 di bar awal; definisi asli
   Wilder memakai seed SMA seperti di sini.)
- OBV memakai definisi standar: harga naik -> +volume, turun -> -volume, sama -> 0.
  (Library `ta` menghitung harga tetap sebagai volume positif; itu penyimpangan dari definisi standar.)

`snapshot_series()` menghitung semuanya sebagai seri (vektor) sekali jalan; `snapshot()` mengambil
bar terakhir. Ini membuat replay historis murah dan tidak mungkin look-ahead karena setiap baris
hanya memakai data sampai tanggal itu.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

TRADING_DAYS = 252


# ---------------------------------------------------------------- dasar
def sma(x: pd.Series, n: int) -> pd.Series:
    return x.rolling(n).mean()


def ema(x: pd.Series, n: int) -> pd.Series:
    return x.ewm(span=n, adjust=False).mean()


def wilder(x: pd.Series, n: int) -> pd.Series:
    """Smoothing Wilder dengan seed SMA (definisi asli)."""
    x = x.dropna().astype(float)
    out = pd.Series(np.nan, index=x.index, dtype=float)
    v = x.to_numpy()
    if n <= 0 or len(v) < n:
        return out
    acc = float(v[:n].mean())
    out.iloc[n - 1] = acc
    for i in range(n, len(v)):
        acc = (acc * (n - 1) + v[i]) / n
        out.iloc[i] = acc
    return out


def true_range(high: pd.Series, low: pd.Series, close: pd.Series) -> pd.Series:
    pc = close.shift(1)
    return pd.concat([(high - low).abs(), (high - pc).abs(), (low - pc).abs()], axis=1).max(axis=1)


# ---------------------------------------------------------------- indikator
def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    d = close.diff().dropna()
    up, dn = d.clip(lower=0.0), (-d).clip(lower=0.0)
    au, ad = wilder(up, n), wilder(dn, n)
    r = 100 - 100 / (1 + au / ad.replace(0, np.nan))
    return r.where(ad != 0, 100.0)


def atr(high: pd.Series, low: pd.Series, close: pd.Series, n: int = 14) -> pd.Series:
    return wilder(true_range(high, low, close), n)


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    line = ema(close, fast) - ema(close, slow)
    sig = ema(line, signal)
    return line, sig, line - sig


def bollinger(close: pd.Series, n: int = 20, k: float = 2.0):
    mid = sma(close, n)
    sd = close.rolling(n).std(ddof=0)
    up, lo = mid + k * sd, mid - k * sd
    pctb = (close - lo) / (up - lo).replace(0, np.nan)
    bandwidth = (up - lo) / mid.replace(0, np.nan) * 100
    return up, mid, lo, pctb, bandwidth


def stochastic(high: pd.Series, low: pd.Series, close: pd.Series, n: int = 14, k_smooth: int = 3, d_smooth: int = 3):
    hh, ll = high.rolling(n).max(), low.rolling(n).min()
    raw = 100 * (close - ll) / (hh - ll).replace(0, np.nan)
    k = raw.rolling(k_smooth).mean()
    return k, k.rolling(d_smooth).mean()


def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    return (np.sign(close.diff().fillna(0.0)) * volume).cumsum()


def roc(close: pd.Series, n: int) -> pd.Series:
    return (close / close.shift(n) - 1) * 100


def adx(high: pd.Series, low: pd.Series, close: pd.Series, n: int = 14):
    up_move, dn_move = high.diff(), -low.diff()
    plus_dm = pd.Series(np.where((up_move > dn_move) & (up_move > 0), up_move, 0.0), index=high.index)
    minus_dm = pd.Series(np.where((dn_move > up_move) & (dn_move > 0), dn_move, 0.0), index=high.index)
    atr_ = wilder(true_range(high, low, close), n)
    pdi = 100 * wilder(plus_dm, n) / atr_.replace(0, np.nan)
    mdi = 100 * wilder(minus_dm, n) / atr_.replace(0, np.nan)
    dx = 100 * (pdi - mdi).abs() / (pdi + mdi).replace(0, np.nan)
    return wilder(dx, n), pdi, mdi


def volatility(close: pd.Series, n: int) -> pd.Series:
    """Volatilitas historis tahunan (%) dari log-return harian."""
    r = np.log(close / close.shift(1))
    return r.rolling(n).std(ddof=1) * np.sqrt(TRADING_DAYS) * 100


def drawdown_series(close: pd.Series, window: int = TRADING_DAYS) -> pd.Series:
    """Drawdown (%) terhadap puncak tertinggi dalam `window` hari terakhir."""
    peak = close.rolling(window, min_periods=20).max()
    return (close / peak - 1) * 100


def max_drawdown(close: pd.Series) -> float | None:
    c = close.dropna()
    if c.empty:
        return None
    return float(((c / c.cummax()) - 1).min() * 100)


def beta(stock_close: pd.Series, bench_close: pd.Series) -> float | None:
    df = pd.concat([stock_close.pct_change(), bench_close.pct_change()], axis=1).dropna()
    if len(df) < 30 or df.iloc[:, 1].var() == 0:
        return None
    return float(df.iloc[:, 0].cov(df.iloc[:, 1]) / df.iloc[:, 1].var())


def correlation(a_close: pd.Series, b_close: pd.Series) -> float | None:
    df = pd.concat([a_close.pct_change(), b_close.pct_change()], axis=1).dropna()
    return None if len(df) < 30 else float(df.iloc[:, 0].corr(df.iloc[:, 1]))


def slope_pct(x: pd.Series, n: int = 10) -> float | None:
    s = x.dropna()
    if len(s) <= n or s.iloc[-n - 1] == 0:
        return None
    return float((s.iloc[-1] / s.iloc[-n - 1] - 1) * 100)


def swing_state(high: pd.Series, low: pd.Series, w: int = 5):
    """Swing high/low terakhir yang sudah terkonfirmasi (fraktal w bar kiri-kanan), sebagai seri."""
    win = 2 * w + 1
    is_hi = high == high.rolling(win, center=True).max()
    is_lo = low == low.rolling(win, center=True).min()
    hi = high.where(is_hi).shift(w).ffill()
    lo = low.where(is_lo).shift(w).ffill()
    return hi, lo


def pivots(high: float, low: float, close: float) -> dict:
    p = (high + low + close) / 3
    return {"pivot": p, "r1": 2 * p - low, "s1": 2 * p - high}


def candlestick(open_: pd.Series, high: pd.Series, low: pd.Series, close: pd.Series) -> list[str]:
    """Pola dasar 2 bar terakhir — hanya faktor kecil."""
    if len(close) < 2:
        return []
    o1, c1, h1, l1 = open_.iloc[-1], close.iloc[-1], high.iloc[-1], low.iloc[-1]
    o0, c0 = open_.iloc[-2], close.iloc[-2]
    body, rng = abs(c1 - o1), h1 - l1
    out = []
    if c1 > o1 and c0 < o0 and c1 >= o0 and o1 <= c0:
        out.append("bullish_engulfing")
    if c1 < o1 and c0 > o0 and c1 <= o0 and o1 >= c0:
        out.append("bearish_engulfing")
    if rng > 0:
        lower_wick = min(o1, c1) - l1
        upper_wick = h1 - max(o1, c1)
        if body <= rng * 0.3 and lower_wick >= max(body, rng * 0.1) * 2 and upper_wick <= rng * 0.2:
            out.append("hammer")
        if body <= rng * 0.1:
            out.append("doji")
    return out


# ---------------------------------------------------------------- rangkuman (vektor, sekali jalan)
def snapshot_series(df: pd.DataFrame, bench: pd.DataFrame | None = None) -> pd.DataFrame:
    """Semua indikator sebagai seri, satu baris per tanggal. Tiap baris hanya memakai data <= tanggal itu."""
    o, h, l, c, v = (df[k].astype(float) for k in ("open", "high", "low", "close", "volume"))
    d = pd.DataFrame(index=df.index)
    d["close"], d["volume"] = c, v

    e20, e50, e200 = ema(c, 20), ema(c, 50), ema(c, 200)
    d["ema20"], d["ema50"], d["ema200"] = e20, e50, e200
    d["sma50"], d["sma200"] = sma(c, 50), sma(c, 200)
    d["ema_stack"] = ((c > e20).astype(int) + (e20 > e50).astype(int) + (e50 > e200).astype(int) + (c > e200).astype(int)
                      - (c < e20).astype(int) - (e20 < e50).astype(int) - (e50 < e200).astype(int) - (c < e200).astype(int))
    d["ema50_slope"] = (e50 / e50.shift(10) - 1) * 100
    above = (e50 > e200).astype(float).replace(0, np.nan)
    d["ma_cross"] = np.where(above.notna() & above.shift(10).notna(),
                             np.where((above == 1) & (above.shift(10) == 0), 1,
                                      np.where((above == 0) & (above.shift(10) == 1), -1, 0)), np.nan)
    adx_, pdi, mdi = adx(h, l, c)
    d["adx"], d["pdi"], d["mdi"] = adx_, pdi, mdi

    d["rsi"] = rsi(c)
    line, sig, hist = macd(c)
    d["macd"], d["macd_signal"], d["macd_hist"] = line, sig, hist
    d["macd_hist_pct"] = hist / c * 100
    k, dd = stochastic(h, l, c)
    d["stoch_k"], d["stoch_d"] = k, dd
    d["roc10"], d["roc20"] = roc(c, 10), roc(c, 20)

    atr_ = atr(h, l, c)
    d["atr"], d["atr_pct"] = atr_, atr_ / c * 100
    bu, bm, bl, pctb, bw = bollinger(c)
    d["bb_upper"], d["bb_mid"], d["bb_lower"], d["pctb"], d["bandwidth"] = bu, bm, bl, pctb, bw
    d["vol20"], d["vol60"] = volatility(c, 20), volatility(c, 60)
    d["dd_1y"] = drawdown_series(c)

    vavg = v.rolling(20).mean()
    d["volume_avg20"], d["volume_ratio"] = vavg, v / vavg
    o_ = obv(c, v)
    d["obv"] = o_
    d["obv_net"] = (o_ - o_.shift(20)) / vavg
    d["value_avg20"] = (c * v).rolling(20).mean()

    sw_hi, sw_lo = swing_state(h, l)
    d["swing_high"], d["swing_low"] = sw_hi, sw_lo
    d["high_52w"] = h.rolling(TRADING_DAYS, min_periods=20).max()
    d["low_52w"] = l.rolling(TRADING_DAYS, min_periods=20).min()
    d["dist_high_52w"] = (c / d["high_52w"] - 1) * 100
    hi20, lo20 = c.rolling(20).max().shift(1), c.rolling(20).min().shift(1)
    d["breakout"] = np.where((c > hi20) & (d["volume_ratio"] >= 1.5), 1, np.where(c < lo20, -1, 0))
    d.loc[d["volume_ratio"].isna(), "breakout"] = np.nan

    if bench is not None and len(bench) > 30:
        bc = bench["close"].astype(float)
        br = bc.pct_change()
        cr = c.pct_change()
        d["beta"] = cr.rolling(TRADING_DAYS, min_periods=60).cov(br) / br.rolling(TRADING_DAYS, min_periods=60).var()
        d["corr_ihsg"] = cr.rolling(60).corr(br)
        d["rs_ihsg"] = roc(c, 60) - roc(bc, 60)
    return d


def snapshot(df: pd.DataFrame, bench: pd.DataFrame | None = None) -> dict:
    """Nilai indikator pada bar terakhir + hal yang bukan seri (pola candlestick, pivot)."""
    s = snapshot_series(df, bench).iloc[-1]
    out = {k: (None if pd.isna(x) else float(x)) for k, x in s.items()}
    out["date"] = str(pd.Timestamp(df.index[-1]).date())
    out["bars"] = int(len(df))
    out["candles"] = candlestick(df["open"].astype(float), df["high"].astype(float),
                                 df["low"].astype(float), df["close"].astype(float))
    out["pivots"] = pivots(out["high_52w"] or out["close"], out["low_52w"] or out["close"], out["close"])
    return out


RAW_CHART_COLUMNS = ["open", "high", "low", "close", "volume"]              # harga mentah (harga eksekusi)
PRICE_CHART_COLUMNS = ["ema20", "ema50", "ema200", "bb_upper", "bb_lower", "macd_hist"]  # indikator harga
FREE_CHART_COLUMNS = ["rsi", "stoch_k", "stoch_d", "obv"]                   # bebas skala


def chart_series(df_raw: pd.DataFrame, df_adj: pd.DataFrame, bench_adj: pd.DataFrame | None = None,
                 bars: int = 400) -> dict:
    """Seri untuk chart detail saham.

    Harga OHLCV memakai harga mentah (yang benar-benar diperdagangkan); indikator dihitung dari
    harga disesuaikan lalu dikembalikan ke skala harga mentah, sehingga garis entry/stop/target
    pada chart sejajar dengan harga eksekusi di simulasi.
    """
    s = snapshot_series(df_adj, bench_adj).tail(bars)
    scale = (df_raw["close"] / df_adj["close"]).tail(bars)
    out = {"dates": [str(pd.Timestamp(i).date()) for i in s.index], "price_basis": "mentah",
           "indicator_basis": "disesuaikan, dikembalikan ke skala mentah"}
    for col in RAW_CHART_COLUMNS:
        out[col] = [None if pd.isna(x) else round(float(x)) for x in df_raw[col].astype(float).tail(bars)]
    for col in PRICE_CHART_COLUMNS:
        out[col] = [None if pd.isna(x) else round(float(x)) for x in (s[col] * scale)]
    for col in FREE_CHART_COLUMNS:
        out[col] = [None if pd.isna(x) else round(float(x), 2) for x in s[col]]
    return out