"""Verifikasi silang indikator sendiri vs library `ta` (skrip sekali pakai, bukan bagian aplikasi)."""
import sys

import numpy as np
import pandas as pd
import yfinance as yf

sys.path.insert(0, ".")
from pipeline import indicators as I  # noqa: E402
from ta.momentum import RSIIndicator, StochasticOscillator  # noqa: E402
from ta.trend import ADXIndicator, MACD  # noqa: E402
from ta.volatility import AverageTrueRange, BollingerBands  # noqa: E402
from ta.volume import OnBalanceVolumeIndicator  # noqa: E402

# Seri klasik Wilder (New Concepts in Technical Trading Systems)
W = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89,
     46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25,
     45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57, 43.42, 42.66, 43.13]
s = pd.Series(W)
mine = I.rsi(s).dropna()
ref = RSIIndicator(s, window=14, fillna=False).rsi().dropna()
# Nilai acuan RSI yang diterbitkan Wilder untuk seri di atas (buku, tabel contoh)
PUBLISHED = [70.53, 66.32, 66.55, 69.41, 66.36, 57.97, 62.93, 63.26, 56.06, 62.38,
             54.71, 50.42, 39.99, 41.46, 41.87, 45.46, 37.30, 33.08, 37.77]
print("RSI Wilder  mine     :", [round(x, 2) for x in mine.iloc[:6]])
print("RSI Wilder  terbitan :", PUBLISHED[:6])
print("RSI Wilder  ta       :", [round(x, 2) for x in ref.iloc[:6]])
n = min(len(mine), len(PUBLISHED))
print("cocok dengan terbitan:", np.allclose(mine.iloc[:n].values, PUBLISHED[:n], atol=0.01))
print("cocok dengan ta      :", np.allclose(mine.values, ref.reindex(mine.index).values, atol=0.5))

df = yf.download("BBCA.JK", period="2y", interval="1d", progress=False, auto_adjust=False)
if isinstance(df.columns, pd.MultiIndex):
    df = df.droplevel(1, axis=1)
df.columns = [str(c).lower() for c in df.columns]
o, h, l, c, v = (df[k].astype(float) for k in ("open", "high", "low", "close", "volume"))
checks = [
    ("RSI(14)", I.rsi(c).iloc[-1], RSIIndicator(c, 14).rsi().iloc[-1]),
    ("ATR(14)", I.atr(h, l, c).iloc[-1], AverageTrueRange(h, l, c, 14).average_true_range().iloc[-1]),
    ("ADX(14)", I.adx(h, l, c)[0].iloc[-1], ADXIndicator(h, l, c, 14).adx().iloc[-1]),
    ("+DI", I.adx(h, l, c)[1].iloc[-1], ADXIndicator(h, l, c, 14).adx_pos().iloc[-1]),
    ("MACD", I.macd(c)[0].iloc[-1], MACD(c).macd().iloc[-1]),
    ("MACD hist", I.macd(c)[2].iloc[-1], MACD(c).macd_diff().iloc[-1]),
    ("BB upper", I.bollinger(c)[0].iloc[-1], BollingerBands(c, 20, 2).bollinger_hband().iloc[-1]),
    ("BB %B", I.bollinger(c)[3].iloc[-1], BollingerBands(c, 20, 2).bollinger_pband().iloc[-1]),
    ("OBV", I.obv(c, v).iloc[-1], OnBalanceVolumeIndicator(c, v).on_balance_volume().iloc[-1]),
]
print("\nBBCA 2y, bar terakhir:", df.index[-1].date(), "close", float(c.iloc[-1]))
for name, a, b in checks:
    ok = "OK" if abs(a - b) < max(0.01, abs(b) * 1e-6) else "BEDA"
    print(f"{name:10s} mine={a:15.4f}  ta={b:15.4f}  {ok}")
