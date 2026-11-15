"""Diagnosa satu rute: cetak teks yang terlihat (untuk mencari bagian yang tidak render)."""
import sys

from playwright.sync_api import sync_playwright

route = sys.argv[1] if len(sys.argv) > 1 else "/"
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1440, "height": 1000})
    errs: list[str] = []
    page.on("pageerror", lambda e: errs.append(str(e)))
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.goto("http://[::1]:4173" + route, wait_until="networkidle")
    page.wait_for_timeout(800)
    print("URL:", page.url)
    print("ERROR:", errs)
    print("--- TEKS ---")
    print(page.inner_text("body"))
    b.close()
