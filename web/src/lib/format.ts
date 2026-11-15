/* Pemformat angka/tanggal Indonesia (id-ID, Rp, WIB). PRD Bagian 12. */

const N = (v: number, d: number) =>
  v.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })

export function rp(v?: number | null, d = 0): string {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : `Rp${N(v, d)}`
}

export function num(v?: number | null, d = 2): string {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : N(v, d)
}

/** Persen bertanda, selalu memakai tanda + / − (jangan hanya warna). */
export function pct(v?: number | null, d = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${N(Math.abs(v), d)}%`
}

export function pctRaw(v?: number | null, d = 2): string {
  return v === null || v === undefined || Number.isNaN(v) ? '—' : `${N(v, d)}%`
}

export function compactRp(v?: number | null): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  const a = Math.abs(v)
  if (a >= 1e12) return `Rp${N(v / 1e12, 2)} T`
  if (a >= 1e9) return `Rp${N(v / 1e9, 2)} M`
  if (a >= 1e6) return `Rp${N(v / 1e6, 2)} jt`
  return rp(v)
}

export function lots(shares?: number | null): string {
  return shares === null || shares === undefined ? '—' : `${N(Math.floor(shares / 100), 0)} lot`
}

export function dateID(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00+07:00`)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function dateTimeID(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : `${d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })} WIB`
}

export type Tone = 'up' | 'down' | 'flat'

export function tone(v?: number | null): Tone {
  if (v === null || v === undefined || Number.isNaN(v) || v === 0) return 'flat'
  return v > 0 ? 'up' : 'down'
}

export const toneClass: Record<Tone, string> = {
  up: 'text-up',
  down: 'text-down',
  flat: 'text-muted',
}

/** Tanda arah tekstual (aksesibilitas: jangan bergantung pada warna saja). */
export function arrow(v?: number | null): string {
  const t = tone(v)
  return t === 'up' ? '▲' : t === 'down' ? '▼' : '■'
}
