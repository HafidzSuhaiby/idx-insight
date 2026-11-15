import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// BASE_PATH dipakai saat situs tidak berada di akar domain, mis. GitHub Pages:
// BASE_PATH=/idx-insight/ npm run build:pages
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
})