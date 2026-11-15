import { Link, useNavigate } from 'react-router-dom'
import { useMeta, usePortfolio, useSignals, useUniverse, type UniverseRow } from '../lib/api'
import { compactRp, dateID, dateTimeID, num, pct, rp, tone, toneClass, arrow } from '../lib/format'
import { Card, Disclaimer, Empty, ErrorBox, PipelineStatus, RegimeBadge, SignalBadge, Skeleton, Stat, DataTable, type Column } from '../components/ui'
import { EquityChart } from '../components/charts'

export default function Dashboard() {
  const meta = useMeta()
  const uni = useUniverse()
  const sig = useSignals()
  const pf = usePortfolio()
  const nav = useNavigate()

  if (meta.isError || uni.isError) return <ErrorBox error={meta.error ?? uni.error} />
  const loading = meta.isLoading || uni.isLoading

  const rows = uni.data?.rows ?? []
  const gains = [...rows].filter((r) => r.change_pct !== null).sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0))
  const losers = [...gains].reverse()
  const volSpikes = [...rows].filter((r) => (r.volume_ratio ?? 0) >= 1.5).sort((a, b) => (b.volume_ratio ?? 0) - (a.volume_ratio ?? 0)).slice(0, 5)

  const cols: Column<UniverseRow>[] = [
    { key: 'code', label: 'Kode', align: 'l', render: (r) => <span className="font-semibold">{r.code}</span> },
    { key: 'name', label: 'Nama', align: 'l', render: (r) => <span className="text-muted">{r.name}</span> },
    { key: 'score', label: 'Skor', render: (r) => <span className="num font-semibold">{num(r.score, 1)}</span> },
    { key: 'signal', label: 'Sinyal', render: (r) => <SignalBadge signal={r.signal} /> },
    { key: 'entry', label: 'Entry', render: (r) => <span className="num">{rp(r.entry)}</span> },
    { key: 'stop', label: 'Stop', render: (r) => <span className="num text-down">{rp(r.stop)}</span> },
    { key: 'target', label: 'Target', render: (r) => <span className="num text-up">{rp(r.target)}</span> },
    { key: 'rr', label: 'R:R', render: (r) => <span className="num">{r.rr ? `1:${num(r.rr, 1)}` : '—'}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-xs text-muted">
            {uni.data ? `Data per ${dateID(uni.data.date)} · universe ${uni.data.benchmark} ${uni.data.count} saham · parameter ${uni.data.params_version}` : 'Memuat…'}
          </p>
        </div>
        {meta.data && <PipelineStatus status={meta.data.status} asOf={dateID(meta.data.as_of)} runAt={dateTimeID(meta.data.run_at)} />}
      </div>

      {loading && <Skeleton rows={2} />}

      {meta.data?.status === 'gagal' && (
        <div className="rounded-xl border border-down/40 bg-down/10 p-4 text-sm">
          <p className="font-semibold text-down">Pipeline berhenti — tidak ada rekomendasi baru</p>
          <p className="mt-1 text-muted">{meta.data.error ?? meta.data.messages?.join(' ')}</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="IHSG" sub={meta.data?.benchmark?.label ?? 'Benchmark'}>
          <div className="flex items-baseline justify-between">
            <span className="num text-2xl font-semibold">{num(meta.data?.benchmark?.close, 2)}</span>
            <span className={`num text-sm font-semibold ${toneClass[tone(meta.data?.benchmark?.change_pct)]}`}>
              <span aria-hidden>{arrow(meta.data?.benchmark?.change_pct)}</span> {pct(meta.data?.benchmark?.change_pct)}
            </span>
          </div>
          <dl className="mt-3 space-y-1 text-xs text-muted">
            <div className="flex justify-between">
              <dt>EMA50</dt>
              <dd className="num">{num(meta.data?.benchmark?.ema50, 1)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>EMA200</dt>
              <dd className="num">{num(meta.data?.benchmark?.ema200, 1)}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Rezim pasar" sub={uni.data?.regime.note}>
          <div className="flex items-center gap-3">
            <RegimeBadge state={uni.data?.regime.state ?? 'Netral'} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Risk-on: IHSG &gt; EMA50 &gt; EMA200. Risk-off: sebaliknya, dan sinyal Beli ditahan. Netral: jumlah posisi
            dikurangi separuh.
          </p>
        </Card>

        <Card title="Rekomendasi hari ini">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: 'Beli', v: sig.data?.n_buy, c: 'text-up' },
              { k: 'Tahan', v: sig.data?.n_hold, c: 'text-warn' },
              { k: 'Hindari', v: sig.data?.n_avoid, c: 'text-down' },
            ].map((x) => (
              <div key={x.k} className="rounded-lg border border-line bg-surface2 py-2">
                <div className={`num text-xl font-semibold ${x.c}`}>{x.v ?? '—'}</div>
                <div className="text-[11px] text-muted">{x.k}</div>
              </div>
            ))}
          </div>
          <Link to="/screener" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
            Buka screener lengkap →
          </Link>
        </Card>
      </div>

      <Card
        title="Top 10 rekomendasi"
        sub="Diurutkan dari skor komposit tertinggi; sinyal Beli hanya muncul bila lolos semua syarat"
        pad={false}
      >
        {sig.isLoading ? (
          <div className="p-4">
            <Skeleton />
          </div>
        ) : !sig.data?.items.length ? (
          <div className="p-4">
            <Empty>
              Tidak ada saham dengan sinyal Beli hari ini. Ini normal saat rezim Risk-off — sistem menahan diri.
            </Empty>
          </div>
        ) : (
          <DataTable
            columns={cols}
            rows={rows
              .filter((r) => sig.data!.items.some((i) => i.code === r.code))
              .slice(0, 10)}
            rowKey={(r) => r.code}
            onRowClick={(r) => nav(`/saham/${r.code}`)}
            maxHeight={420}
          />
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Ringkasan portofolio simulasi" sub="Dua akun dengan modal berbeda; order dibuat otomatis oleh pipeline">
          {pf.isLoading ? (
            <Skeleton />
          ) : pf.isError ? (
            <ErrorBox error={pf.error} />
          ) : (
            <div className="space-y-3">
              {Object.entries(pf.data?.accounts ?? {}).map(([k, a]) => {
                const sc = pf.data?.scorecard?.[k]
                return (
                  <div key={k} className="rounded-xl border border-line bg-surface2 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{a.state.label ?? `Akun ${k}`}</span>
                      <span className={`num text-sm font-semibold ${toneClass[tone(a.state.return_pct)]}`}>
                        <span aria-hidden>{arrow(a.state.return_pct)}</span> {pct(a.state.return_pct)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-muted">Ekuitas</div>
                        <div className="num">{compactRp(a.state.equity)}</div>
                      </div>
                      <div>
                        <div className="text-muted">Vs IHSG</div>
                        <div className={`num ${toneClass[tone(sc?.all.excess_return_pct)]}`}>{pct(sc?.all.excess_return_pct)}</div>
                      </div>
                      <div>
                        <div className="text-muted">Transaksi</div>
                        <div className="num">{sc?.all.n_trades ?? a.trades.length}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
              <Link to="/simulasi" className="inline-block text-xs font-medium text-accent hover:underline">
                Detail simulasi & order besok →
              </Link>
            </div>
          )}
        </Card>

        <Card title="Ekuitas Akun B vs IHSG" sub="Dinormalisasi ke 100 pada awal periode replay">
          {pf.data?.accounts.B ? <EquityChart points={pf.data.accounts.B.equity} label="Akun B" /> : <Skeleton />}
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Top gainers" sub="Perubahan harga 1 hari">
          <Movers rows={gains.slice(0, 5)} />
        </Card>
        <Card title="Top losers" sub="Perubahan harga 1 hari">
          <Movers rows={losers.slice(0, 5)} />
        </Card>
        <Card title="Lonjakan volume" sub="Volume ≥ 1,5× rata-rata 20 hari">
          {volSpikes.length ? (
            <ul className="space-y-2 text-xs">
              {volSpikes.map((r) => (
                <li key={r.code} className="flex items-center justify-between">
                  <Link to={`/saham/${r.code}`} className="font-semibold hover:text-accent">
                    {r.code}
                  </Link>
                  <span className="num text-muted">{num(r.volume_ratio, 2)}×</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Tidak ada lonjakan volume hari ini.</Empty>
          )}
        </Card>
      </div>

      <Card title="Tentang data" sub={`Pipeline terakhir ${dateTimeID(meta.data?.run_at)} (${meta.data?.duration_s ?? '—'} detik)`}>
        <p className="text-xs text-muted">{meta.data?.data_note}</p>
        <p className="mt-2 text-xs text-muted">
          {meta.data?.universe_ok}/{meta.data?.universe_total} saham lolos validasi · {meta.data?.n_errors ?? 0} error ·{' '}
          {meta.data?.n_warnings ?? 0} peringatan
        </p>
        {!!meta.data?.issues?.length && (
          <ul className="mt-2 max-h-32 space-y-1 overflow-auto text-[11px] text-warn">
            {meta.data.issues.slice(0, 12).map((i, n) => (
              <li key={n}>
                {i.code}: {i.msg}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <Disclaimer />
        </div>
      </Card>
    </div>
  )
}

function Movers({ rows }: { rows: UniverseRow[] }) {
  if (!rows.length) return <Empty>Belum ada data.</Empty>
  return (
    <ul className="space-y-2 text-xs">
      {rows.map((r) => (
        <li key={r.code} className="flex items-center justify-between gap-2">
          <Link to={`/saham/${r.code}`} className="font-semibold hover:text-accent">
            {r.code}
          </Link>
          <span className="flex items-center gap-2">
            <span className="num text-muted">{rp(r.price)}</span>
            <span className={`num ${toneClass[tone(r.change_pct)]}`}>{pct(r.change_pct)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}