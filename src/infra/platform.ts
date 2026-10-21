// PlatformAdapter: abstraksi fitur khusus platform native (Android/Capacitor).
//
// - Web: no-op. Tombol kembali peramban ditangani peramban sendiri dan
//   `exitApp` tidak berarti apa-apa.
// - Android (Capacitor native): `onBack` memakai listener `backButton` dari
//   @capacitor/app (yang menggantikan perilaku bawaan WebView), dan `exitApp`
//   memanggil `App.exitApp()` (Req 13.14–13.18).

import { Capacitor } from '@capacitor/core';

export interface PlatformAdapter {
  /** true bila berjalan sebagai aplikasi native (APK_Android). */
  isNative: boolean;
  /** Mendaftarkan handler Tombol_Kembali; mengembalikan fungsi untuk melepasnya. */
  onBack(handler: () => void): () => void;
  /** Menutup Aplikasi. */
  exitApp(): void;
}

/** Adapter web: tidak ada Tombol_Kembali yang perlu disadap. */
export function createWebPlatform(): PlatformAdapter {
  return {
    isNative: false,
    onBack: () => () => {},
    exitApp: () => {},
  };
}

/** Adapter Android melalui @capacitor/app. */
export function createAndroidPlatform(): PlatformAdapter {
  // Impor dinamis: plugin hanya dimuat di platform native.
  const appPlugin = import('@capacitor/app').then((m) => m.App);
  return {
    isNative: true,
    onBack(handler) {
      let removed = false;
      let remove: (() => Promise<void>) | null = null;
      void appPlugin
        .then((App) => App.addListener('backButton', () => handler()))
        .then((handle) => {
          if (removed) void handle.remove();
          else remove = () => handle.remove();
        });
      return () => {
        if (removed) return;
        removed = true;
        if (remove) void remove();
      };
    },
    exitApp() {
      void appPlugin.then((App) => App.exitApp());
    },
  };
}

/** PlatformAdapter sesuai platform saat ini. */
export function createPlatformAdapter(isNative: boolean = Capacitor.isNativePlatform()): PlatformAdapter {
  return isNative ? createAndroidPlatform() : createWebPlatform();
}
