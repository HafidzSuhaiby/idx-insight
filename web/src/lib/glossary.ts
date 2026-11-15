/* Glosarium (PRD FR-7 + tooltip 'Apa itu ...?' di tabel teknikal). */
export const GLOSSARY: Record<string, string> = {
  ema_stack:
    'Keselarasan tren dari empat perbandingan: harga vs EMA20, EMA20 vs EMA50, EMA50 vs EMA200, dan harga vs EMA200. Nilai +4 berarti semua searah naik, −4 semua searah turun.',
  ema20: 'Exponential Moving Average 20 hari — rata-rata harga yang memberi bobot lebih besar pada data terbaru.',
  ema50: 'EMA 50 hari, acuan tren jangka menengah.',
  ema200: 'EMA 200 hari, acuan tren jangka panjang. Harga di atas EMA200 umumnya dianggap tren naik.',
  sma50: 'Simple Moving Average 50 hari — rata-rata sederhana tanpa pembobotan.',
  sma200: 'SMA 200 hari, sering dipakai sebagai garis pemisah bull/bear.',
  ema50_slope: 'Perubahan EMA50 dalam 10 hari bursa terakhir (persen). Positif = tren menengah menanjak.',
  ma_cross:
    'Golden cross (+1) saat EMA50 melewati EMA200 ke atas dalam 10 hari terakhir; death cross (−1) saat melewati ke bawah.',
  adx: 'Average Directional Index (14) — kekuatan tren tanpa memandang arah. Di atas 25 biasanya tren kuat; di bawah 20 pasar menyamping.',
  pdi: 'Plus Directional Indicator — dominasi tekanan beli dalam perhitungan ADX.',
  mdi: 'Minus Directional Indicator — dominasi tekanan jual dalam perhitungan ADX.',
  rsi: 'Relative Strength Index (14) — momentum 0–100. Sistem ini menyukai 40–65 pada tren naik sehat dan mengurangi nilai di atas 75 karena jenuh beli.',
  macd_hist_pct:
    'Histogram MACD (12,26,9) dibagi harga dalam persen. Positif = momentum jangka pendek di atas jangka menengah.',
  stoch_k: 'Stochastic %K (14,3) — posisi harga penutupan dalam rentang 14 hari. Di atas 80 jenuh beli, di bawah 20 jenuh jual.',
  stoch_d: 'Stochastic %D, rata-rata 3 hari dari %K sebagai penanda arah.',
  roc20: 'Rate of Change 20 hari — persentase perubahan harga dalam 20 hari bursa.',
  rs_ihsg: 'Kekuatan relatif terhadap IHSG: return 60 hari saham dikurangi return 60 hari IHSG.',
  atr: 'Average True Range (14) — rata-rata rentang harian, ukuran volatilitas dalam rupiah.',
  atr_pct: 'ATR dibagi harga dalam persen. Makin besar, makin lebar ayunan harga harian.',
  bb_upper: 'Batas atas Bollinger Bands (20 hari, 2 simpangan baku).',
  bb_lower: 'Batas bawah Bollinger Bands.',
  pctb: '%B — posisi harga di dalam Bollinger Bands (0 = batas bawah, 1 = batas atas).',
  bandwidth: 'Lebar Bollinger Bands relatif terhadap harga tengah; mengecil menandakan pasar menyempit sebelum bergerak.',
  vol20: 'Volatilitas historis 20 hari (standar deviasi return harian, disetahunkan).',
  vol60: 'Volatilitas historis 60 hari, versi lebih halus dari vol20.',
  dd_1y: 'Drawdown maksimum dalam 1 tahun — penurunan terbesar dari puncak ke lembah.',
  volume_ratio: 'Volume hari ini dibagi rata-rata volume 20 hari. Di atas 1,5 menandakan minat pasar meningkat.',
  obv_net:
    'Akumulasi bersih On-Balance Volume 20 hari, dibagi volume rata-rata. Positif = volume lebih banyak masuk saat harga naik (akumulasi).',
  breakout: '+1 bila harga menembus tertinggi 20 hari dengan volume ≥ 1,5× rata-rata; −1 bila menembus terendah 20 hari.',
  swing_high: 'Titik ayunan tertinggi terakhir — kandidat resistance.',
  swing_low: 'Titik ayunan terendah terakhir — dasar perhitungan stop.',
  high_52w: 'Harga tertinggi 52 minggu terakhir.',
  low_52w: 'Harga terendah 52 minggu terakhir.',
  dist_high_52w: 'Jarak harga sekarang ke puncak 52 minggu dalam persen.',
  pivots: 'Pivot point klasik dari (tertinggi + terendah + penutupan)/3, beserta resistance R1 dan support S1.',
  beta: 'Kepekaan harga saham terhadap IHSG; 1 berarti bergerak searah sebesar pasar.',
  corr_ihsg: 'Korelasi return harian saham dengan IHSG dalam 60 hari terakhir.',
  value_avg20: 'Rata-rata nilai transaksi harian 20 hari (harga × volume). Filter likuiditas: minimal Rp5 miliar.',
  per: 'Price to Earnings Ratio — harga dibagi laba per saham. Makin kecil, makin murah secara relatif.',
  pbv: 'Price to Book Value — harga dibagi nilai buku ekuitas per saham.',
  roe: 'Return on Equity — laba bersih dibagi ekuitas, ukuran efisiensi modal (persen).',
  der: 'Debt to Equity Ratio — total utang dibagi ekuitas. Makin tinggi, makin berutang.',
  eps_growth: 'Pertumbuhan laba per saham (persen) dibanding periode sebelumnya.',
  dividend_yield: 'Dividen 12 bulan terakhir dibagi harga sekarang (persen).',
  market_cap: 'Kapitalisasi pasar — harga dikali jumlah saham beredar.',
  score: 'Skor komposit 0–100: gabungan lima kategori (tren 30, momentum 25, volume 15, risiko 10, fundamental 20). Bobot dibagikan ulang bila sebuah kategori tidak punya data.',
  signal: 'Beli bila skor ≥ 70, rezim pasar bukan Risk-off, likuid, dan rasio risiko:imbalan ≥ 1,5. Tahan bila skor 40–69. Hindari bila skor < 40.',
  regime:
    'Rezim pasar dari IHSG: Risk-on bila IHSG > EMA50 > EMA200, Risk-off bila IHSG < EMA50 < EMA200, selain itu Netral (jumlah posisi dikurangi separuh).',
  rr: 'Rasio risiko:imbalan — jarak ke target dibagi jarak ke stop. 1:2 berarti potensi untung dua kali potensi rugi.',
  entry: 'Estimasi harga masuk: harga buka hari bursa berikutnya (dalam simulasi, ditambah slippage 0,1%).',
  stop: 'Batas rugi: yang lebih rendah antara entry − 2×ATR dan swing low terakhir.',
  target: 'Sasaran laba: minimal 2× jarak stop, dibatasi resistance terdekat (pivot R1 atau puncak 52 minggu).',
  profit_factor: 'Total keuntungan dibagi total kerugian. Di atas 1 berarti sistem untung secara keseluruhan.',
  expectancy_r:
    'Rata-rata hasil per transaksi dalam satuan R (1 R = risiko awal). Positif berarti sistem menghasilkan rata-rata untung.',
  sharpe: 'Return per satuan risiko total (disetahunkan). Makin tinggi makin baik.',
  sortino: 'Seperti Sharpe, tetapi hanya menghukum volatilitas negatif.',
  max_drawdown: 'Penurunan terbesar ekuitas dari puncak ke lembah selama periode pengukuran.',
  turnover: 'Total nilai transaksi dibagi rata-rata ekuitas — gambaran seberapa sering portofolio berputar.',
  calibration:
    'Kalibrasi skor: rata-rata return transaksi dikelompokkan menurut skor saat masuk. Skor tinggi seharusnya menghasilkan return lebih baik.',
  hit_rate: 'Persentase transaksi yang untung.',
  lot: 'Satuan pembelian saham di IDX: 1 lot = 100 lembar. Pembelian dibulatkan ke bawah ke lot penuh.',
  fraksi: 'Kelipatan harga yang diizinkan di IDX (mis. Rp5 untuk harga 500–2.000). Harga isi simulasi dibulatkan ke fraksi ini.',
  fee: 'Biaya transaksi simulasi: beli 0,15%, jual 0,25% (termasuk pajak final). Sesuaikan dengan broker Anda.',
  t2: 'Dana hasil penjualan dianggap tersedia T+2 (dua hari bursa setelah transaksi).',
  scorecard:
    'Halaman evaluasi akurasi: membandingkan hasil simulasi dengan IHSG dan memeriksa kriteria kelayakan (minimal 60 hari bursa dan 30 transaksi, profit factor ≥ 1,3, drawdown ≤ 15%, expectancy positif, dan tidak bergantung pada satu transaksi).',
  replay:
    'Replay historis: mesin simulasi yang sama dijalankan pada data harga nyata masa lalu untuk memberi konteks awal. Ini in-sample dan tidak dipakai untuk menyatakan sistem layak.',
}

export function gloss(key: string): string {
  return GLOSSARY[key] ?? ''
}
