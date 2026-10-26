/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Konfigurasi Vite + Vitest.
// - base './' agar aset dapat dimuat dari file:// / WebView Capacitor.
// - Vitest memakai jsdom dan fake-indexeddb (lihat vitest.setup.ts).
// - PWA (Req 11.4, 11.5, 11.7): service worker Workbox mem-precache seluruh
//   aset hasil build; pendaftaran disuntikkan sebagai <script> registerSW.js
//   di index.html (injectRegister: 'script') sehingga main.tsx dan Vitest/jsdom
//   tidak tersentuh. Ikon di public/icons diturunkan dari assets/icon.png.
// - Mode "android" (dipakai scripts/build-android.mjs): APK sudah membawa
//   seluruh aset sehingga service worker tidak diperlukan. SW justru membuat
//   WebView terus menyajikan versi lama dari cache setelah APK diperbarui.
//   Maka skrip pendaftaran tidak disuntikkan, dan sw.js diganti versi
//   "self-destroying" yang menghapus cache + SW lama di perangkat yang sudah
//   terpasang, lalu memuat ulang halaman dari aset APK baru.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: mode === 'android' ? false : 'script',
      selfDestroying: mode === 'android',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Data Pasien',
        short_name: 'Data Pasien',
        description: 'Aplikasi Manajemen Pasien Terapi',
        lang: 'id',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache seluruh aset build agar Aplikasi terbuka tanpa internet.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,json,webmanifest,ttf,wasm}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,mjs}'],
    exclude: ['node_modules', 'dist', 'e2e'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/infra/repository.ts'],
      exclude: ['src/**/__tests__/**'],
    },
  },
}));
