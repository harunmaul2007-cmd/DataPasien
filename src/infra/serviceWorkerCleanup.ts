// Pembersihan service worker di APK Android.
//
// APK membawa seluruh aset web sehingga service worker tidak diperlukan; SW dan
// cache peninggalan versi lama membuat WebView menyajikan tampilan lama setelah
// APK diperbarui. Fungsi ini melepas seluruh registrasi SW dan menghapus Cache
// Storage, lalu memuat ulang sekali bila halaman masih dikendalikan SW lama.
// Data pasien ada di IndexedDB dan TIDAK ikut terhapus.

export interface SwCleanupEnv {
  serviceWorker?: Pick<ServiceWorkerContainer, 'getRegistrations' | 'controller'> | undefined;
  caches?: Pick<CacheStorage, 'keys' | 'delete'> | undefined;
  reload: () => void;
  /** Penanda "sudah dimuat ulang" agar reload hanya sekali per sesi (mencegah loop). */
  session?: Pick<Storage, 'getItem' | 'setItem'> | undefined;
}

const KUNCI_RELOAD = 'datapasien-sw-cleanup-reloaded';

/** @returns true bila ada SW/cache yang dibersihkan. */
export async function bersihkanServiceWorker(env: SwCleanupEnv): Promise<boolean> {
  let dibersihkan = false;
  try {
    const regs = (await env.serviceWorker?.getRegistrations()) ?? [];
    for (const r of regs) {
      if (await r.unregister()) dibersihkan = true;
    }
    const keys = (await env.caches?.keys()) ?? [];
    for (const k of keys) {
      if (await env.caches!.delete(k)) dibersihkan = true;
    }
    // Halaman ini masih disajikan SW lama → muat ulang agar memakai aset APK terbaru.
    if (env.serviceWorker?.controller && env.session?.getItem(KUNCI_RELOAD) !== '1') {
      env.session?.setItem(KUNCI_RELOAD, '1');
      env.reload();
    }
  } catch {
    // Abaikan: pembersihan bersifat upaya terbaik.
  }
  return dibersihkan;
}
