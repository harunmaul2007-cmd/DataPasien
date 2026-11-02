import { Capacitor } from '@capacitor/core';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { openRepository } from './infra/repository';
import { bersihkanServiceWorker } from './infra/serviceWorkerCleanup';
import { createDataStore } from './state/dataStore';
import { App } from './ui/App';
import { sembunyikanSplash } from './ui/splash';
import './ui/styles.css';

// Repository dibuka di dalam load() sehingga kegagalan membuka basis data
// menjadi layar "Data gagal dimuat" yang dapat dicoba lagi (Req 10.6).
// APK Android: buang service worker & cache peninggalan versi lama agar
// tampilan selalu dari aset APK terbaru (data IndexedDB tidak tersentuh).
if (Capacitor.isNativePlatform()) {
  void bersihkanServiceWorker({
    serviceWorker: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
    caches: typeof caches !== 'undefined' ? caches : undefined,
    reload: () => window.location.reload(),
    session: sessionStorage,
  });
}

const store = createDataStore({ repository: () => openRepository() });
// Splash dihitung sejak halaman mulai dimuat (performance.now() ≈ 0).
// Di bawah otomasi (Playwright) splash tidak ditahan agar uji e2e tidak melambat.
void sembunyikanSplash({ siap: store.load(), mulai: 0, minimumMs: navigator.webdriver ? 0 : undefined });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App store={store} />
    </StrictMode>,
  );
}
