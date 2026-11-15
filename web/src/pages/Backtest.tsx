import { Card, Empty, Info } from '../components/ui'

export default function Backtest() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Backtest walk-forward</h1>
        <p className="text-xs text-muted">Fase 2 — belum aktif. Halaman ini menampilkan rencana dan gerbang kelayakannya.</p>
      </div>

      <Card title="Belum tersedia" sub="Sengaja ditahan sampai sistem dasar terbukti">
        <Empty>
          Halaman ini akan berisi hasil walk-forward (melatih dan menguji pada periode berurutan tanpa kebocoran data),
          uji sensitivitas bobot, dan perbandingan dengan beli-dan-tahan IHSG. Saat ini pipeline baru sampai pada
          evaluasi simulasi (Scorecard).
        </Empty>
        <p className="mt-3 text-xs text-muted">
          Alasan penundaan: menambahkan lapisan optimasi sebelum sistem dasar terbukti hanya menghasilkan kurva yang
          bagus di masa lalu tanpa bukti apa pun untuk masa depan.
        </p>
      </Card>

      <Card title="Gerbang menuju Fase 2 (ML)" sub="Harus dipenuhi lebih dulu">
        <ol className="list-inside list-decimal space-y-1.5 text-sm text-muted">
          <li>Minimal 60 hari bursa dan 30 transaksi tertutup pada fase real-time.</li>
          <li>Return neto lebih tinggi dari IHSG pada periode yang sama.</li>
          <li>Profit factor ≥ 1,3 dan expectancy positif.</li>
          <li>Max drawdown ≤ 15% dan hasil tidak bergantung pada satu transaksi terbaik.</li>
          <li>Hasil walk-forward tetap positif setelah biaya, slippage, dan fraksi harga diterapkan.</li>
        </ol>
        <p className="mt-3 text-xs text-muted">
          Bila salah satu tidak terpenuhi, prioritasnya memperbaiki aturan dasar — bukan menambah model.
        </p>
      </Card>

      <Card title="Yang akan diukur">
        <ul className="space-y-1.5 text-sm text-muted">
          <li>Return, Sharpe, Sortino, dan max drawdown per jendela (mis. 6 bulan latih / 3 bulan uji).</li>
          <li>Stabilitas parameter: apakah bobot terbaik di satu jendela masih baik di jendela berikutnya.</li>
          <li>Uji sensitivitas: geser setiap ambang ±10% dan lihat apakah kesimpulan berubah.</li>
          <li>Perbandingan dengan pembanding sederhana: beli-dan-tahan IHSG dan beli-dan-tahan tiap konstituen.</li>
          <li>Uji statistik: apakah selisih return lebih besar dari variasi acak (mis. bootstrap).</li>
        </ul>
        <p className="mt-3 text-[11px] text-muted">
          <Info term="Walk-forward" text="Metode pengujian yang membagi data menjadi beberapa periode berurutan: parameter dioptimalkan pada periode latih, lalu diuji pada periode setelahnya yang belum pernah dilihat. Ini meniru kondisi nyata dan mengurangi risiko overfitting." />
        </p>
      </Card>
    </div>
  )
}