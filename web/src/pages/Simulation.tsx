import { useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio, useUniverse, type Order, type Position, type Trade } from '../lib/api'
import { compactRp, dateID, num, pct, rp, tone, toneClass } from '../lib/format'
import { Card, DataTable, Empty, ErrorBox, Skeleton, Stat, Tabs, type Column } from '../components/ui'
import { AllocationBars, EquityChart } from '../components/charts'

export default function Simulation() {
  const pf = usePortfolio()
  const uni = useUniverse()
  const [acc, setAcc] = useState<'A' | 'B'>('B')

  if (pf.isError) return <ErrorBox error={pf.error} />
  if (pf.isLoading) return <Skeleton rows={6} height={20} />

  const account = pf.data?.accounts[acc]
  if (!account) return <Empty>Akun {acc} belum tersedia. Jalankan pipeline terlebih dahulu.</Empty>
  const sc = pf.data?.scorecard[acc]
  const equity = account.equity
  const sectors = new Map((uni.data?.rows ?? []).map((r) => [r.code, r.sector]))
  const trades = account.trades

  const posCols: Column<Position>[] = [
    { key: 'code', label: 'Kode', align: 'l', render: (p) => <Link to={`/saham/${p.code}`} className="font-semibold hover:text-accent">{p.code}</Link> },
    { key: 'lots', label: 'Lot', render: (p) => <span className="num">{p.lots}</span> },
    { key: 'entry_price', label: 'Harga masuk', render: (p) => <span className="num">{rp(p.entry_price)}</span> },
    { key: 'stop', label: 'Stop', render: (p) => <span className="num text-down">{rp(p.stop)}</span> },
    { key: 'target', label: 'Target', render: (p) => <span className="num text-up">{rp(p.target)}</span> },
    { key: 'cost_total', label: 'Nilai', render: (p) => <span className="num">{compactRp(p.cost_total)}</span> },
    { key: 'bars_held', label: 'Hari', render: (p) => <span className="num">{p.bars_held}</span> },
    { key: 'score_at_entry', label: 'Skor masuk', render: (p) => <span className="num">{num(p.score_at_entry, 1)}</span> },
    { key: 'opened', label: 'Dibuka', render: (p) => dateID(p.opened) },
  ]

  const tradeCols: Column<Trade>[] = [
    { key: 'code', label: 'Kode', align: 'l', render: (t) => <Link to={`/saham/${t.code}`} className="font-semibold hover:text-accent">{t.code}</Link> },
    { key: 'sector', label: 'Sektor', align: 'l', render: (t) => <span className="text-muted">{sectors.get(t.code) ?? '—'}</span> },
    { key: 'entry_date', label: 'Masuk', render: (t) => dateID(t.entry_date) },
    { key: 'exit_date', label: 'Keluar', render: (t) => dateID(t.exit_date) },
    { key: 'lots', label: 'Lot', render: (t) => <span className="num">{t.lots}</span> },
    { key: 'entry_price', label: 'Harga masuk', render: (t) => <span className="num">{rp(t.entry_price)}</span> },
    { key: 'exit_price', label: 'Harga keluar', render: (t) => <span className="num">{rp(t.exit_price)}</span> },
    { key: 'return_pct', label: 'Return', render: (t) => <span className={`num ${toneClass[tone(t.return_pct)]}`}>{pct(t.return_pct)}</span> },
    { key: 'pnl', label: 'Laba/rugi', render: (t) => <span className={`num ${toneClass[tone(t.pnl)]}`}>{rp(t.pnl)}</span> },
    { key: 'r_multiple', label: 'R', render: (t) => <span className="num">{num(t.r_multiple, 2)}</span> },
    { key: 'bars_held', label: 'Hari', render: (t) => <span className="num">{t.bars_held}</span> },
    { key: 'reason', label: 'Alasan keluar', align: 'l', render: (t) => <span className="text-muted">{t.reason}</span> },
    { key: 'phase', label: 'Fase', align: 'l', render: (t) => <span className={t.phase === 'live' ? 'text-accent' : 'text-muted'}>{t.phase === 'live' ? 'real-time' : 'replay'}</span> },
  ]

  const orderCols: Column<Order>[] = [
    { key: 'code', label: 'Kode', align: 'l', render: (o) => <span className="font-semibold">{o.code}</span> },
    { key: 'status', label: 'Status', align: 'l', render: (o) => <span className={o.status === 'terisi' ? 'text-up' : 'text-warn'}>{o.status}</span> },
    { key: 'date', label: 'Dibuat', render: (o) => dateID(o.date) },
    { key: 'for_date', label: 'Untuk', render: (o) => (o.for_date ? dateID(o.for_date) : '—') },
    { key: 'lots', label: 'Lot', render: (o) => <span className="num">{o.lots}</span> },
    { key: 'price', label: 'Harga isi', render: (o) => <span className="num">{o.price ? rp(o.price) : '—'}</span> },
    { key: 'stop', label: 'Stop', render: (o) => <span className="num text-down">{rp(o.stop)}</span> },
    { key: 'target', label: 'Target', render: (o) => <span className="num text-up">{rp(o.target)}</span> },
    { key: 'score', label: 'Skor', render: (o) => <span className="num">{num(o.score, 1)}</span> },
  ]

  const pending = account.state.pending_orders ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Simulasi portofolio</h1>
          <p className="text-xs text-muted">
            Order dibuat otomatis oleh pipeline dari rekomendasi (tidak ada input manual) · data {dateID(pf.data?.date)} ·
            parameter {pf.data?.params_version}
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Pilih akun">
          {(['A', 'B'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setAcc(k)}
              aria-pressed={acc === k}
              className={`px-3 py-1.5 text-xs font-semibold ${acc === k ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}
            >
              {pf.data?.accounts[k]?.state.label ?? `Akun ${k}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Ekuitas" value={compactRp(account.state.equity)} sub={`awal ${compactRp(account.state.initial_cash)}`} />
        <Stat label="Return" value={pct(account.state.return_pct)} valueTone={account.state.return_pct} sub={`vs IHSG ${pct(sc?.all.benchmark_return_pct)}`} />
        <Stat label="Selisih vs IHSG" value={pct(sc?.all.excess_return_pct)} valueTone={sc?.all.excess_return_pct} sub="periode yang sama" />
        <Stat label="Kas" value={compactRp(account.state.cash)} sub={`${account.state.positions.length}/${account.state.max_positions} posisi terbuka`} />
        <Stat label="Max drawdown" value={pct(sc?.all.max_drawdown_pct)} valueTone={sc?.all.max_drawdown_pct} sub={`${sc?.all.n_trades ?? 0} transaksi tertutup`} />
      </div>

      <Card
        title="Order direncanakan untuk besok"
        sub="Dibuat setelah penutupan hari ini; akan terisi di harga buka hari bursa berikutnya + slippage 0,1%"
        pad={false}
      >
        {pending.length ? (
          <DataTable columns={orderCols} rows={pending} rowKey={(o) => `${o.code}-${o.for_date}`} maxHeight={280} />
        ) : (
          <div className="p-4">
            <Empty>Tidak ada order baru yang direncanakan (tidak ada sinyal Beli atau slot posisi penuh).</Empty>
          </div>
        )}
      </Card>

      <Card title="Posisi terbuka" pad={false}>
        {account.state.positions.length ? (
          <DataTable columns={posCols} rows={account.state.positions} rowKey={(p) => p.code} maxHeight={320} />
        ) : (
          <div className="p-4">
            <Empty>Tidak ada posisi terbuka.</Empty>
          </div>
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title={`Ekuitas ${account.state.label} vs IHSG`} sub="Dinormalisasi ke 100 di awal periode" className="lg:col-span-2">
          <EquityChart points={equity} label={`Akun ${acc}`} />
          <p className="mt-2 text-[11px] text-muted">
            Fase <span className="text-accent">real-time</span> dimulai pada hari terakhir; sebelum itu kurva berasal dari
            replay historis (in-sample) yang hanya dipakai sebagai konteks awal.
          </p>
        </Card>
        <Card title="Alokasi posisi" sub="Berdasarkan harga masuk × jumlah lot">
          <AllocationBars positions={account.state.positions} />
        </Card>
      </div>

      <Card title="Riwayat transaksi" sub={`${trades.length} transaksi tertutup (termasuk fase replay)`} pad={false}>
        {trades.length ? (
          <DataTable columns={tradeCols} rows={[...trades].reverse()} rowKey={(t) => `${t.code}-${t.exit_date}`} maxHeight={480} />
        ) : (
          <div className="p-4">
            <Empty>Belum ada transaksi tertutup.</Empty>
          </div>
        )}
      </Card>

      <Card title="Log order" sub="Semua order dan isian dicatat dengan parameter versi terkait" pad={false}>
        <DataTable columns={orderCols} rows={[...account.orders].reverse()} rowKey={(o, i) => `${o.code}-${o.date}-${o.status}-${i}`} maxHeight={360} />
      </Card>

      <Card title="Aturan simulasi yang dipakai">
        <ul className="list-inside list-disc space-y-1 text-xs text-muted">
          <li>Rekomendasi dibuat setelah penutupan hari T; order beli terisi di harga buka T+1 ditambah slippage 0,1%.</li>
          <li>1 lot = 100 lembar; harga isi dibulatkan ke fraksi harga IDX.</li>
          <li>Fee beli 0,15% dan jual 0,25% (termasuk pajak final) — sesuaikan dengan broker Anda.</li>
          <li>Ukuran posisi: risiko 2% ekuitas ÷ jarak stop, dibatasi bobot maksimum per saham; kurang dari 1 lot dilewati.</li>
          <li>Jika harga buka melewati stop, keluar di harga buka (bukan di harga stop). Stop dicek sebelum target bila keduanya tersentuh di hari yang sama.</li>
          <li>Dana hasil jual tersedia T+2. Tidak ada short selling, leverage, atau order di saham suspensi.</li>
          <li>Reset akun hanya lewat <code className="num">config/sim.yaml</code> + commit agar versi parameter tercatat.</li>
        </ul>
      </Card>
    </div>
  )
}