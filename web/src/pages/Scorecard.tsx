import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePortfolio, useScorecard, useUniverse, type Trade } from '../lib/api'
import { dateID, num, pct, pctRaw, rp, tone, toneClass } from '../lib/format'
import { Card, DataTable, Empty, ErrorBox, Skeleton, Stat, Tabs, type Column } from '../components/ui'
import { CalibrationChart, EquityChart, ReturnHistogram } from '../components/charts'

const CHECK_LABEL: Record<string, string> = {
  return_neto_lebih_tinggi_dari_ihsg: 'Return neto lebih tinggi dari IHSG',
  profit_factor_min: 'Profit factor ≥ 1,3',
  drawdown_maks: 'Max drawdown ≤ 15%',
  expectancy_positif: 'Expectancy positif',
  tidak_bergantung_satu_transaksi: 'Tidak bergantung pada satu transaksi',
}

export default function Scorecard() {
  const pf = usePortfolio()
  const sc = useScorecard()
  const uni = useUniverse()
  const [acc, setAcc] = useState<'A' | 'B'>('B')

  const sectors = useMemo(() => new Map((uni.data?.rows ?? []).map((r) => [r.code, r.sector])), [uni.data])
  const trades = useMemo(() => (pf.data?.accounts[acc]?.trades ?? []) as Trade[], [pf.data, acc])

  const bySector = useMemo(() => {
    const m = new Map<string, { n: number; pnl: number; wins: number }>()
    for (const t of trades) {
      const s = sectors.get(t.code) ?? 'Tidak diketahui'
      const cur = m.get(s) ?? { n: 0, pnl: 0, wins: 0 }
      cur.n += 1
      cur.pnl += t.pnl
      cur.wins += t.pnl > 0 ? 1 : 0
      m.set(s, cur)
    }
    return [...m.entries()]
      .map(([sector, v]) => ({ sector, ...v, hit: (v.wins / v.n) * 100 }))
      .sort((x, y) => y.pnl - x.pnl)
  }, [trades, sectors])

  const byRegime = useMemo(() => {
    const m = new Map<string, { n: number; pnl: number; wins: number }>()
    for (const t of trades) {
      const r = t.regime_at_entry ?? 'Tidak tercatat'
      const cur = m.get(r) ?? { n: 0, pnl: 0, wins: 0 }
      cur.n += 1
      cur.pnl += t.pnl
      cur.wins += t.pnl > 0 ? 1 : 0
      m.set(r, cur)
    }
    return [...m.entries()].map(([regime, v]) => ({ regime, ...v, hit: (v.wins / v.n) * 100 }))
  }, [trades])

  if (pf.isError || sc.isError) return <ErrorBox error={pf.error ?? sc.error} />
  if (pf.isLoading || sc.isLoading) return <Skeleton rows={6} height={20} />

  const account = sc.data?.accounts[acc]
  if (!account) return <Empty>Scorecard belum tersedia.</Empty>
  const a = account.all
  const l = account.live
  const verdict = account.verdict

  const metric = (label: string, all: number | null, live: number | null, fmt: (v: number | null) => string, tip?: string) => (
    <tr key={label}>
      <td className="l">{tip ? <abbr title={tip} className="cursor-help no-underline">{label}</abbr> : label}</td>
      <td className="num">{fmt(all)}</td>
      <td className="num text-muted">{fmt(live)}</td>
    </tr>
  )

  const tradeCols: Column<Trade>[] = [
    { key: 'code', label: 'Kode', align: 'l', render: (t) => <Link to={`/saham/${t.code}`} className="font-semibold hover:text-accent">{t.code}</Link> },
    { key: 'sector', label: 'Sektor', align: 'l', render: (t) => <span className="text-muted">{sectors.get(t.code) ?? '—'}</span> },
    { key: 'exit_date', label: 'Keluar', render: (t) => dateID(t.exit_date) },
    { key: 'return_pct', label: 'Return', render: (t) => <span className={`num ${toneClass[tone(t.return_pct)]}`}>{pct(t.return_pct)}</span> },
    { key: 'pnl', label: 'Laba/rugi', render: (t) => <span className={`num ${toneClass[tone(t.pnl)]}`}>{rp(t.pnl)}</span> },
    { key: 'score_at_entry', label: 'Skor masuk', render: (t) => <span className="num">{num(t.score_at_entry, 1)}</span> },
    { key: 'reason', label: 'Alasan keluar', align: 'l', render: (t) => <span className="text-muted">{t.reason}</span> },
    { key: 'phase', label: 'Fase', align: 'l', render: (t) => <span className={t.phase === 'live' ? 'text-accent' : 'text-muted'}>{t.phase === 'live' ? 'real-time' : 'replay'}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Scorecard akurasi</h1>
          <p className="text-xs text-muted">
            Perbandingan hasil simulasi dengan IHSG dan pemeriksaan kriteria kelayakan (PRD Bagian 9) · data {dateID(pf.data?.date)}
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
              Akun {k}
            </button>
          ))}
        </div>
      </div>

      <Card title={`Status: ${verdict.status}`} sub={account.basis}>
        <p className={`text-sm font-medium ${verdict.status === 'Layak' ? 'text-up' : verdict.status === 'Belum layak' ? 'text-down' : 'text-warn'}`}>
          {verdict.note}
        </p>
        {Object.keys(verdict.checks).length > 0 && (
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {Object.entries(verdict.checks).map(([k, ok]) => (
              <li key={k} className="flex items-center gap-2 text-xs">
                <span aria-hidden className={ok ? 'text-up' : 'text-down'}>
                  {ok ? '✔' : '✘'}
                </span>
                <span className="text-muted">{CHECK_LABEL[k] ?? k}</span>
              </li>
            ))}
          </ul>
        )}
        {account.replay_note && <p className="mt-3 text-[11px] text-muted">{account.replay_note}</p>}
        <p className="mt-2 text-[11px] text-muted">
          Status kelayakan hanya dihitung dari transaksi real-time (bukan replay in-sample) agar tidak menyesatkan.
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Return bersih (replay+RT)" value={pct(a.total_return_pct)} valueTone={a.total_return_pct} sub={`IHSG ${pct(a.benchmark_return_pct)}`} />
        <Stat label="Return real-time" value={pct(l.total_return_pct)} valueTone={l.total_return_pct} sub={`${l.days} hari bursa · ${l.n_trades} transaksi`} />
        <Stat label="Profit factor" value={num(a.profit_factor, 2)} sub="semua transaksi" />
        <Stat label="Expectancy" value={`${num(a.expectancy_r, 2)} R`} sub={`hit rate ${pctRaw(a.hit_rate_pct, 1)}`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Metrik lengkap" sub="Kolom real-time hanya menghitung hari-hari setelah replay" pad={false}>
          <div className="max-h-[420px] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l">Metrik</th>
                  <th>Replay + real-time</th>
                  <th>Real-time</th>
                </tr>
              </thead>
              <tbody>
                {metric('Hari bursa', a.days, l.days, (v) => num(v, 0))}
                {metric('Jumlah transaksi', a.n_trades, l.n_trades, (v) => num(v, 0))}
                {metric('Ekuitas akhir', a.final_equity, l.final_equity, (v) => rp(v))}
                {metric('Return total', a.total_return_pct, l.total_return_pct, (v) => pct(v))}
                {metric('Return tahunan', a.annualized_return_pct, l.annualized_return_pct, (v) => pct(v))}
                {metric('Return IHSG', a.benchmark_return_pct, l.benchmark_return_pct, (v) => pct(v))}
                {metric('Selisih vs IHSG', a.excess_return_pct, l.excess_return_pct, (v) => pct(v))}
                {metric('Max drawdown', a.max_drawdown_pct, l.max_drawdown_pct, (v) => pctRaw(v))}
                {metric('Sharpe', a.sharpe, l.sharpe, (v) => num(v, 2))}
                {metric('Sortino', a.sortino, l.sortino, (v) => num(v, 2))}
                {metric('Profit factor', a.profit_factor, l.profit_factor, (v) => num(v, 2))}
                {metric('Hit rate', a.hit_rate_pct, l.hit_rate_pct, (v) => pctRaw(v, 1))}
                {metric('Rata-rata menang', a.avg_win_pct, l.avg_win_pct, (v) => pct(v))}
                {metric('Rata-rata kalah', a.avg_loss_pct, l.avg_loss_pct, (v) => pct(v))}
                {metric('Expectancy (R)', a.expectancy_r, l.expectancy_r, (v) => num(v, 2))}
                {metric('Rata-rata hari holding', a.avg_holding_days, l.avg_holding_days, (v) => num(v, 1))}
                {metric('Turnover (×)', a.turnover_x, l.turnover_x, (v) => num(v, 2))}
                {metric('Tanpa transaksi terbaik', a.robust_without_best, l.robust_without_best, (v) => rp(v))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-3">
          <Card title={`Ekuitas ${account.label} vs IHSG`} sub="Dinormalisasi ke 100">
            <EquityChart points={pf.data?.accounts[acc]?.equity ?? []} label={`Akun ${acc}`} />
          </Card>
          <Card title="Alasan keluar posisi">
            {Object.keys(a.exit_reasons ?? {}).length ? (
              <ul className="space-y-1 text-xs">
                {Object.entries(a.exit_reasons).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-muted">{k === 'stop' ? 'Kena stop' : k === 'target' ? 'Kena target' : k === 'skor' ? 'Skor turun' : 'Batas waktu'}</span>
                    <span className="num">{v}×</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Belum ada transaksi.</Empty>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Distribusi return per transaksi" sub="Semua transaksi tertutup pada akun ini">
          <ReturnHistogram trades={trades} />
        </Card>
        <Card title="Kalibrasi skor" sub="Apakah skor tinggi menghasilkan return lebih baik?">
          <CalibrationChart calibration={a.calibration} />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Hasil per sektor" pad={false}>
          {bySector.length ? (
            <DataTable
              columns={[
                { key: 'sector', label: 'Sektor', align: 'l' },
                { key: 'n', label: 'Transaksi', render: (r) => <span className="num">{r.n}</span> },
                { key: 'hit', label: 'Hit rate', render: (r) => <span className="num">{pctRaw(r.hit, 1)}</span> },
                { key: 'pnl', label: 'Total laba/rugi', render: (r) => <span className={`num ${toneClass[tone(r.pnl)]}`}>{rp(r.pnl)}</span> },
              ]}
              rows={bySector}
              rowKey={(r) => r.sector}
              maxHeight={320}
            />
          ) : (
            <div className="p-4">
              <Empty>Belum ada transaksi.</Empty>
            </div>
          )}
        </Card>
        <Card title="Hasil per rezim pasar" sub="Rezim saat posisi dibuka" pad={false}>
          {byRegime.length ? (
            <DataTable
              columns={[
                { key: 'regime', label: 'Rezim', align: 'l' },
                { key: 'n', label: 'Transaksi', render: (r) => <span className="num">{r.n}</span> },
                { key: 'hit', label: 'Hit rate', render: (r) => <span className="num">{pctRaw(r.hit, 1)}</span> },
                { key: 'pnl', label: 'Total laba/rugi', render: (r) => <span className={`num ${toneClass[tone(r.pnl)]}`}>{rp(r.pnl)}</span> },
              ]}
              rows={byRegime}
              rowKey={(r) => r.regime}
              maxHeight={320}
            />
          ) : (
            <div className="p-4">
              <Empty>Belum ada transaksi.</Empty>
            </div>
          )}
        </Card>
      </div>

      <Card title="Riwayat transaksi akun ini" pad={false}>
        <DataTable columns={tradeCols} rows={[...trades].reverse()} rowKey={(t) => `${t.code}-${t.exit_date}`} maxHeight={420} />
      </Card>
    </div>
  )
}