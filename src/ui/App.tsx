// Kerangka aplikasi: provider DataStore, DialogStack, Toast, hash router,
// navigasi utama, dan layar memuat / gagal memuat.
//
// Modul halaman di `./pages/` diganti isinya pada tugas 12–15 tanpa mengubah
// berkas ini.

import { useState, type ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { createPlatformAdapter, type PlatformAdapter } from '../infra/platform';
import { DataStoreProvider, useDataStore, useDataStoreState, type DataStore } from '../state/dataStore';
import { DialogStackProvider, type DialogStackApi } from './components/DialogStack';
import { LoadErrorScreen, LoadingScreen } from './components/LoadErrorScreen';
import { ToastProvider } from './components/Toast';
import { BackButtonHandler } from './navigation/backButton';
import { MainNav } from './navigation/MainNav';
import { ROUTES } from './navigation/routes';
import { CadanganPage } from './pages/CadanganPage';
import { JadwalPage } from './pages/JadwalPage';
import { LaporanPage } from './pages/LaporanPage';
import { PasienDetailPage } from './pages/PasienDetailPage';
import { PasienListPage } from './pages/PasienListPage';
import { PengaturanPage } from './pages/PengaturanPage';

export function AppRoutes(): ReactNode {
  return (
    <Routes>
      <Route path={ROUTES.pasienList} element={<PasienListPage />} />
      <Route path={ROUTES.pasienDetail} element={<PasienDetailPage />} />
      <Route path={ROUTES.jadwal} element={<JadwalPage />} />
      <Route path={ROUTES.laporan} element={<LaporanPage />} />
      <Route path={ROUTES.pengaturan} element={<PengaturanPage />} />
      <Route path={ROUTES.cadangan} element={<CadanganPage />} />
      <Route path="*" element={<Navigate to={ROUTES.pasienList} replace />} />
    </Routes>
  );
}

/** Isi utama sesuai status DataStore. */
function AppContent(): ReactNode {
  const store = useDataStore();
  const { status } = useDataStoreState();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'error') return <LoadErrorScreen onRetry={() => void store.load()} />;
  return <AppRoutes />;
}

/** Tata letak: navigasi (bawah/sidebar) + area konten. Membutuhkan Router. */
export function AppShell(): ReactNode {
  return (
    <div className="app">
      <MainNav />
      <main className="app__main">
        <AppContent />
      </main>
    </div>
  );
}

export interface AppProps {
  store: DataStore;
  /** DialogStack eksternal (mis. untuk penanganan Tombol_Kembali); default dibuat sendiri. */
  dialogStack?: DialogStackApi;
  /** Adapter platform untuk Tombol_Kembali/exitApp; default sesuai platform saat ini. */
  platform?: PlatformAdapter;
}

/**
 * Aplikasi lengkap. Pemanggil bertanggung jawab memanggil `store.load()`
 * (lihat main.tsx), sehingga uji dapat mengatur keadaan store sendiri.
 */
export function App({ store, dialogStack, platform }: AppProps): ReactNode {
  // Adapter default dibuat sekali; bila prop `platform` diberikan, adapter itu dipakai.
  const [defaultPlatform] = useState<PlatformAdapter>(() => platform ?? createPlatformAdapter());
  const activePlatform = platform ?? defaultPlatform;
  return (
    <DataStoreProvider store={store}>
      <DialogStackProvider stack={dialogStack}>
        <ToastProvider>
          <HashRouter>
            <AppShell />
            <BackButtonHandler platform={activePlatform} />
          </HashRouter>
        </ToastProvider>
      </DialogStackProvider>
    </DataStoreProvider>
  );
}

export default App;
