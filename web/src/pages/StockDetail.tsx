import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useIndicator, usePortfolio, usePrices, type Factor } from '../lib/api'
import { compactRp, dateID, num, pct, pctRaw, rp, tone, toneClass } from '../lib/format'
import {
  Card,
  ContributionBars,
  DataTable,
  Empty,
  ErrorBox,
  Info,
  ScoreGauge,
  SignalBadge,
  Skeleton,
  Stat,
  Tabs,
  type Column,
} from '../components/ui'
import { CandleChart } from '../components/charts'

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'chart', label: 'Chart' },
  { key: 'teknikal', label: 'Teknikal' },
  { key: 'fundamental', label: 'Fundamental' },
  { key: 'risiko', label: 'Risiko & Likuiditas' },
  { key: 'riwayat', label: 'Riwayat Sinyal' },
  { key: 'penjelasan', label: 'Penjelasan' },
]

const FUND_KEYS: { key: string; label: string; digits: number; suffix?: string }[] = [
  { key: 'per', label: 'PER', digits: 2 },
  { key: 'pbv', label: 'PBV', digits: 2 },
  { key: 'roe', label: 'ROE', digits: 2, suffix: '%' },
  { key: 'der', label: 'DER', digits: 2 },
  { key: 'eps_growth', label: 'Pertumbuhan EPS', digits: 2, suffix: '%' },
  { key: 'dividend_yield', label: 'Dividend yield', digits: 2, suffix: '%' },
]

export default function StockDetail() {
  const { code = '' } = useParams()
  const ind = useIndicator(code)
  const prices = usePrices(code)
  const pf = usePortfolio()
  const [tab, setTab] = useState('ringkasan')

  const trades = useMemo(
    () => (pf.data?.accounts.B?.trades ?? []).filter((t) => t.code === code),
    [pf.data, code],
  )

  if (ind.isError) return <ErrorBox error={ind.error} />
  if (ind.isLoading) return <Skeleton rows={6} height={20} />

  const d = ind.data!
  const lv = d.levels
  const pos = pf.data?.accounts.B?.state.positions.find((p) => p.code === code)

  const sizeFor = (equity: number, maxWeight: number) => {
    const entry = lv.entry
    const stop = lv.stop
    if (!entry || !stop) return 0
    const dist = entry - stop
    if (dist <= 0) return 0
    return Math.max(0, Math.min(Math.floor((0.02 * equity) / (dist * 100)), Math.floor((equity * maxWeight) / (entry * 100))))
  }

  const techCols: Column<{ name: string; cat: string; label: string; f: Factor }>[] = [
    { key: 'label', label: 'Kategori', align: 'l' },
    { key: 'name', label: 'Indikator', align: 'l', render: (r) => <Info term={r.name} text={r.f.desc} /> },
    { key: 'value', label: 'Nilai', render: (r) => <span className="num">{num(r.f.value, 2)}</span> },
    { key: 'score', label: 'Skor faktor', render: (r) => <span className="num">{num(r.f.score, 0)}</span> },
    { key: 'weight', label: 'Bobot', render: (r) => <span className="num text-muted">{num(r.f.weight, 0)}</span> },
    { key: 'desc', label: 'Interpretasi', align: 'l', render: (r) => <span className="text-muted">{r.f.desc}</span> },
  ]

  const factorRows = Object.entries(d.factors).flatMap(([cat, fs]) =>
    Object.entries(fs).map(([name, f]) => ({ name, cat, label: d.categories[cat]?.label ?? cat, f })),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{d.code}</h1>
            <SignalBadge signal={d.signal} />
          </div>
          <p className="text-xs text-muted">
            {d.name} · {d.sector ?? 'sektor tidak tersedia'} · data {dateID(d.date)} · parameter {d.params_version}
          </p>
        </div>
        <Link to="/screener" className="text-xs font-medium text-accent hover:underline">
          ← kembali ke screener
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Harga terakhir" value={rp(d.price)} sub={`Entry ${rp(lv.entry)}`} />
        <Stat label="Skor komposit" value={num(d.score, 1)} sub="dari 100" tip="score" />
        <Stat label="Rasio risiko:imbalan" value={lv.rr ? `1:${num(lv.rr, 1)}` : '—'} sub={`risiko/lembar ${rp(lv.risk_per_share)}`} tip="rr" />
        <Stat label="Nilai transaksi 20 hari" value={compactRp(d.risk.value_avg20 as number)} sub="rata-rata per hari" tip="value_avg20" />
      </div>

      <Card pad={false}>
        <div className="px-3 pt-2">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />
        </div>

        <div className="p-4">
          {tab === 'ringkasan' && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="flex flex-col items-center gap-2">
                <ScoreGauge score={d.score} size={140} />
                <div className="w-full space-y-1 text-xs">
                  {Object.entries(d.categories).map(([k, c]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-muted">{c.label}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${c.score ?? 0}%` }} />
                      </div>
                      <span className="num w-16 text-right">{num(c.score, 0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-xl border border-line bg-surface2 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Level rencana</h3>
                  <dl className="mt-2 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted">Entry (estimasi)</dt>
                      <dd className="num">{rp(lv.entry)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Stop</dt>
                      <dd className="num text-down">{rp(lv.stop)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Target</dt>
                      <dd className="num text-up">{rp(lv.target)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Risiko per lembar</dt>
                      <dd className="num">{rp(lv.risk_per_share)}</dd>
                    </div>
                  </dl>
                  {lv.capped_by_resistance && <p className="mt-2 text-[11px] text-warn">Target dipotong ke resistance terdekat.</p>}
                  {lv.note && <p className="mt-2 text-[11px] text-warn">{lv.note}</p>}
                </div>

                <div className="rounded-xl border border-line bg-surface2 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Contoh ukuran posisi</h3>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li className="flex justify-between">
                      <span className="text-muted">Akun A (Rp1 jt, maks 2 posisi)</span>
                      <span className="num">{sizeFor(1_000_000, 0.5)} lot</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-muted">Akun B (Rp20 jt, maks 8 posisi)</span>
                      <span className="num">{sizeFor(20_000_000, 0.15)} lot</span>
                    </li>
                    {pos && (
                      <li className="flex justify-between border-t border-line pt-1">
                        <span className="text-muted">Posisi simulasi aktif</span>
                        <span className="num text-accent">{pos.lots} lot @ {rp(pos.entry_price)}</span>
                      </li>
                    )}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted">Risiko 2% ekuitas per transaksi ÷ jarak stop, dibatasi bobot maksimum per saham.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Faktor pendukung</h3>
                  <ul className="mt-1 space-y-1 text-xs">
                    {d.contributions.filter((c) => c.contribution > 0).slice(0, 3).map((c) => (
                      <li key={c.factor} className="flex justify-between gap-2">
                        <span className="truncate">{c.desc}</span>
                        <span className="num text-up">+{num(c.contribution, 1)}</span>
                      </li>
                    ))}
                    {!d.contributions.some((c) => c.contribution > 0) && <li className="text-muted">Tidak ada.</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Faktor penentang</h3>
                  <ul className="mt-1 space-y-1 text-xs">
                    {d.contributions.filter((c) => c.contribution < 0).slice(-3).map((c) => (
                      <li key={c.factor} className="flex justify-between gap-2">
                        <span className="truncate">{c.desc}</span>
                        <span className="num text-down">−{num(Math.abs(c.contribution), 1)}</span>
                      </li>
                    ))}
                    {!d.contributions.some((c) => c.contribution < 0) && <li className="text-muted">Tidak ada.</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Kontribusi faktor</h3>
                  <div className="mt-2">
                    <ContributionBars items={d.contributions} limit={6} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'chart' && (
            prices.isLoading ? (
              <Skeleton rows={5} height={40} />
            ) : prices.isError ? (
              <ErrorBox error={prices.error} />
            ) : (
              <CandleChart prices={prices.data!} indicator={d} trades={trades} />
            )
          )}

          {tab === 'teknikal' && (
            <div className="space-y-3">
              <p className="text-xs text-muted">
                Skor faktor 0–100 dari kurva di <code className="num">config/scoring.yaml</code>. Faktor tanpa data tidak
                dihitung dan bobotnya dibagikan ke faktor lain dalam kategori yang sama.
              </p>
              <DataTable columns={techCols} rows={factorRows} rowKey={(r) => `${r.cat}-${r.name}`} maxHeight={520} />
            </div>
          )}

          {tab === 'fundamental' && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="l">Metrik</th>
                      <th>Nilai</th>
                      <th>Median universe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FUND_KEYS.map((k) => {
                      const v = d.fundamentals[k.key] as number | null
                      const m = d.medians?.[k.key] ?? null
                      return (
                        <tr key={k.key}>
                          <td className="l">
                            <Info term={k.label} text={undefined} />
                          </td>
                          <td className="num">{v === null || v === undefined ? <span className="text-muted">tidak tersedia</span> : `${num(v, k.digits)}${k.suffix ?? ''}`}</td>
                          <td className="num text-muted">{m === null ? '—' : `${num(m, k.digits)}${k.suffix ?? ''}`}</td>
                        </tr>
                      )
                    })}
                    <tr>
                      <td className="l">Kapitalisasi pasar</td>
                      <td className="num">{compactRp(d.fundamentals.market_cap as number)}</td>
                      <td className="text-muted">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 text-xs text-muted">
                <p>
                  Fundamental diambil dari Yahoo Finance dan bisa kosong atau terlambat untuk saham IDX. Bila sebuah
                  metrik tidak tersedia, bobot kategori fundamental dibagikan ke kategori lain dan hal ini dicatat pada
                  penjelasan.
                </p>
                <p>
                  Perbandingan memakai median seluruh universe LQ45, bukan rata-rata, agar tidak terpengaruh nilai ekstrem.
                </p>
              </div>
            </div>
          )}

          {tab === 'risiko' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="ATR (14)" value={rp(d.risk.atr)} sub={`${num(d.risk.atr_pct, 2)}% dari harga`} tip="atr" />
              <Stat label="Volatilitas 20 hari" value={pctRaw(d.risk.vol20)} tip="vol20" />
              <Stat label="Volatilitas 60 hari" value={pctRaw(d.risk.vol60)} tip="vol60" />
              <Stat label="Drawdown maks 1 tahun" value={pctRaw(d.risk.dd_1y)} tip="dd_1y" />
              <Stat label="Beta vs IHSG" value={num(d.risk.beta, 2)} tip="beta" />
              <Stat label="Korelasi IHSG (60 hari)" value={num(d.risk.corr_ihsg, 2)} tip="corr_ihsg" />
              <Stat label="Nilai transaksi 20 hari" value={compactRp(d.risk.value_avg20 as number)} sub={d.risk.value_avg20 && (d.risk.value_avg20 as number) < 5e9 ? 'di bawah filter likuiditas' : 'lolos filter likuiditas'} tip="value_avg20" />
              <Stat label="Puncak 52 minggu" value={rp(d.risk.high_52w)} sub={`jarak ${pct(d.risk.dist_high_52w)}`} tip="high_52w" />
              <Stat label="Dasar 52 minggu" value={rp(d.risk.low_52w)} tip="low_52w" />
              <Stat label="Swing low terakhir" value={rp(d.risk.swing_low)} tip="swing_low" />
              <Stat label="Swing high terakhir" value={rp(d.risk.swing_high)} tip="swing_high" />
              <Stat
                label="Pivot / R1 / S1"
                value={`${num((d.risk.pivots as unknown as Record<string, number>)?.pivot, 0)}`}
                sub={`R1 ${num((d.risk.pivots as unknown as Record<string, number>)?.r1, 0)} · S1 ${num((d.risk.pivots as unknown as Record<string, number>)?.s1, 0)}`}
                tip="pivots"
              />
            </div>
          )}

          {tab === 'riwayat' && (
            d.signal_history.length ? (
              <div className="space-y-2">
                <p className="text-xs text-muted">
                  Sinyal Beli historis (replay tanpa faktor fundamental) beserta return aktual 5/10/20 hari bursa
                  setelahnya di harga mentah. Ini bukan hasil backtest walk-forward.
                </p>
                <DataTable
                  columns={[
                    { key: 'date', label: 'Tanggal', align: 'l', render: (r) => dateID(r.date) },
                    { key: 'score', label: 'Skor', render: (r) => <span className="num">{num(r.score, 1)}</span> },
                    { key: 'entry', label: 'Entry', render: (r) => <span className="num">{rp(r.entry)}</span> },
                    { key: 'stop', label: 'Stop', render: (r) => <span className="num text-down">{rp(r.stop)}</span> },
                    { key: 'target', label: 'Target', render: (r) => <span className="num text-up">{rp(r.target)}</span> },
                    { key: 'ret5', label: '5 hari', render: (r) => <span className={`num ${toneClass[tone(r.ret5)]}`}>{pct(r.ret5)}</span> },
                    { key: 'ret10', label: '10 hari', render: (r) => <span className={`num ${toneClass[tone(r.ret10)]}`}>{pct(r.ret10)}</span> },
                    { key: 'ret20', label: '20 hari', render: (r) => <span className={`num ${toneClass[tone(r.ret20)]}`}>{pct(r.ret20)}</span> },
                  ]}
                  rows={[...d.signal_history].reverse()}
                  rowKey={(r) => r.date}
                  maxHeight={480}
                />
              </div>
            ) : (
              <Empty>Belum ada sinyal Beli historis untuk saham ini dalam jendela replay.</Empty>
            )
          )}

          {tab === 'penjelasan' && (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed">{d.explanation}</p>
              {!!d.signal_reasons.length && (
                <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs">
                  <p className="font-semibold text-warn">Alasan sinyal tidak penuh</p>
                  <ul className="mt-1 list-inside list-disc text-muted">
                    {d.signal_reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[11px] text-muted">
                Paragraf ini disusun dari template berdasarkan aturan yang terpenuhi — tidak ada model bahasa yang
                menghitung atau menambah angka di sini.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}