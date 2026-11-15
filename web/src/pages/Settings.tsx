import { useEffect, useState } from 'react'
import { useUniverse } from '../lib/api'
import { num } from '../lib/format'
import { Card, Disclaimer, Empty, Info } from '../components/ui'

const WATCH_KEY = 'idx.watchlist'

export default function Settings() {
  const uni = useUniverse()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [watch, setWatch] = useState<string[]>([])
  const [q, setQ] = useState('')

  useEffect(() => {
    setTheme((localStorage.getItem('idx.theme') as 'dark' | 'light') ?? 'dark')
    try {
      setWatch(JSON.parse(localStorage.getItem(WATCH_KEY) ?? '[]') as string[])
    } catch {
      setWatch([])
    }
  }, [])

  const applyTheme = (t: 'dark' | 'light') => {
    setTheme(t)
    localStorage.setItem('idx.theme', t)
    document.documentElement.dataset.theme = t
  }

  const toggleWatch = (code: string) => {
    const next = watch.includes(code) ? watch.filter((c) => c !== code) : [...watch, code]
    setWatch(next)
    localStorage.setItem(WATCH_KEY, JSON.stringify(next))
  }

  const params = uni.data?.params
  const matches = (uni.data?.rows ?? [])
    .filter((r) => !watch.includes(r.code))
    .filter((r) => (q ? `${r.code} ${r.name}`.toLowerCase().includes(q.toLowerCase()) : false))
    .slice(0, 6)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Pengaturan</h1>
        <p className="text-xs text-muted">
          Preferensi disimpan di peramban Anda (localStorage) dan tidak dikirim ke mana pun. Parameter mesin bersifat
          hanya-baca dan hanya berubah lewat commit ke repositori.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Tampilan" sub="Tema disimpan sebagai idx.theme">
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((t) => (
              <button
                key={t}
                onClick={() => applyTheme(t)}
                aria-pressed={theme === t}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  theme === t ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-fg'
                }`}
              >
                {t === 'dark' ? 'Gelap' : 'Terang'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">Tema awal dibaca sebelum halaman dirender agar tidak berkedip.</p>
        </Card>

        <Card title="Daftar pantau" sub={`${watch.length} saham · disimpan sebagai idx.watchlist`}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kode atau nama saham…"
            className="w-full rounded-lg border border-line bg-surface2 px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
          {!!matches.length && (
            <ul className="mt-2 space-y-1 text-xs">
              {matches.map((r) => (
                <li key={r.code} className="flex items-center justify-between rounded-lg border border-line px-2 py-1">
                  <span>
                    <span className="font-semibold">{r.code}</span> <span className="text-muted">{r.name}</span>
                  </span>
                  <button onClick={() => toggleWatch(r.code)} className="text-accent hover:underline">
                    tambah
                  </button>
                </li>
              ))}
            </ul>
          )}
          {watch.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
              {watch.map((c) => (
                <li key={c} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5">
                  <span className="num font-semibold">{c}</span>
                  <button onClick={() => toggleWatch(c)} aria-label={`Hapus ${c} dari daftar pantau`} className="text-muted hover:text-down">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted">Daftar pantau masih kosong.</p>
          )}
        </Card>
      </div>

      <Card title="Parameter mesin (hanya-baca)" sub={`Versi parameter ${uni.data?.params_version ?? '—'} · ubah lewat config/scoring.yaml + commit`}>
        {!params ? (
          <Empty>Parameter belum tersedia di keluaran pipeline. Jalankan pipeline terbaru.</Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Bobot kategori</h3>
              <ul className="mt-2 space-y-1 text-xs">
                {params.categories.map((c) => (
                  <li key={c.key} className="flex items-center gap-2">
                    <span className="w-28 shrink-0">{c.label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                      <div className="h-full bg-accent" style={{ width: `${c.weight}%` }} />
                    </div>
                    <span className="num w-8 text-right">{num(c.weight, 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Ambang sinyal</h3>
                <ul className="mt-1 space-y-0.5 text-muted">
                  <li>Beli: skor ≥ {num(params.signal.buy, 0)}</li>
                  <li>Tahan: skor ≥ {num(params.signal.hold, 0)}</li>
                  <li>Keluar posisi: skor &lt; {num(params.signal.exit_score, 0)}</li>
                  <li>Rasio risiko:imbalan minimum: 1:{num(params.levels.min_rr, 1)}</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Level & risiko</h3>
                <ul className="mt-1 space-y-0.5 text-muted">
                  <li>Stop: {num(params.levels.stop_atr_mult, 1)}× ATR di bawah entry</li>
                  <li>Target minimum: 1:{num(params.levels.target_rr, 1)}</li>
                  <li>Risiko per transaksi: {num(params.risk_per_trade * 100, 1)}% ekuitas</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Biaya & eksekusi</h3>
                <ul className="mt-1 space-y-0.5 text-muted">
                  <li>Fee beli {num(params.fees.buy * 100, 2)}% · jual {num(params.fees.sell * 100, 2)}%</li>
                  <li>Slippage {num(params.slippage * 100, 2)}% · 1 lot = {num(params.lot_size, 0)} lembar</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted">
          <Info term="Mengapa hanya-baca?" text="Agar setiap angka yang Anda lihat bisa ditelusuri ke satu versi parameter di repositori. Perubahan bobot hanya boleh berasal dari hasil walk-forward, bukan penyesuaian setelah melihat hasil." />
        </p>
      </Card>

      <Card title="Tentang IDX Insight">
        <ul className="space-y-1 text-xs text-muted">
          <li>Aplikasi analisis saham IDX (universe LQ45) dengan keputusan deterministik.</li>
          <li>Pipeline Python menghasilkan berkas JSON statis; antarmuka React membacanya sebagai berkas statis.</li>
          <li>Parameter versi: <span className="num">{uni.data?.params_version ?? '—'}</span> · benchmark {uni.data?.benchmark ?? 'IHSK'}</li>
        </ul>
        <div className="mt-3">
          <Disclaimer />
        </div>
      </Card>
    </div>
  )
}