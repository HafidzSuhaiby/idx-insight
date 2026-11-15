"""Smoke test UI: buka setiap rute aplikasi hasil build di Chromium headless.

Pakai: jalankan `npx vite preview --port 4173` di web/, lalu `python tools/smoke_web.py`.
Menandai gagal bila ada error konsol, error halaman, atau teks yang diharapkan tidak muncul.
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = os.environ.get("SMOKE_BASE", "http://[::1]:4173")
SHOTS = Path(__file__).resolve().parent.parent / "docs" / "screenshots"

CASES = [
    ("/", ["Dashboard", "IHSG", "Rezim pasar", "Top 10 rekomendasi", "Ringkasan portofolio"]),
    ("/screener", ["Screener", "Skor minimum", "BBCA"]),
    ("/saham/BBCA", ["BBCA", "Skor komposit", "Level rencana", "Contoh ukuran posisi", "Faktor pendukung"]),
    ("/simulasi", ["Simulasi portofolio", "Order direncanakan", "Riwayat transaksi", "Aturan simulasi"]),
    ("/scorecard", ["Scorecard akurasi", "Metrik lengkap", "Distribusi return", "Hasil per sektor"]),
    ("/backtest", ["Backtest walk-forward", "Belum tersedia", "Gerbang menuju Fase 2"]),
    ("/panduan", ["Panduan & glosarium", "Alur singkat", "Tren", "Momentum"]),
    ("/pengaturan", ["Pengaturan", "Daftar pantau", "Parameter mesin (hanya-baca)", "Bobot kategori"]),
]

fails: list[str] = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console: {m.text}") if m.type == "error" else None)

    for route, expects in CASES:
        errors.clear()
        page.goto(BASE + route, wait_until="networkidle")
        page.wait_for_timeout(700)
        text = page.inner_text("body")
        missing = [t for t in expects if t.lower() not in text.lower()]
        status = "OK " if not missing and not errors else "GAGAL"
        print(f"{status} {route:16} teks={len(text):6} char  hilang={missing}  error={errors[:2]}")
        if missing or errors:
            fails.append(route)
        if route in ("/", "/screener", "/saham/BBCA", "/simulasi", "/scorecard"):
            SHOTS.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(SHOTS / f"{route.strip('/').replace('/', '_') or 'dashboard'}.png"), full_page=True)

    # tabel screener harus memuat seluruh universe
    page.goto(BASE + "/screener", wait_until="networkidle")
    rows = page.eval_on_selector_all("table.tbl tbody tr", "els => els.length")
    print(f"{'OK ' if rows == 45 else 'GAGAL'} baris tabel screener = {rows} (harap 45)")
    if rows != 45:
        fails.append("baris-screener")

    # urutkan kolom + buka detail lewat klik baris
    page.click("table.tbl thead th:nth-child(5) button")
    page.wait_for_timeout(300)
    first = page.inner_text("table.tbl tbody tr:first-child td:first-child")
    print(f"OK  urut skor menurun, baris teratas = {first}")
    page.click("table.tbl tbody tr:first-child")
    page.wait_for_timeout(900)
    print(f"{'OK ' if '/saham/' in page.url else 'GAGAL'} klik baris → {page.url}")

    # semua tab halaman detail saham (chart paling rawan)
    page.goto(BASE + "/saham/BBCA", wait_until="networkidle")
    tabs = [
        ("Chart", ["5T", "Panel RSI(14)"], True),
        ("Teknikal", ["Indikator", "Interpretasi", "Bobot"], False),
        ("Fundamental", ["Median universe", "PER", "PBV"], False),
        ("Risiko & Likuiditas", ["ATR", "Drawdown", "Beta"], False),
        ("Riwayat Sinyal", ["Tanggal", "5 hari"], False),
        ("Penjelasan", ["template", "Alasan sinyal"], False),
    ]
    for t, expects, need_canvas in tabs:
        errors.clear()
        page.click(f"button[role=tab]:has-text('{t}')")
        page.wait_for_timeout(1200)
        body = page.inner_text("body")
        missing = [e for e in expects if e.lower() not in body.lower()]
        canvases = page.eval_on_selector_all("canvas", "els => els.length")
        ok = not errors and not missing and (canvases > 0 or not need_canvas)
        print(f"{'OK ' if ok else 'GAGAL'} tab {t:22} canvas={canvases} hilang={missing} error={errors[:1]}")
        if not ok:
            fails.append(f"tab-{t}")
        if t == "Chart":
            SHOTS.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(SHOTS / "saham-chart.png"), full_page=True)

    browser.close()

print("\nHASIL:", "SEMUA LULUS" if not fails else f"GAGAL di {fails}")
sys.exit(1 if fails else 0)
