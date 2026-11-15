import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUniverse, type UniverseRow } from '../lib/api'
import { compactRp, num, pct, rp, tone, toneClass } from '../lib/format'
import { Card, DataTable, Empty, ErrorBox, Skeleton, SignalBadge, type Column } from '../components/ui'

type Filters = {
  q: string
  signal: string
  sector: string
  minScore: number
  liquidOnly: boolean
  maxLotPrice: number
}

const EMPTY: Filters = { q: '', signal: '', sector: '', minScore: 0, liquidOnly: true, maxLotPrice: 0 }
const PRESET_KEY = 'idx.presets'

type Preset = { name: string; filters: Filters }

export default function Screener() {
  const uni = useUniverse()
  const nav = useNavigate()
  const [f, setF] = useState<Filters>(EMPTY)
  const [presets, setPresets] = useState<Preset[]>([])

  useEffect(() => {
    try {
      setPresets(JSON.parse(localStorage.getItem(PRESET_KEY) ?? '[]') as Preset[])
    } catch {
      setPresets([])
    }
  }, [])

  const sectors = useMemo(
    () => [...new Set((uni.data?.rows ?? []).map((r) => r.sector).filter(Boolean))].sort() as string[],
    [uni.data],
  )

  const rows = useMemo(() => {
    const all = uni.data?.rows ?? []
    return all.filter((r) => {
      if (f.q && !`${r.code} ${r.name}`.toLowerCase().includes(f.q.toLowerCase())) return false
      if (f.signal && r.signal !== f.signal) return false
      if (f.sector && r.sector !== f.sector) return false
      if (f.minScore && (r.score ?? 0) < f.minScore) return false
      if (f.liquidOnly && !r.liquid) return false
      if (f.maxLotPrice && (r.price ?? 0) * 100 > f.maxLotPrice) return false
      return true
    })
  }, [uni.data, f])

  const savePreset = () => {
    const name = prompt('Nama preset filter:')
    if (!name) return
    const next = [...presets.filter((p) => p.name !== name), { name, filters: f }]
    setPresets(next)
    localStorage.setItem(PRESET_KEY, JSON.stringify(next))
  }

  const dropPreset = (name: string) => {
    const next = presets.filter((p) => p.name !== name)
    setPresets(next)
    localStorage.setItem(PRESET_KEY, JSON.stringify(next))
  }

  const cols: Column<UniverseRow>[] = [
    { key: 'code', label: 'Kode', align: 'l', render: (r) => <span className="font-semibold">{r.code}</span> },
    { key: 'sector', label: 'Sektor', align: 'l', render: (r) => <span className="text-muted">{r.sector ?? '—'}</span> },
    { key: 'price', label: 'Harga', render: (r) => <span className="num">{rp(r.price)}</span> },
    { key: 'change_pct', label: '1 hari', render: (r) => <span className={`num ${toneClass[tone(r.change_pct)]}`}>{pct(r.change_pct)}</span>, sort: (r) => r.change_pct },
    { key: 'score', label: 'Skor', tip: 'Skor komposit 0–100 dari lima kategori', render: (r) => <span className="num font-semibold">{num(r.score, 1)}</span> },
    { key: 'score_delta', label: 'Δ skor', tip: 'Perubahan skor dibanding hari sebelumnya', render: (r) => <span className={`num ${toneClass[tone(r.score_delta)]}`}>{pct(r.score_delta, 1)}</span> },
    { key: 'trend', label: 'Tren', render: (r) => <span className="text-xs text-muted">{r.trend}</span> },
    { key: 'scores.trend', label: 'Tren', sort: (r) => r.scores.trend, render: (r) => <span className="num text-muted">{num(r.scores.trend, 0)}</span> },
    { key: 'scores.momentum', label: 'Momentum', render: (r) => <span className="num text-muted">{num(r.scores.momentum, 0)}</span> },
    { key: 'scores.volume', label: 'Volume', render: (r) => <span className="num text-muted">{num(r.scores.volume, 0)}</span> },
    { key: 'scores.risk', label: 'Risiko', render: (r) => <span className="num text-muted">{num(r.scores.risk, 0)}</span> },
    { key: 'scores.fundamental', label: 'Fund.', render: (r) => <span className="num text-muted">{num(r.scores.fundamental, 0)}</span> },
    { key: 'rsi', label: 'RSI', render: (r) => <span className="num">{num(r.rsi, 1)}</span> },
    { key: 'volume_ratio', label: 'Vol ×', render: (r) => <span className="num">{num(r.volume_ratio, 2)}</span> },
    { key: 'per', label: 'PER', render: (r) => <span className="num">{num(r.per, 1)}</span> },
    { key: 'pbv', label: 'PBV', render: (r) => <span className="num">{num(r.pbv, 2)}</span> },
    { key: 'roe', label: 'ROE', render: (r) => <span className="num">{num(r.roe, 1)}</span> },
    { key: 'signal', label: 'Sinyal', render: (r) => <SignalBadge signal={r.signal} /> },
    { key: 'rr', label: 'R:R', render: (r) => <span className="num">{r.rr ? `1:${num(r.rr, 1)}` : '—'}</span> },
    { key: 'value_avg20', label: 'Nilai/hari', render: (r) => <span className="num text-muted">{compactRp(r.value_avg20)}</span> },
  ]

  if (uni.isError) return <ErrorBox error={uni.error} />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Screener & rekomendasi</h1>
        <p className="text-xs text-muted">
          {rows.length} dari {uni.data?.count ?? 0} saham · klik baris untuk membuka detail · klik judul kolom untuk mengurutkan
        </p>
      </div>

      <Card>
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <label className="text-xs">
            <span className="text-muted">Cari kode / nama</span>
            <input
              value={f.q}
              onChange={(e) => setF({ ...f, q: e.target.value })}
              placeholder="mis. BBRI"
              className="mt-1 w-full rounded-lg border border-line bg-surface2 px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
          <label className="text-xs">
            <span className="text-muted">Sinyal</span>
            <select
              value={f.signal}
              onChange={(e) => setF({ ...f, signal: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-surface2 px-2 py-1.5 text-sm"
            >
              <option value="">Semua</option>
              <option value="Beli">Beli</option>
              <option value="Tahan">Tahan</option>
              <option value="Hindari">Hindari</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="text-muted">Sektor</span>
            <select
              value={f.sector}
              onChange={(e) => setF({ ...f, sector: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-surface2 px-2 py-1.5 text-sm"
            >
              <option value="">Semua</option>
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="text-muted">Skor minimum: {f.minScore}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={f.minScore}
              onChange={(e) => setF({ ...f, minScore: Number(e.target.value) })}
              className="mt-2 w-full accent-[var(--c-accent)]"
            />
          </label>
          <label className="text-xs">
            <span className="text-muted">Harga per lot maks (Rp)</span>
            <input
              type="number"
              min={0}
              step={100000}
              value={f.maxLotPrice || ''}
              onChange={(e) => setF({ ...f, maxLotPrice: Number(e.target.value) })}
              placeholder="tanpa batas"
              className="mt-1 w-full rounded-lg border border-line bg-surface2 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex items-end gap-2 text-xs">
            <input type="checkbox" checked={f.liquidOnly} onChange={(e) => setF({ ...f, liquidOnly: e.target.checked })} />
            <span className="text-muted">Hanya likuid (≥ Rp5 M/hari)</span>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <button onClick={() => setF(EMPTY)} className="rounded-lg border border-line px-2.5 py-1 text-muted hover:text-fg">
            Reset
          </button>
          <button onClick={savePreset} className="rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1 text-accent">
            Simpan preset
          </button>
          {presets.map((p) => (
            <span key={p.name} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
              <button onClick={() => setF(p.filters)} className="hover:text-accent">
                {p.name}
              </button>
              <button onClick={() => dropPreset(p.name)} aria-label={`Hapus preset ${p.name}`} className="text-muted hover:text-down">
                ×
              </button>
            </span>
          ))}
        </div>
      </Card>

      <Card pad={false}>
        {uni.isLoading ? (
          <div className="p-4">
            <Skeleton rows={6} />
          </div>
        ) : rows.length ? (
          <DataTable columns={cols} rows={rows} rowKey={(r) => r.code} onRowClick={(r) => nav(`/saham/${r.code}`)} maxHeight={640} />
        ) : (
          <div className="p-4">
            <Empty>Tidak ada saham yang cocok dengan filter. Coba longgarkan filter.</Empty>
          </div>
        )}
      </Card>
    </div>
  )
}