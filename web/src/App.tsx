import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Screener from './pages/Screener'
import StockDetail from './pages/StockDetail'
import Simulation from './pages/Simulation'
import Scorecard from './pages/Scorecard'
import Backtest from './pages/Backtest'
import Guide from './pages/Guide'
import Settings from './pages/Settings'
import { useMeta } from './lib/api'

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/screener', label: 'Screener' },
  { to: '/simulasi', label: 'Simulasi' },
  { to: '/scorecard', label: 'Scorecard' },
  { to: '/backtest', label: 'Backtest' },
  { to: '/panduan', label: 'Panduan' },
  { to: '/pengaturan', label: 'Pengaturan' },
]

export default function App() {
  const meta = useMeta()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as 'dark' | 'light') ?? 'dark')
  }, [])

  const flip = () => {
    const t = theme === 'dark' ? 'light' : 'dark'
    setTheme(t)
    localStorage.setItem('idx.theme', t)
    document.documentElement.dataset.theme = t
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <NavLink to="/" className="flex items-center gap-2">
            <span aria-hidden className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[13px] font-bold text-white">
              i
            </span>
            <span className="text-sm font-semibold tracking-tight">
              IDX Insight<span className="ml-1.5 text-[11px] font-normal text-muted">LQ45 · Bahasa Indonesia</span>
            </span>
          </NavLink>

          <nav className="order-3 flex w-full flex-wrap gap-1 text-xs md:order-none md:w-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-2.5 py-1.5 font-medium transition ${
                    isActive ? 'bg-accent/12 text-accent' : 'text-muted hover:bg-surface2 hover:text-fg'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-[11px] text-muted">
            {meta.data?.as_of && (
              <span className="hidden sm:inline">
                Data {meta.data.as_of}
                {meta.data.status !== 'ok' && <span className="ml-1 text-warn">({meta.data.status})</span>}
              </span>
            )}
            <button
              onClick={flip}
              aria-label={`Ubah ke tema ${theme === 'dark' ? 'terang' : 'gelap'}`}
              title="Ubah tema"
              className="rounded-lg border border-line px-2 py-1 hover:text-fg"
            >
              {theme === 'dark' ? '☾ Gelap' : '☀ Terang'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/screener" element={<Screener />} />
          <Route path="/saham/:code" element={<StockDetail />} />
          <Route path="/simulasi" element={<Simulation />} />
          <Route path="/scorecard" element={<Scorecard />} />
          <Route path="/backtest" element={<Backtest />} />
          <Route path="/panduan" element={<Guide />} />
          <Route path="/pengaturan" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="mx-auto max-w-[1500px] px-4 pb-8 pt-2 text-[11px] text-muted">
        <p>
          IDX Insight — alat bantu analisis dan simulasi. Bukan nasihat keuangan. Data dari Yahoo Finance, dapat
          terlambat atau tidak lengkap. Kinerja masa lalu tidak menjamin hasil di masa depan.
        </p>
      </footer>
    </div>
  )
}