import { GLOSSARY } from '../lib/glossary'
import { Card, Disclaimer, Info } from '../components/ui'

const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Tren', keys: ['ema_stack', 'ema20', 'ema50', 'ema200', 'sma50', 'sma200', 'ema50_slope', 'ma_cross', 'adx', 'pdi', 'mdi'] },
  { title: 'Momentum', keys: ['rsi', 'macd_hist_pct', 'stoch_k', 'stoch_d', 'roc20', 'rs_ihsg'] },
  { title: 'Volume & likuiditas', keys: ['volume_ratio', 'obv_net', 'breakout', 'value_avg20'] },
  { title: 'Volatilitas & risiko', keys: ['atr', 'atr_pct', 'vol20', 'vol60', 'dd_1y', 'bb_upper', 'bb_lower', 'pctb', 'bandwidth', 'beta', 'corr_ihsg'] },
  { title: 'Fundamental', keys: ['per', 'pbv', 'roe', 'der', 'eps_growth', 'dividend_yield', 'market_cap'] },
  { title: 'Skor, sinyal, dan level', keys: ['score', 'signal', 'regime', 'rr', 'entry', 'stop', 'target', 'swing_high', 'swing_low', 'high_52w', 'low_52w', 'dist_high_52w', 'pivots'] },
  { title: 'Simulasi & evaluasi', keys: ['lot', 'fraksi', 'fee', 't2', 'replay', 'scorecard', 'profit_factor', 'expectancy_r', 'sharpe', 'sortino', 'max_drawdown', 'turnover', 'calibration', 'hit_rate'] },
]

export default function Guide() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Panduan & glosarium</h1>
        <p className="text-xs text-muted">
          Cara membaca skor, sinyal, dan metrik. Semua angka dihitung oleh pipeline deterministik — tidak ada model
          bahasa yang menghitung atau menambah angka.
        </p>
      </div>

      <Card title="Alur singkat" sub="Dari data pasar ke rekomendasi">
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted">
          <li>Pipeline mengunduh harga harian saham LQ45 dan IHSG, lalu memvalidasi kelengkapan dan likuiditasnya.</li>
          <li>Indikator dihitung dari <strong className="text-fg">harga adjusted</strong>; level transaksi dikonversi ke <strong className="text-fg">harga mentah</strong> karena itu yang benar-benar dieksekusi di pasar.</li>
          <li>Setiap faktor dinilai 0–100 lewat kurva di <code className="num">config/scoring.yaml</code>, lalu digabung menjadi skor komposit 0–100.</li>
          <li>Skor dan rezim pasar menentukan sinyal <strong className="text-up">Beli</strong>, <strong className="text-warn">Tahan</strong>, atau <strong className="text-down">Hindari</strong>, beserta level entry, stop, dan target.</li>
          <li>Mesin simulasi mengubah sinyal Beli menjadi order, menghitung ukuran posisi dari risiko 2% ekuitas, dan mencatat hasilnya.</li>
          <li>Halaman Scorecard membandingkan hasil dengan IHSG dan memeriksa kriteria kelayakan (minimal 60 hari bursa dan 30 transaksi).</li>
        </ol>
      </Card>

      <Card title="Batas & keterbatasan" sub="Yang perlu Anda sadari sebelum memakai rekomendasi ini">
        <ul className="list-inside list-disc space-y-1.5 text-sm text-muted">
          <li>Ini <strong className="text-fg">bukan nasihat keuangan</strong>. Semua keputusan dan risiko ada pada pengguna.</li>
          <li>Sumber data adalah Yahoo Finance dan dapat terlambat, kosong, atau keliru untuk saham IDX. Metadata fundamental sering tidak tersedia untuk emiten kecil.</li>
          <li>Simulasi belum memperhitungkan ARA/ARB per hari secara rinci, likuiditas saat eksekusi, atau antrean order.</li>
          <li>Kurva ekuitas sebelum tanggal mulai real-time berasal dari replay historis (in-sample) dan <em>tidak</em> membuktikan kinerja ke depan.</li>
          <li>Backtest walk-forward dan eksperimen ML (Fase 2) belum dijalankan dan memang sengaja ditahan sampai sistem dasar terbukti.</li>
        </ul>
        <div className="mt-3">
          <Disclaimer />
        </div>
      </Card>

      {GROUPS.map((g) => (
        <Card key={g.title} title={g.title}>
          <dl className="grid gap-2 md:grid-cols-2">
            {g.keys.map((k) => (
              <div key={k} className="rounded-lg border border-line bg-surface2 px-3 py-2">
                <dt className="num text-xs font-semibold">
                  <Info term={k} text={GLOSSARY[k]} />
                </dt>
                <dd className="mt-0.5 text-xs text-muted">{GLOSSARY[k]}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  )
}