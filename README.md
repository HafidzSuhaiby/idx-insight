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

## Hosting & akses dari perangkat lain

Aplikasi ini **sepenuhnya statis** (HTML + JS + berkas JSON di `web/public/data`), jadi hosting apa pun yang menyajikan
berkas statis bisa dipakai. Tidak ada server atau basis data yang perlu dijalankan.

### A. Coba dulu di HP lewat Wi-Fi (tanpa hosting, 2 menit)

```bash
cd web
npm run build
npx vite preview --host        # catat alamat http://192.168.x.x:4173
```

Buka alamat itu dari HP yang tersambung ke Wi-Fi yang sama. Kalau Windows menanyakan izin firewall, pilih **Allow**.
Cara ini hanya untuk mencoba; begitu PC mati, situs tidak bisa diakses.

### B. Cloudflare Pages + GitHub Actions (disarankan — otomatis tiap hari)

1. **Buat repo GitHub** (mis. `idx-insight`), lalu dari folder proyek:
   ```bash
   git remote add origin https://github.com/<user>/idx-insight.git
   git branch -M main
   git push -u origin main
   ```
2. **Buat akun Cloudflare** (gratis) → menu **Workers & Pages** → **Create** → **Pages** → **Upload assets / Direct Upload**
   → nama proyek **`idx-insight`** (harus sama dengan `--project-name` di workflow).
3. **Catat Account ID**: halaman Workers & Pages → **Account ID** (kanan bawah).
4. **Buat API token**: My Profile → **API Tokens** → Create Token → *Custom token* dengan izin
   **Account → Cloudflare Pages → Edit**. Simpan nilainya (hanya tampil sekali).
5. Di repo GitHub: **Settings → Secrets and variables → Actions → New repository secret**, tambahkan:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
6. Tab **Actions** → pilih *Harian — pipeline & deploy* → **Run workflow**.
7. Setelah selesai, situs hidup di `https://idx-insight.pages.dev` (alamat tepatnya tampil di halaman proyek Pages).

Workflow berjalan Senin–Jumat 17:30 WIB: uji → pipeline → commit data → build → deploy. Repo **boleh privat** (ini
keunggulan Cloudflare Pages dibanding GitHub Pages). Batas gratis: 500 build/bulan dan bandwidth tak terbatas.

### C. GitHub Pages (alternatif tanpa akun Cloudflare)

1. Push repo seperti langkah B.1 — repo harus **publik** (Pages dari repo privat butuh GitHub Pro).
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. Tab **Actions** → *Deploy ke GitHub Pages* → **Run workflow**.
4. Situs hidup di `https://<user>.github.io/<repo>/`. Base path diisi otomatis dari nama repo (`BASE_PATH` di workflow),
   jadi nama repo apa pun tetap benar.

Workflow `pages.yml` juga terpicu setiap push ke `main` yang mengubah `web/**` — termasuk commit data harian dari
`daily.yml`, sehingga situs ikut terbarui sendiri.

### D. Memperbarui data

- Otomatis: biarkan jadwal Actions berjalan (butuh secrets pada opsi B; opsi C cukup repo publik).
- Manual: jalankan `python -m pipeline.run` di komputer Anda, lalu `git add web/public/data && git commit && git push`.
  Penyedia hosting akan membangun ulang sendiri.

### E. Domain sendiri (opsional)

- Cloudflare Pages → proyek → **Custom domains** → Add → ikuti instruksi DNS.
- GitHub Pages → **Settings → Pages → Custom domain** → arahkan CNAME ke `<user>.github.io`.

Tidak ada kredensial di dalam repositori ini — semua rahasia disimpan sebagai GitHub Secrets.

### F. Halaman kosong setelah deploy (gejala: console menyebut `main.tsx` dan "MIME type of \"\"")

Artinya hosting menyajikan `index.html` **sumber** (yang menunjuk `/src/main.tsx`), bukan hasil build. Perbaiki pengaturan
build di dashboard hosting:

- Root/Base directory: `web`
- Build command: `npm run build`
- Output/Deploy: `dist` (Cloudflare Pages) atau `npx wrangler deploy` (Cloudflare Worker — `web/wrangler.toml` sudah
  menunjuk `./dist` dan menangani rute SPA)

Halaman yang benar memuat berkas `/assets/index-*.js`, bukan `/src/main.tsx`.

## Keterbatasan yang diketahui

- Sumber data Yahoo Finance: bisa kosong/terlambat, terutama metadata fundamental emiten kecil.
- Simulasi belum memodelkan ARA/ARB per hari secara rinci, antrean order, atau likuiditas saat eksekusi.
- Kurva ekuitas sebelum fase real-time adalah **replay in-sample** dan tidak membuktikan kinerja ke depan.
- Backtest walk-forward dan eksperimen ML (Fase 2) belum dijalankan — sengaja ditahan sampai sistem dasar terbukti.
- Daftar konstituen LQ45 diperbarui manual dari pengumuman BEI; API idx.co.id tidak dipakai (diblokir Cloudflare).

## Status milestone

Lihat `docs/STATUS.md`.
