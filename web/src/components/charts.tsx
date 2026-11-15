import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type Time,
} from 'lightweight-charts'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { EquityPoint, Indicator, PriceSeries, Trade } from '../lib/api'
import { num, pct, rp } from '../lib/format'
import { Empty } from './ui'

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function useThemeKey(): string {
  const [k, setK] = useState(document.documentElement.getAttribute('data-theme') ?? 'dark')
  useEffect(() => {
    const obs = new MutationObserver(() => setK(document.documentElement.getAttribute('data-theme') ?? 'dark'))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return k
}

const RANGES: { key: string; label: string; bars: number }[] = [
  { key: '1B', label: '1B', bars: 22 },
  { key: '3B', label: '3B', bars: 66 },
  { key: '6B', label: '6B', bars: 132 },
  { key: '1T', label: '1T', bars: 252 },
  { key: '5T', label: '5T', bars: 1300 },
]

type Pane = 'rsi' | 'macd' | 'stoch' | 'obv'

/** Candle + volume + overlay EMA/Bollinger + level entry/stop/target, dengan panel indikator tersinkron. */
export function CandleChart({
  prices,
  indicator,
  trades = [],
  height = 380,
}: {
  prices: PriceSeries
  indicator?: Indicator
  trades?: Trade[]
  height?: number
}) {
  const themeKey = useThemeKey()
  const [range, setRange] = useState('6B')
  const [pane, setPane] = useState<Pane>('rsi')
  const [showBB, setShowBB] = useState(true)
  const mainRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)

  const slice = useMemo(() => {
    const bars = RANGES.find((r) => r.key === range)?.bars ?? 132
    const n = Math.min(bars, prices.dates.length)
    const from = prices.dates.length - n
    return { from, dates: prices.dates.slice(from) }
  }, [prices, range])

  useEffect(() => {
    const mainEl = mainRef.current
    const subEl = subRef.current
    if (!mainEl || !subEl) return

    const up = css('--c-up')
    const down = css('--c-down')
    const line = css('--c-line')
    const muted = css('--c-muted')
    const accent = css('--c-accent')

    const common = {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: muted,
        fontFamily: 'Inter, sans-serif',
        attributionLogo: false,
      },
      grid: { vertLines: { color: line, visible: false }, horzLines: { color: line } },
      rightPriceScale: { borderColor: line, scaleMargins: { top: 0.08, bottom: 0.26 } },
      timeScale: { borderColor: line, rightOffset: 3 },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    } as const

    const main: IChartApi = createChart(mainEl, { ...common, height })
    const sub: IChartApi = createChart(subEl, { ...common, height: 130 })

    const candles = main.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
    })
    const vol = main.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' } })
    main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    const i0 = slice.from
    const times = prices.dates.slice(i0)

    candles.setData(
      times.map((t, k) => ({
        time: t as Time,
        open: prices.open[i0 + k],
        high: prices.high[i0 + k],
        low: prices.low[i0 + k],
        close: prices.close[i0 + k],
      })),
    )
    vol.setData(
      times.map((t, k) => ({
        time: t as Time,
        value: prices.volume[i0 + k],
        color: prices.close[i0 + k] >= prices.open[i0 + k] ? `${up}55` : `${down}55`,
      })),
    )

    const overlay = (color: string, data: number[], label: string, width = 1) => {
      const s = main.addSeries(LineSeries, {
        color,
        lineWidth: width as 1 | 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: label,
      })
      s.setData(
        times
          .map((t, k) => ({ time: t as Time, value: data[i0 + k] }))
          .filter((p) => p.value !== null && p.value !== undefined && Number.isFinite(p.value)),
      )
    }
    overlay(accent, prices.ema20, 'EMA20')
    overlay(css('--c-warn'), prices.ema50, 'EMA50')
    overlay(muted, prices.ema200, 'EMA200', 2)
    if (showBB) {
      overlay(`${accent}99`, prices.bb_upper, 'BB atas')
      overlay(`${accent}99`, prices.bb_lower, 'BB bawah')
    }

    const lv = indicator?.levels
    const priceLine = (price: number | null | undefined, color: string, title: string) => {
      if (!price || !Number.isFinite(price)) return
      candles.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title,
      })
    }
    priceLine(lv?.entry, accent, 'Entry')
    priceLine(lv?.stop, down, 'Stop')
    priceLine(lv?.target, up, 'Target')

    const markers: {
      time: Time
      position: 'aboveBar' | 'belowBar'
      color: string
      shape: 'arrowUp' | 'arrowDown' | 'circle'
      text: string
    }[] = []
    const inRange = (d: string) => d >= times[0] && d <= times[times.length - 1]
    for (const h of indicator?.signal_history ?? []) {
      if (inRange(h.date)) {
        markers.push({ time: h.date as Time, position: 'belowBar', color: accent, shape: 'arrowUp', text: `Beli ${h.score ?? ''}` })
      }
    }
    for (const t of trades) {
      if (inRange(t.entry_date)) {
        markers.push({ time: t.entry_date as Time, position: 'belowBar', color: up, shape: 'arrowUp', text: `Masuk ${t.lots} lot` })
      }
      if (inRange(t.exit_date)) {
        markers.push({ time: t.exit_date as Time, position: 'aboveBar', color: down, shape: 'arrowDown', text: `Keluar ${pct(t.return_pct)}` })
      }
    }
    markers.sort((a, b) => String(a.time).localeCompare(String(b.time)))
    createSeriesMarkers(candles, markers)

    // panel indikator
    if (pane === 'macd') {
      const h = sub.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false })
      h.setData(
        times
          .map((t, k) => ({ time: t as Time, value: prices.macd_hist[i0 + k], color: (prices.macd_hist[i0 + k] ?? 0) >= 0 ? up : down }))
          .filter((p) => Number.isFinite(p.value as number)),
      )
      h.createPriceLine({ price: 0, color: line, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' })
    } else {
      const cfg =
        pane === 'rsi'
          ? { data: prices.rsi, color: accent, bands: [30, 70] }
          : pane === 'stoch'
            ? { data: prices.stoch_k, color: css('--c-warn'), bands: [20, 80] }
            : { data: prices.obv, color: up, bands: [] as number[] }
      const s = sub.addSeries(LineSeries, { color: cfg.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: true })
      s.setData(
        times
          .map((t, k) => ({ time: t as Time, value: cfg.data[i0 + k] }))
          .filter((p) => p.value !== null && Number.isFinite(p.value as number)),
      )
      for (const b of cfg.bands) {
        s.createPriceLine({ price: b, color: line, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `${b}` })
      }
    }

    let syncing = false
    const link = (a: IChartApi, b: IChartApi) => {
      a.timeScale().subscribeVisibleLogicalRangeChange((r) => {
        if (!r || syncing) return
        syncing = true
        b.timeScale().setVisibleLogicalRange(r)
        syncing = false
      })
    }
    link(main, sub)
    link(sub, main)

    main.timeScale().fitContent()

    return () => {
      main.remove()
      sub.remove()
    }
  }, [prices, indicator, trades, range, pane, showBB, height, themeKey, slice.from])

  const paneLabel: Record<Pane, string> = { rsi: 'RSI(14)', macd: 'MACD histogram', stoch: 'Stochastic %K', obv: 'OBV' }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Rentang waktu chart">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`px-2.5 py-1 text-xs font-medium ${range === r.key ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Panel indikator">
          {(['rsi', 'macd', 'stoch', 'obv'] as Pane[]).map((p) => (
            <button
              key={p}
              onClick={() => setPane(p)}
              aria-pressed={pane === p}
              className={`px-2.5 py-1 text-xs font-medium uppercase ${pane === p ? 'bg-accent text-white' : 'text-muted hover:text-fg'}`}
            >
              {p}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={showBB} onChange={(e) => setShowBB(e.target.checked)} />
          Bollinger
        </label>
      </div>
      <div ref={mainRef} className="w-full" role="img" aria-label={`Candlestick ${prices.dates.length} hari bursa dengan overlay EMA dan level entry/stop/target`} />
      <div>
        <p className="mb-1 text-[11px] text-muted">Panel {paneLabel[pane]} (tersinkron dengan chart utama)</p>
        <div ref={subRef} className="w-full" role="img" aria-label={`Panel indikator ${paneLabel[pane]}`} />
      </div>
      <p className="text-[11px] text-muted">
        Harga pada chart = harga mentah (harga eksekusi). Indikator dihitung dari harga disesuaikan lalu dikembalikan ke
        skala mentah. Garis putus-putus: entry (aksen), stop (merah), target (hijau).
      </p>
    </div>
  )
}

export function EquityChart({ points, label }: { points: EquityPoint[]; label: string }) {
  if (!points.length) return <Empty>Belum ada riwayat ekuitas.</Empty>
  const data = points.map((p) => ({ date: p.date, [label]: p.equity_norm, IHSG: p.ihsg_norm }))
  const up = css('--c-up')
  return (
    <div className="h-64 w-full" role="img" aria-label={`Kurva ekuitas ${label} dinormalisasi dibanding IHSG`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke={css('--c-line')} strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: css('--c-muted') }} minTickGap={40} />
          <YAxis tick={{ fontSize: 10, fill: css('--c-muted') }} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{ background: css('--c-surface'), border: `1px solid ${css('--c-line')}`, borderRadius: 10, fontSize: 12 }}
            formatter={(v: number) => num(v, 1)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={100} stroke={css('--c-muted')} strokeDasharray="4 4" />
          <Line type="monotone" dataKey={label} stroke={up} strokeWidth={2} dot={false} name={label} />
          <Line type="monotone" dataKey="IHSG" stroke={css('--c-muted')} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ReturnHistogram({ trades }: { trades: Trade[] }) {
  if (!trades.length) return <Empty>Belum ada transaksi tertutup.</Empty>
  const buckets = [-20, -15, -10, -5, -2, 0, 2, 5, 10, 15, 20]
  const data = buckets.slice(0, -1).map((lo, i) => {
    const hi = buckets[i + 1]
    const n = trades.filter((t) => t.return_pct >= lo && t.return_pct < hi).length
    return { range: `${lo}%…${hi}%`, n, lo }
  })
  return (
    <div className="h-56 w-full" role="img" aria-label="Distribusi return per transaksi">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke={css('--c-line')} strokeDasharray="3 3" />
          <XAxis dataKey="range" tick={{ fontSize: 9, fill: css('--c-muted') }} angle={-30} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: css('--c-muted') }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: css('--c-surface'), border: `1px solid ${css('--c-line')}`, borderRadius: 10, fontSize: 12 }}
            formatter={(v: number) => [`${v} transaksi`, 'Jumlah']}
          />
          <Bar dataKey="n">
            {data.map((d) => (
              <Cell key={d.range} fill={d.lo < 0 ? css('--c-down') : css('--c-up')} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CalibrationChart({ calibration }: { calibration: Record<string, { n: number; avg_return_pct: number }> }) {
  const keys = ['<50', '50-59', '60-69', '70+'].filter((k) => calibration[k])
  if (!keys.length) return <Empty>Kalibrasi skor belum tersedia (butuh transaksi tertutup).</Empty>
  const data = keys.map((k) => ({ kelompok: k, 'Rata-rata return': calibration[k].avg_return_pct, n: calibration[k].n }))
  return (
    <div className="h-56 w-full" role="img" aria-label="Kalibrasi skor: rata-rata return per kelompok skor saat masuk">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
          <CartesianGrid stroke={css('--c-line')} strokeDasharray="3 3" />
          <XAxis dataKey="kelompok" tick={{ fontSize: 11, fill: css('--c-muted') }} />
          <YAxis tick={{ fontSize: 10, fill: css('--c-muted') }} />
          <Tooltip
            contentStyle={{ background: css('--c-surface'), border: `1px solid ${css('--c-line')}`, borderRadius: 10, fontSize: 12 }}
            formatter={(v: number) => pct(v)}
          />
          <ReferenceLine y={0} stroke={css('--c-muted')} />
          <Bar dataKey="Rata-rata return" radius={[4, 4, 0, 0]}>
            {data.map((d) => (
              <Cell key={d.kelompok} fill={d['Rata-rata return'] >= 0 ? css('--c-up') : css('--c-down')} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AllocationBars({ positions }: { positions: { code: string; lots: number; entry_price: number }[] }) {
  if (!positions.length) return <Empty>Tidak ada posisi terbuka.</Empty>
  const values = positions.map((p) => ({ code: p.code, value: p.lots * 100 * p.entry_price }))
  const total = values.reduce((a, b) => a + b.value, 0)
  return (
    <ul className="space-y-2">
      {values.map((v) => (
        <li key={v.code}>
          <div className="flex justify-between text-xs">
            <span className="font-semibold">{v.code}</span>
            <span className="num text-muted">
              {rp(v.value)} · {num((v.value / total) * 100, 1)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent" style={{ width: `${(v.value / total) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function MiniBars({ values, labels, color = 'var(--c-accent)' }: { values: number[]; labels: string[]; color?: string }) {
  const max = Math.max(1, ...values.map((v) => Math.abs(v)))
  return (
    <ul className="flex items-end gap-1" aria-hidden>
      {values.map((v, i) => (
        <li key={labels[i]} title={`${labels[i]}: ${num(v, 1)}`} className="flex-1">
          <div className="rounded-t" style={{ height: `${(Math.abs(v) / max) * 48 + 2}px`, background: color }} />
        </li>
      ))}
    </ul>
  )
}
