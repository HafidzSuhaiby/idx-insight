/* Sumber data: JSON statis hasil pipeline di /data (PRD Bagian 11). */
import { useQuery } from '@tanstack/react-query'

const BASE = import.meta.env.BASE_URL || '/'

export const dataUrl = (p: string) => `${BASE}data/${p}`

async function fetchJson<T>(p: string): Promise<T> {
  const res = await fetch(dataUrl(p), { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`)
  return (await res.json()) as T
}

async function fetchJsonl<T>(p: string): Promise<T[]> {
  const res = await fetch(dataUrl(p), { cache: 'no-cache' })
  if (!res.ok) throw new Error(`${p}: HTTP ${res.status}`)
  return (await res.text())
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T)
}

// ---------------------------------------------------------------- tipe
export type Regime = { state: string; note?: string; close?: number; ema50?: number; ema200?: number }

export type UniverseRow = {
  code: string
  name: string
  sector: string | null
  price: number | null
  change_pct: number | null
  score: number | null
  score_delta: number | null
  scores: Record<string, number | null>
  signal: 'Beli' | 'Tahan' | 'Hindari'
  rsi: number | null
  trend: string
  volume_ratio: number | null
  per: number | null
  pbv: number | null
  roe: number | null
  der: number | null
  atr_pct: number | null
  rr: number | null
  entry: number | null
  stop: number | null
  target: number | null
  value_avg20: number | null
  liquid: boolean
}

export type Universe = {
  date: string
  benchmark: string
  regime: Regime
  params_version: string
  params?: {
    categories: { key: string; label: string; weight: number }[]
    signal: { buy: number; hold: number; exit_score: number }
    levels: { stop_atr_mult: number; target_rr: number; min_rr: number; max_hold_days: number }
    risk_per_trade: number
    fees: { buy: number; sell: number }
    slippage: number
    lot_size: number
  }
  rows: UniverseRow[]
  count: number
}

export type Meta = {
  as_of: string | null
  run_at: string
  duration_s?: number
  status: 'ok' | 'warn' | 'gagal'
  error?: string
  params_version: string
  universe_total?: number
  universe_ok?: number
  regime?: Regime
  benchmark?: { label: string; close: number; change_pct: number; ema50: number; ema200: number }
  issues?: { code: string; level: string; msg: string }[]
  n_errors?: number
  n_warnings?: number
  messages?: string[]
  data_note?: string
  pipeline_order?: string[]
}

export type SignalItem = {
  code: string
  name: string
  sector: string | null
  score: number
  signal: string
  entry: number | null
  stop: number | null
  target: number | null
  rr: number | null
  price: number | null
  change_pct: number | null
}

export type LatestSignals = {
  date: string
  params_version: string
  regime: Regime
  items: SignalItem[]
  n_buy: number
  n_hold: number
  n_avoid: number
}

export type Factor = { value: number | null; score: number | null; weight: number; desc: string }
export type Category = { score: number | null; weight: number; label: string }
export type Level = { entry: number | null; stop: number | null; target: number | null; rr: number | null }
export type Contribution = {
  factor: string
  category: string
  label: string
  desc: string
  value: number | null
  score: number | null
  contribution: number
}

export type Indicator = {
  code: string
  name: string
  sector: string | null
  industry: string | null
  date: string
  price: number | null
  score: number | null
  signal: string
  signal_reasons: string[]
  categories: Record<string, Category>
  factors: Record<string, Record<string, Factor>>
  levels: Level & { risk_per_share?: number; capped_by_resistance?: boolean; note?: string }
  contributions: Contribution[]
  fundamentals: Record<string, number | string | null>
  medians: Record<string, number | null>
  snapshot: Record<string, number | null>
  signal_history: {
    date: string
    score: number | null
    entry: number | null
    stop: number | null
    target: number | null
    ret5?: number
    ret10?: number
    ret20?: number
  }[]
  params_version: string
  risk: Record<string, number | null>
  explanation: string
}

export type PriceSeries = {
  dates: string[]
  price_basis: string
  indicator_basis: string
  open: number[]
  high: number[]
  low: number[]
  close: number[]
  volume: number[]
  ema20: number[]
  ema50: number[]
  ema200: number[]
  bb_upper: number[]
  bb_lower: number[]
  rsi: number[]
  macd_hist: number[]
  stoch_k: number[]
  stoch_d: number[]
  obv: number[]
}

export type Position = {
  code: string
  lots: number
  entry_price: number
  cost_total: number
  stop: number | null
  target: number | null
  risk_per_share: number
  opened: string
  bars_held: number
  score_at_entry: number | null
  planned_lots?: number
}

export type Order = {
  code: string
  side: string
  status: string
  date: string
  for_date?: string
  lots: number
  price?: number
  cost?: number
  fee?: number
  stop?: number | null
  target?: number | null
  score?: number | null
}

export type Trade = {
  code: string
  entry_date: string
  exit_date: string
  lots: number
  entry_price: number
  exit_price: number
  cost_total: number
  proceeds: number
  pnl: number
  return_pct: number
  r_multiple: number | null
  bars_held: number
  reason: string
  score_at_entry: number | null
  phase: string
  regime_at_entry?: string | null
}

export type EquityPoint = {
  date: string
  equity: number
  cash: number
  n_positions: number
  ihsg: number
  phase: string
  ihsg_norm: number | null
  equity_norm: number | null
}

export type AccountState = {
  account: string
  label: string
  initial_cash: number
  max_positions: number
  position_size_pct: number
  cash: number
  equity: number
  return_pct: number
  positions: Position[]
  pending_orders: Order[]
  n_trades: number
  params_version: string
  replay_from: string | null
  last_update: string
}

export type Metrics = {
  days: number
  n_trades: number
  final_equity: number
  total_return_pct: number | null
  annualized_return_pct: number | null
  benchmark_return_pct: number | null
  excess_return_pct: number | null
  max_drawdown_pct: number
  sharpe: number | null
  sortino: number | null
  profit_factor: number | null
  hit_rate_pct: number | null
  avg_win_pct: number | null
  avg_loss_pct: number | null
  expectancy_r: number | null
  avg_holding_days: number | null
  turnover_x: number | null
  robust_without_best: number | null
  exit_reasons: Record<string, number>
  calibration: Record<string, { n: number; avg_return_pct: number }>
}

export type ScorecardAccount = {
  label: string
  initial_cash: number
  basis: string
  replay_note?: string
  all: Metrics
  live: Metrics
  verdict: { status: string; note: string; checks: Record<string, boolean> }
}

export type Portfolio = {
  date: string
  params_version: string
  accounts: Record<
    string,
    { state: AccountState; equity: EquityPoint[]; trades: Trade[]; orders: Order[] }
  >
  scorecard: Record<string, ScorecardAccount>
}

export type SignalHistoryEntry = {
  date: string
  params_version: string
  regime: string
  items: SignalItem[]
}

// ---------------------------------------------------------------- hook
const opts = { staleTime: 60_000, retry: 1 }

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => fetchJson<Meta>('meta.json'), ...opts })
export const useUniverse = () =>
  useQuery({ queryKey: ['universe'], queryFn: () => fetchJson<Universe>('universe.json'), ...opts })
export const useSignals = () =>
  useQuery({ queryKey: ['signals'], queryFn: () => fetchJson<LatestSignals>('signals/latest.json'), ...opts })
export const usePortfolio = () =>
  useQuery({ queryKey: ['portfolio'], queryFn: () => fetchJson<Portfolio>('sim/portfolio.json'), ...opts })
export const useScorecard = () =>
  useQuery({ queryKey: ['scorecard'], queryFn: () => fetchJson<{ accounts: Record<string, ScorecardAccount> }>('eval/scorecard.json'), ...opts })
export const useIndicator = (code: string) =>
  useQuery({ queryKey: ['indicator', code], queryFn: () => fetchJson<Indicator>(`indicators/${code}.json`), ...opts })
export const usePrices = (code: string) =>
  useQuery({ queryKey: ['prices', code], queryFn: () => fetchJson<PriceSeries>(`prices/${code}.json`), ...opts })
export const useSignalHistory = () =>
  useQuery({
    queryKey: ['signal-history'],
    queryFn: () => fetchJsonl<SignalHistoryEntry>('signals/history.jsonl'),
    ...opts,
  })
