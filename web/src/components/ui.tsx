import { useMemo, useState, type ReactNode } from 'react'
import { GLOSSARY } from '../lib/glossary'
import { arrow, num, pct, tone, toneClass } from '../lib/format'

export function Card({
  title,
  sub,
  right,
  children,
  className = '',
  pad = true,
}: {
  title?: ReactNode
  sub?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  pad?: boolean
}) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-wide">{title}</h2>}
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  sub,
  valueTone,
  tip,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  valueTone?: number | null
  tip?: string
}) {
  const t = tone(valueTone)
  return (
    <div className="rounded-xl border border-line bg-surface2 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted">
        {tip ? <Info term={label} text={tip} /> : label}
      </div>
      <div className={`num mt-1 text-lg font-semibold ${valueTone === undefined ? '' : toneClass[t]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function SignalBadge({ signal }: { signal: string }) {
  const map: Record<string, string> = {
    Beli: 'bg-up/15 text-up border-up/40',
    Tahan: 'bg-warn/15 text-warn border-warn/40',
    Hindari: 'bg-down/15 text-down border-down/40',
  }
  const icon = signal === 'Beli' ? '▲' : signal === 'Hindari' ? '▼' : '■'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${map[signal] ?? 'border-line text-muted'}`}>
      <span aria-hidden>{icon}</span>
      {signal}
    </span>
  )
}

export function RegimeBadge({ state, note }: { state: string; note?: string }) {
  const map: Record<string, string> = {
    'Risk-on': 'bg-up/15 text-up border-up/40',
    Netral: 'bg-accent/15 text-accent border-accent/40',
    'Risk-off': 'bg-down/15 text-down border-down/40',
  }
  return (
    <span
      title={note}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${map[state] ?? 'border-line text-muted'}`}
    >
      <span aria-hidden>{state === 'Risk-on' ? '▲' : state === 'Risk-off' ? '▼' : '■'}</span>
      Rezim {state}
    </span>
  )
}

export function PipelineStatus({ status, asOf, runAt }: { status: string; asOf?: string | null; runAt?: string }) {
  const map: Record<string, { c: string; label: string; icon: string }> = {
    ok: { c: 'text-up', label: 'Pipeline normal', icon: '●' },
    warn: { c: 'text-warn', label: 'Pipeline dengan peringatan', icon: '▲' },
    gagal: { c: 'text-down', label: 'Pipeline GAGAL', icon: '▼' },
  }
  const s = map[status] ?? map.warn
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.c}`} title={runAt ? `Dijalankan ${runAt}` : undefined}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
      {asOf ? <span className="text-muted">· data {asOf}</span> : null}
    </span>
  )
}

export function ScoreGauge({ score, size = 116 }: { score: number | null; size?: number }) {
  const v = score ?? 0
  const r = size / 2 - 9
  const c = 2 * Math.PI * r
  const color = v >= 70 ? 'var(--c-up)' : v >= 40 ? 'var(--c-accent)' : 'var(--c-down)'
  return (
    <svg width={size} height={size} role="img" aria-label={`Skor ${score === null ? 'tidak tersedia' : score.toFixed(1)} dari 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--c-line)" strokeWidth={8} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${(Math.max(0, Math.min(100, v)) / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="46%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--c-fg)"
        fontSize={size / 4}
        className="num"
      >
        {score === null ? '—' : score.toFixed(0)}
      </text>
      <text x="50%" y="68%" textAnchor="middle" fill="var(--c-muted)" fontSize={size / 9}>
        dari 100
      </text>
    </svg>
  )
}

export function Bar({ value, max = 100, color = 'var(--c-accent)' }: { value: number | null; max?: number; color?: string }) {
  const w = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="presentation">
      <div className="h-full rounded-full" style={{ width: `${w}%`, background: color }} />
    </div>
  )
}

export function ContributionBars({
  items,
  limit = 8,
}: {
  items: { desc: string; value: number | null; contribution: number; score: number | null; category: string }[]
  limit?: number
}) {
  const sorted = [...items].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, limit)
  const max = Math.max(1, ...sorted.map((i) => Math.abs(i.contribution)))
  return (
    <ul className="space-y-2">
      {sorted.map((i) => (
        <li key={`${i.category}-${i.desc}`}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate">{i.desc}</span>
            <span className={`num font-semibold ${i.contribution >= 0 ? 'text-up' : 'text-down'}`}>
              {i.contribution >= 0 ? '+' : '−'}
              {num(Math.abs(i.contribution), 1)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <div className="h-full" style={{ width: `${(Math.abs(i.contribution) / max) * 50}%`, background: i.contribution >= 0 ? 'var(--c-up)' : 'var(--c-down)' }} />
            </div>
            <span className="num w-24 text-right text-[11px] text-muted">nilai {num(i.value, 2)}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Info({ term, text }: { term: string; text?: string }) {
  const body = text ?? GLOSSARY[term.toLowerCase()] ?? ''
  return (
    <abbr title={`Apa itu ${term}? ${body}`} className="cursor-help no-underline">
      {term}
    </abbr>
  )
}

export function Skeleton({ rows = 4, height = 14 }: { rows?: number; height?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded bg-line" style={{ height, width: `${90 - i * 7}%` }} />
      ))}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-down/40 bg-down/10 px-4 py-3 text-sm">
      <p className="font-semibold text-down">Data tidak dapat dimuat</p>
      <p className="mt-1 text-muted">
        {error instanceof Error ? error.message : String(error)}. Pastikan pipeline sudah dijalankan
        (<code className="num">python -m pipeline.run</code>) sehingga berkas JSON tersedia di <code className="num">web/public/data</code>.
      </p>
    </div>
  )
}

export function Disclaimer() {
  return (
    <p className="text-[11px] leading-relaxed text-muted">
      Informasi dan simulasi di situs ini hanya untuk edukasi dan pemakaian pribadi, bukan nasihat investasi. Hasil
      simulasi dan backtest tidak menjamin hasil di masa depan. Data berasal dari pihak ketiga, dapat tertunda ±10 menit
      atau tidak akurat. Keputusan dan risiko sepenuhnya milik pengguna.
    </p>
  )
}

export type Column<T> = {
  key: string
  label: string
  align?: 'l' | 'r'
  tip?: string
  render?: (row: T) => ReactNode
  sort?: (row: T) => number | string | null
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  onRowClick,
  initialSort,
  maxHeight = 560,
  empty = 'Tidak ada data.',
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  initialSort?: { key: string; dir: 1 | -1 }
  maxHeight?: number
  empty?: string
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ?? null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    const val = (r: T) => (col.sort ? col.sort(r) : (r[col.key] as number | string | null))
    return [...rows].sort((a, b) => {
      const x = val(a)
      const y = val(b)
      if (x === null || x === undefined) return 1
      if (y === null || y === undefined) return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir
      return String(x).localeCompare(String(y), 'id') * sort.dir
    })
  }, [rows, sort, columns])

  if (!rows.length) return <Empty>{empty}</Empty>

  return (
    <div className="overflow-auto" style={{ maxHeight }}>
      <table className="tbl">
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key
              return (
                <th
                  key={c.key}
                  className={c.align === 'l' ? 'l' : ''}
                  aria-sort={active ? (sort!.dir === 1 ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-fg"
                    onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: -1 }))}
                  >
                    {c.tip ? <Info term={c.label} text={c.tip} /> : c.label}
                    <span aria-hidden className={active ? 'text-accent' : 'opacity-30'}>
                      {active ? (sort!.dir === 1 ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr
              key={rowKey(r, i)}
              className={onRowClick ? 'clickable' : ''}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onRowClick(r)
                      }
                    }
                  : undefined
              }
            >
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'l' ? 'l' : ''}>
                  {c.render ? c.render(r) : ((r[c.key] as ReactNode) ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Delta({ v, digits = 2 }: { v: number | null | undefined; digits?: number }) {
  const t = tone(v)
  return (
    <span className={`num ${toneClass[t]}`}>
      <span aria-hidden>{arrow(v)}</span> {pct(v, digits)}
    </span>
  )
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (k: string) => void
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-xs font-medium transition ${
            active === t.key ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'
          }`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
