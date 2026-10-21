import type { CapacitorConfig } from '@capacitor/cli';

// Aset web dibundel ke dalam APK (webDir) sehingga Aplikasi berjalan offline
// sejak pemasangan pertama. Sengaja TANPA `server.url` agar WebView tidak
// memuat konten dari jaringan (Req 13.10).
const config: CapacitorConfig = {
  appId: 'com.datapasien.terapi',
  appName: 'Data Pasien',
  webDir: 'dist',
  android: {
    // Kompatibel dengan Android 7.0 (API 24) ke atas; minSdk diatur di variables.gradle.
    allowMixedContent: false,
  },
};

export default config;
