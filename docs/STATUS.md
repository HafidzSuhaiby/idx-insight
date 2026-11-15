# Status milestone — IDX Insight

Ringkasan apa yang sudah jalan, apa yang belum, dan buktinya. Diperbarui manual setiap milestone selesai.

## Selesai (M0–M6)

| # | Milestone | Bukti |
| --- | --- | --- |
| M0 | Struktur proyek, repo git, config | `config/{universe,scoring,sim}.yaml`, `config/blacklist.json` |
| M1 | Lapisan data + validasi | `pipeline/data.py`; unduh 45 saham LQ45 + IHSG berhasil, 45/45 lolos validasi |
| M2 | Indikator teknikal sendiri | `pipeline/indicators.py`; verifikasi silang vs library `ta` dan tabel Wilder (RSI/ATR/ADX/MACD/Bollinger cocok persis) |
| M3 | Skor komposit + sinyal + level | `pipeline/scoring.py`, `config/scoring.yaml`; keluaran `indicators/*.json`, `signals/latest.json` |
| M4 | Mesin simulasi + evaluasi | `pipeline/sim.py`, `pipeline/evaluate.py`; `sim/portfolio.json`, `eval/scorecard.json` |
| M5 | Frontend 8 halaman | `web/src/`; `npx tsc --noEmit` bersih, `npm run build` sukses (520 modul), smoke test Chromium 8/8 rute + 6 tab lulus tanpa error konsol |
| M6 | Otomasi + deploy | `.github/workflows/daily.yml` (Cloudflare Pages) & `.github/workflows/pages.yml` (GitHub Pages, base path otomatis) |

## Verifikasi UI (terakhir)

`python tools/smoke_web.py` (Chromium headless via Playwright, melawan `npm run build` + `vite preview`):

```
OK  / /screener /saham/BBCA /simulasi /scorecard /backtest /panduan /pengaturan   (0 error konsol)
OK  baris tabel screener = 45   | urut skor menurun   | klik baris → /saham/PTBA
OK  tab Chart(canvas=14) Teknikal Fundamental Risiko Riwayat Penjelasan
HASIL: SEMUA LULUS
```

Satu bug nyata ditemukan dan diperbaiki lewat uji ini: halaman Scorecard sempat menabrak aturan urutan hook React
(error #310) karena `useMemo` diletakkan setelah `return` awal. Tangkapan layar tersimpan di `docs/screenshots/`.

Build sub-path (dipakai GitHub Pages `/<repo>/`) juga diuji: `BASE_PATH=/idx-insight/ npm run build:pages`, lalu
`SMOKE_BASE=http://[::1]:4174/idx-insight python tools/smoke_web.py` → **SEMUA LULUS**. Uji ini menemukan satu bug lagi:
`BrowserRouter` tanpa `basename` membuat semua rute jatuh ke halaman Dashboard saat situs berada di sub-path — sudah
diperbaiki di `src/main.tsx`.

## Hasil pipeline terakhir

Jalankan `python -m pipeline.run` untuk memperbarui. Contoh keluaran:

```
OK 2026-11-13 · 45/45 saham · Beli 0 · rezim Risk-off · 0 error, 0 peringatan
Akun A: Rp1.011.714 (+1,17% vs IHSG -35,42%) · 11 transaksi · verdict: Data belum cukup
Akun B: Rp18.846.115 (-5,77% vs IHSG -35,42%) · 46 transaksi · verdict: Data belum cukup
```

Diverifikasi ulang dengan unduhan langsung: IHSG 8.275 → 5.344 (-35,4%) pada 2025-11-03 → 2026-11-13. Jadi angka pembanding
memang berasal dari data, bukan kesalahan perhitungan. Kedua akun mengalahkan IHSG pada periode itu, tetapi status
kelayakan tetap "Data belum cukup" karena aturan memakai transaksi real-time saja (minimal 60 hari & 30 transaksi).

## Belum dikerjakan (Fase 2)

| # | Milestone | Catatan |
| --- | --- | --- |
| M7 | Backtest walk-forward | Halaman `/backtest` masih penjelasan; gerbang: 60 hari + 30 transaksi real-time, profit factor ≥ 1,3, DD ≤ 15%, tidak bergantung satu transaksi |
| M8 | Optimasi parameter | Hanya setelah M7; ubah `scoring.yaml` + naikkan `params_version` |
| M9 | Eksperimen ML | Hanya bila aturan dasar sudah lolos; wajib dibandingkan dengan baseline aturan |

## Utang teknis yang disadari

- `bundel` frontend ±980 kB (lightweight-charts + recharts). Belum dipecah per rute; cukup untuk penggunaan pribadi.
- Halaman Backtest belum menyimpan hasil walk-forward apa pun.
- Kalender libur bursa belum diambil otomatis (idx.co.id diblokir Cloudflare); hari libur terdeteksi tidak langsung karena
  simulasi mengikuti tanggal yang benar-benar ada di data harga.
- `config/blacklist.json` masih kosong — isi manual bila ada saham disuspensi.
