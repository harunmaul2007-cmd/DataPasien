import { defineConfig, devices } from '@playwright/test';

// Uji E2E (Chromium) terhadap build produksi yang disajikan oleh `vite preview`.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Service worker hanya ada di build produksi, jadi uji selalu memakai build penuh
  // (`npm run build` = typecheck + vite build).
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
