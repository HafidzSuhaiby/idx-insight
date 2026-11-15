# IDX Insight

Aplikasi analisis saham IDX (universe **LQ45**) berbahasa Indonesia: skor komposit deterministik, sinyal Beli/Tahan/Hindari,
level entry–stop–target, mesin simulasi portofolio, dan scorecard akurasi terhadap IHSG.

> **Bukan nasihat keuangan.** Alat bantu analisis dan edukasi. Data dari Yahoo Finance, dapat terlambat atau tidak lengkap.
> Kinerja masa lalu tidak menjamin hasil di masa depan.

## Arsitektur

```
pipeline/ (Python 3.13)                    web/ (React + Vite + TS)
  config.py   muat config/*.yaml             src/lib/api.ts     baca JSON statis
  data.py     unduh + validasi Yahoo         src/pages/*       8 halaman
  indicators.py  indikator sendiri           src/components/*  chart + UI
  scoring.py  skor & sinyal (deterministik)  public/data/*     keluaran pipeline
  sim.py      simulasi portofolio
  evaluate.py metrik & kriteria kelayakan
  run.py      orkestrator → JSON
```

Tidak ada model bahasa yang menghitung angka. Semua keputusan berasal dari aturan di `config/`.

## Menjalankan lokal

```bash
# 1. Pipeline (menulis JSON ke web/public/data)
pip install -r requirements.txt
python -m pipeline.run              # 45 saham, ±5–10 menit
python -m pipeline.run --no-replay  # lewati replay historis (lebih cepat)

# 2. Frontend
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # keluaran statis di web/dist
```

Uji cepat: `python tests/test_pipeline.py` (3 saham, direktori sementara, tidak menimpa data asli).

## Konfigurasi

| Berkas | Isi |
| --- | --- |
| `config/universe.yaml` | daftar konstituen LQ45, benchmark, filter likuiditas & riwayat minimum |
| `config/scoring.yaml` | bobot kategori, kurva skor tiap faktor, ambang sinyal, aturan level |
| `config/sim.yaml` | modal & batas posisi dua akun, fee, slippage, lot, fraksi harga, T+2, parameter replay |
| `config/blacklist.json` | saham yang diblokir atau disuspensi sementara |

Bobot dan ambang di `scoring.yaml` adalah **titik awal**. Ubah hanya berdasarkan hasil walk-forward, bukan karena satu hasil
bagus/jelek — dan naikkan `params_version` setiap kali berubah agar tiap keluaran bisa ditelusuri.

## Cara kerja singkat

1. Unduh harga harian + metadata fundamental; validasi kelengkapan, riwayat minimum, dan likuiditas (≥ Rp5 M/hari).
2. Hitung indikator dari **harga adjusted**, lalu konversi level transaksi ke **harga mentah** (harga yang benar-benar dieksekusi).
3. Nilai tiap faktor 0–100 lewat kurva di `scoring.yaml`; gabungkan menjadi skor komposit 0–100 dan sinyal.
4. Rezim pasar dari IHSG (Risk-on / Netral / Risk-off) menentukan apakah sinyal Beli boleh dipakai dan berapa posisi maksimum.
5. Mesin simulasi mengubah sinyal Beli menjadi order: ukuran posisi dari risiko 2% ekuitas ÷ jarak stop, dibatasi bobot maksimum per saham.
6. `evaluate.py` menghitung return vs IHSG, profit factor, expectancy, drawdown, dan memeriksa kriteria kelayakan.

## Deploy (dijalankan oleh pemilik repo)

Tidak ada kredensial di repositori ini; rahasia disimpan sebagai GitHub Secrets.

1. Buat repo GitHub, lalu `git remote add origin …` dan `git push -u origin main`.
2. Buat proyek Cloudflare Pages bernama `idx-insight` (mode Direct Upload).
3. Tambahkan **Secrets** repo: `CLOUDFLARE_API_TOKEN` (izin *Cloudflare Pages: Edit*) dan `CLOUDFLARE_ACCOUNT_ID`.
4. Workflow `.github/workflows/daily.yml` berjalan Senin–Jumat 17:30 WIB: uji → pipeline → commit data → build → deploy.
   Bisa juga dijalankan manual dari tab *Actions* (`workflow_dispatch`).

Alternatif tanpa Actions: hubungkan repo ke Cloudflare Pages (build command `npm run build`, root `web`), lalu jalankan
pipeline terjadwal di mesin Anda dan push hasilnya.

## Keterbatasan yang diketahui

- Sumber data Yahoo Finance: bisa kosong/terlambat, terutama metadata fundamental emiten kecil.
- Simulasi belum memodelkan ARA/ARB per hari secara rinci, antrean order, atau likuiditas saat eksekusi.
- Kurva ekuitas sebelum fase real-time adalah **replay in-sample** dan tidak membuktikan kinerja ke depan.
- Backtest walk-forward dan eksperimen ML (Fase 2) belum dijalankan — sengaja ditahan sampai sistem dasar terbukti.
- Daftar konstituen LQ45 diperbarui manual dari pengumuman BEI; API idx.co.id tidak dipakai (diblokir Cloudflare).

## Status milestone

Lihat `docs/STATUS.md`.
