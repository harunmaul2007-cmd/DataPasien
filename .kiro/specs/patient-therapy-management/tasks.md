# Implementation Plan: Manajemen Pasien Terapi

## Overview

Implementasi dilakukan bertahap dari lapisan domain murni (TypeScript), lalu infrastruktur penyimpanan (Dexie/IndexedDB), DataStore, UI React, dan terakhir pengemasan PWA serta APK Android dengan Capacitor. Setiap properti pada bagian Correctness Properties di design diimplementasikan sebagai satu test property-based (Vitest + fast-check, `numRuns` minimal 100) di file test tersendiri `__tests__/p{nomor}-*.property.test.ts`, diberi komentar tag `// Feature: patient-therapy-management, Property {nomor}: {judul}`.

## Tasks

- [x] 1. Menyiapkan struktur proyek dan tipe inti
  - [x] 1.1 Inisialisasi proyek Vite + React 18 + TypeScript dan perangkat uji
    - Buat `package.json` dengan versi dependensi dikunci (React, React Router, Dexie, Vitest, fast-check, Testing Library, fake-indexeddb, Playwright)
    - Buat `vite.config.ts`, `tsconfig.json`, konfigurasi Vitest (lingkungan jsdom, setup `fake-indexeddb/auto`), dan struktur direktori `src/domain`, `src/infra`, `src/state`, `src/ui`, `scripts/`, `docs/`
    - Buat `version.json` berisi `{ "versionName": "1.0.0", "versionCode": 1 }`
    - _Requirements: 13.1, 13.4_
  - [x] 1.2 Definisikan model data dan pembangkit identitas
    - Buat `src/domain/types.ts` (Pasien, SesiTerapi, JadwalKunjungan, StatusJadwal, AppData, ISODate, HHmm, input formulir) dan `src/domain/ids.ts` (UUID v4 via `crypto.randomUUID`)
    - _Requirements: 1.5, 10.3_
  - [x] 1.3 Buat generator bersama untuk property-based test
    - Buat `src/domain/__tests__/arbitraries.ts`: pasien/sesi/jadwal valid (teks non-ASCII, emoji, panjang tepat di batas), input formulir acak di sekitar batas, nomor HP valid dan hampir valid, tanggal valid/tidak valid, `AppData` dengan relasi konsisten, dan mutator File_Cadangan rusak
    - _Requirements: 10.3, 14.6, 14.8_

- [x] 2. Implementasi utilitas tanggal dan format tampilan
  - [x] 2.1 Implementasi `src/domain/tanggal.ts` dan `src/domain/format.ts`
    - `isTanggalValid` ("YYYY-MM-DD" dan tanggal kalender nyata, termasuk tahun kabisat), `todayISO`, `pad2`
    - `formatRupiah` manual (tanpa `Intl`, tepat satu spasi biasa, null → "-"), `parseRupiah`, `formatTanggal` ("DD MMMM YYYY" Bahasa Indonesia, kosong/tidak valid → "-"), `formatJam`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [x] 2.2 Tulis property test Format Rupiah
    - **Property 17: Format Rupiah benar dan dapat dibalik**
    - **Validates: Requirements 12.1, 12.3, 9.6**
  - [x] 2.3 Tulis property test validasi dan format tanggal
    - **Property 18: Validasi dan format tanggal**
    - **Validates: Requirements 5.3, 12.2, 12.4, 12.5**

- [x] 3. Implementasi Validator
  - [x] 3.1 Implementasi `src/domain/validator.ts`
    - `validatePasien`, `validateSesi`, `validateJadwal(input, now, pasienIds)`, `isNomorHpValid`, dengan normalisasi `trim()`, panjang dihitung per code point (`[...s].length`), seluruh kesalahan dikumpulkan sekaligus, dan pesan persis seperti tabel aturan di design
    - Sediakan opsi untuk melewati aturan "jadwal tidak boleh lewat" (dipakai saat impor cadangan)
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 2.3, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 6.2, 8.2, 8.3, 8.12_
  - [x] 3.2 Tulis property test validator pasien
    - **Property 1: Validator pasien sesuai model aturan**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 2.3**
  - [x] 3.3 Tulis property test validator sesi terapi
    - **Property 2: Validator sesi terapi sesuai model aturan**
    - **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 6.2**
  - [x] 3.4 Tulis property test validator jadwal
    - **Property 3: Validator jadwal sesuai model aturan**
    - **Validates: Requirements 8.2, 8.3, 8.12**

- [x] 4. Implementasi query pasien dan histori terapi
  - [x] 4.1 Implementasi `src/domain/pasienQuery.ts`
    - `sortPasien` (localeCompare 'id', sensitivity 'base', tie-break id), `searchPasien` (trim, case-insensitive, substring nama atau noHp, kosong → semua, hasil terurut), `lastTherapyDate`, `deletionSummary`
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4, 4.7_
  - [x] 4.2 Tulis property test pencarian dan pengurutan
    - **Property 9: Pencarian dan pengurutan daftar pasien**
    - **Validates: Requirements 4.2, 4.3, 4.4**
  - [x] 4.3 Tulis property test tanggal terapi terakhir
    - **Property 10: Tanggal terapi terakhir**
    - **Validates: Requirements 4.1, 4.7**
  - [x] 4.4 Implementasi `src/domain/histori.ts`
    - `buildHistori`: hanya sesi milik pasien, urut tanggal menurun lalu createdAt menurun, `jumlah` dan `totalBiaya`
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6_
  - [x] 4.5 Tulis property test histori terapi
    - **Property 11: Histori terapi sesuai model**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6**

- [x] 5. Implementasi logika jadwal dan laporan
  - [x] 5.1 Implementasi `src/domain/jadwal.ts`
    - `jadwalPadaTanggal`, `jadwalTerjadwalPasien`, `transisiStatus` (null jika bukan Terjadwal), `aksiTersedia`
    - _Requirements: 8.4, 8.9, 8.10, 8.11, 8.14_
  - [x] 5.2 Tulis property test tampilan jadwal
    - **Property 13: Tampilan jadwal per tanggal dan per pasien**
    - **Validates: Requirements 8.4, 8.11**
  - [x] 5.3 Tulis property test transisi status jadwal
    - **Property 14: Transisi status jadwal hanya dari Terjadwal**
    - **Validates: Requirements 8.9, 8.10, 8.14**
  - [x] 5.4 Implementasi `src/domain/laporan.ts`
    - `buildLaporan(bulan, tahun, sesi, pasien)` dengan filter prefiks `YYYY-MM-`, abaikan sesi tanpa pasien, urut tanggal menaik lalu nama pasien menaik (case-insensitive), `total`, `jumlahSesi`, `jumlahPasien`; fungsi daftar pilihan tahun 2000 sampai tahun berjalan + 1
    - _Requirements: 3.4, 6.4, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8_
  - [x] 5.5 Tulis property test laporan bulanan
    - **Property 15: Laporan bulanan sesuai model**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.7, 6.4, 3.4**
  - [x] 5.6 Tulis property test total dua belas bulan
    - **Property 16: Total dua belas bulan sama dengan total tahunan**
    - **Validates: Requirements 9.8**

- [~] 6. Checkpoint - Pastikan seluruh test lapisan domain lulus
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implementasi Repository (Dexie/IndexedDB)
  - [x] 7.1 Implementasi `src/infra/db.ts` dan `src/infra/repository.ts`
    - Skema Dexie versi 1 (`pasien: 'id, nama'`, `sesi: 'id, pasienId, tanggal'`, `jadwal: 'id, pasienId, tanggal, status'`)
    - Seluruh metode antarmuka `Repository`; `updatePasien` melempar `NotFoundError` bila id tidak ada; `deletePasienCascade` dan `replaceAll` dalam satu transaksi `rw` atas tiga tabel
    - Panggil `navigator.storage.persist()` saat pertama dibuka (jika tersedia)
    - _Requirements: 3.2, 3.6, 10.1, 10.2, 10.3, 10.5, 13.11, 13.12, 14.7_
  - [-] 7.2 Tulis property test round-trip penyimpanan
    - Gunakan fake-indexeddb dengan basis data baru per iterasi dan instance Repository baru untuk `loadAll`
    - **Property 19: Round-trip penyimpanan**
    - **Validates: Requirements 10.2, 10.3, 13.11**
  - [-] 7.3 Tulis property test hapus pasien berantai
    - **Property 7: Hapus pasien berantai dan ringkasannya**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5**
  - [-] 7.4 Tulis property test hapus sesi
    - **Property 8: Hapus sesi hanya menghapus satu sesi**
    - **Validates: Requirements 6.3**

- [ ] 8. Implementasi DataStore
  - [-] 8.1 Implementasi `src/state/dataStore.ts`
    - State `loading | ready | error`, `load()` tanpa menulis apa pun saat gagal, basis data kosong → state kosong tanpa error
    - Aksi tambah/ubah/hapus pasien, sesi, dan jadwal (termasuk tandai Selesai/Dibatalkan via `transisiStatus`) dengan pola validasi → Repository → perbarui memori → resolve; lempar `SaveError`/`NotFoundError` tanpa mengubah memori saat gagal; tolak operasi tulis saat state `error`
    - React context + `useSyncExternalStore` dan selector ter-memoize (daftar pasien, histori, jadwal per tanggal, laporan)
    - _Requirements: 1.1, 1.9, 2.2, 2.4, 5.1, 5.2, 6.1, 6.3, 7.7, 8.1, 8.7, 8.9, 8.10, 10.1, 10.4, 10.5, 10.6, 10.7, 11.8_
  - [~] 8.2 Tulis property test penambahan valid
    - **Property 4: Penambahan valid menambah tepat satu rekaman dengan identitas unik**
    - **Validates: Requirements 1.1, 1.5, 5.1, 5.2, 8.1**
  - [~] 8.3 Tulis property test penulisan yang ditolak
    - **Property 5: Penulisan yang ditolak tidak mengubah data**
    - **Validates: Requirements 1.2, 1.3, 2.3, 5.10, 6.2, 8.8**
  - [~] 8.4 Tulis property test pengubahan valid
    - **Property 6: Pengubahan valid mempertahankan identitas dan keterhubungan**
    - **Validates: Requirements 2.2, 6.1, 8.7**
  - [~] 8.5 Tulis property test kegagalan tulis atomik
    - Suntikkan kegagalan dengan membungkus tabel Dexie sehingga operasi ke-k dalam transaksi melempar galat
    - **Property 20: Kegagalan tulis bersifat atomik**
    - **Validates: Requirements 3.6, 10.5, 14.7**
  - [~] 8.6 Tulis unit test pemuatan DataStore
    - Gagal memuat → state error tanpa penulisan; basis data kosong → daftar kosong tanpa error; ubah pasien yang sudah tidak ada → `NotFoundError`
    - _Requirements: 2.4, 10.6, 10.7_

- [ ] 9. Implementasi cadangan dan pemulihan data
  - [x] 9.1 Implementasi `src/domain/cadangan.ts`
    - `FORMAT_VERSION = 1`, `serializeBackup` (JSON berindentasi 2, `exportedAt` ISO 8601 dengan offset lokal), `backupFileName`, `parseBackup` dengan urutan pemeriksaan dan pesan alasan Bahasa Indonesia sesuai design (memakai Validator tanpa aturan jadwal lewat)
    - _Requirements: 14.1, 14.2, 14.6, 14.8, 14.10_
  - [-] 9.2 Tulis property test round-trip cadangan
    - **Property 21: Round-trip cadangan**
    - **Validates: Requirements 14.1, 14.8, 14.10**
  - [-] 9.3 Tulis property test file cadangan rusak
    - **Property 23: File cadangan rusak ditolak**
    - **Validates: Requirements 14.6**
  - [-] 9.4 Tulis property test nama file cadangan
    - **Property 24: Nama file cadangan**
    - **Validates: Requirements 14.2**
  - [~] 9.5 Implementasi `src/infra/fileGateway.ts` dan aksi ekspor/impor di DataStore
    - FileGateway web (Blob download, `<input type="file">` dengan deteksi event `cancel` → null) dan Android (`@capacitor/filesystem` direktori Documents, UTF-8), dipilih berdasarkan platform
    - Tambahkan aksi `exportBackup` (mengembalikan nama file, lokasi, jumlah) dan `importBackup(data)` via `replaceAll` yang memperbarui memori hanya setelah transaksi berhasil
    - _Requirements: 14.1, 14.4, 14.7, 14.9, 14.11, 14.12_
  - [~] 9.6 Tulis property test impor mengganti seluruh data
    - **Property 22: Impor mengganti seluruh data dan idempoten**
    - **Validates: Requirements 14.4, 14.9**

- [~] 10. Checkpoint - Pastikan seluruh test domain, Repository, dan DataStore lulus
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implementasi kerangka UI dan navigasi
  - [~] 11.1 Buat kerangka aplikasi di `src/main.tsx`, `src/ui/App.tsx`, `src/ui/navigation/`, dan `src/ui/components/`
    - Hash router dengan rute `/`, `/pasien/:id`, `/jadwal`, `/laporan`, `/cadangan` yang mengimpor modul halaman di `src/ui/pages/` (buat file halaman sebagai stub sederhana; isinya diganti pada tugas 12–15 tanpa mengubah `App.tsx`)
    - Navigasi bawah (< 768 px) dengan Pasien, Jadwal, Laporan + ikon ke Cadangan; sidebar tetap (≥ 768 px)
    - Token CSS global (area sentuh min 44×44 px, `max-width: 100%`, `overflow-wrap: anywhere`), komponen `Dialog` berbasis `<dialog>` yang terdaftar di `DialogStack`, komponen Toast dengan `role="alert"`, input field dengan `aria-describedby`/`aria-invalid`
    - Provider DataStore, layar "Data gagal dimuat" dengan tombol Coba lagi
    - _Requirements: 10.6, 10.7, 11.1, 11.2, 11.3, 11.6_
  - [~] 11.2 Tulis unit test navigasi dan dialog
    - Navigasi menampilkan tiga menu; `DialogStack` menutup dialog teratas; layar gagal muat tampil saat `load()` gagal
    - _Requirements: 10.6, 11.2, 11.6_

- [ ] 12. Implementasi halaman daftar pasien
  - [~] 12.1 Implementasi `src/ui/pages/PasienListPage.tsx` beserta dialog formulir dan hapus pasien
    - Daftar (nama, alamat, noHp, tanggal terapi terakhir atau "-"), pencarian `maxLength={100}` dengan debounce 200 ms, pesan "Belum ada data pasien" / "Pasien tidak ditemukan"
    - `PasienFormDialog` untuk tambah dan ubah (nilai awal dari data tersimpan, pesan per field, isian dipertahankan saat gagal, batal tanpa simpan, pesan "Data pasien tidak ditemukan")
    - `HapusPasienDialog` menampilkan nama, jumlah sesi, dan jumlah jadwal (via `deletionSummary`), konfirmasi/batal, pesan berhasil atau "Penghapusan gagal"
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 1.8, 1.9, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.5, 3.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
  - [~] 12.2 Tulis unit test halaman daftar pasien
    - Isian awal formulir ubah, pesan kesalahan bersamaan, formulir dipertahankan saat Repository gagal, dialog hapus dengan angka 0, batal hapus, pesan kosong
    - _Requirements: 1.8, 1.9, 2.1, 2.5, 3.1, 3.3, 4.5, 4.8_

- [ ] 13. Implementasi halaman detail pasien dan sesi terapi
  - [~] 13.1 Implementasi `src/ui/pages/PasienDetailPage.tsx`, `SesiFormDialog`, `HapusSesiDialog`, dan `HistoriItem`
    - Data pasien, jumlah sesi dan total biaya (Format_Rupiah), histori dari `buildHistori`, pesan "Belum ada histori terapi" / pasien tidak ditemukan / "Histori terapi gagal dimuat"
    - Formulir sesi baru dengan tanggal hari ini sebagai nilai awal (dapat menerima nilai awal pasienId dan tanggal dari luar), formulir ubah dengan nilai tersimpan, dialog hapus menyebut nama pasien, tanggal, dan biaya
    - Daftar jadwal Terjadwal milik pasien via `jadwalTerjadwalPasien` atau "Belum ada jadwal kunjungan"
    - _Requirements: 5.1, 5.2, 5.7, 5.10, 6.1, 6.2, 6.3, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.11_
  - [~] 13.2 Tulis property test tampilan item histori
    - **Property 12: Tampilan item histori memuat seluruh field**
    - **Validates: Requirements 7.4**
  - [~] 13.3 Tulis unit test halaman detail pasien
    - Tanggal hari ini sebagai nilai awal, isian formulir ubah sesi, dialog hapus sesi dan pembatalannya, pembaruan histori tanpa membuka ulang halaman, pesan kosong dan tidak ditemukan
    - _Requirements: 5.7, 6.5, 6.6, 6.7, 7.6, 7.7, 7.8_

- [ ] 14. Implementasi halaman jadwal dan laporan
  - [~] 14.1 Implementasi `src/ui/pages/JadwalPage.tsx`, `JadwalFormDialog`, dan `HapusJadwalDialog`
    - Pemilih tanggal (default hari ini), daftar via `jadwalPadaTanggal` dengan nama, noHp, tanggal, jam JJ:MM, catatan, status; pesan "Tidak ada jadwal pada tanggal ini"
    - Aksi sesuai `aksiTersedia`; tandai Selesai lalu dialog "Catat sesi terapi sekarang?" yang membuka `SesiFormDialog` dengan pasienId dan tanggal jadwal; tandai Dibatalkan; ubah dan hapus dengan konfirmasi
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.12, 8.13, 8.14_
  - [~] 14.2 Tulis unit test halaman jadwal
    - Pesan kosong, alur tandai Selesai → tawaran formulir sesi (terima dan tolak), aksi tidak tersedia untuk Selesai/Dibatalkan, batal hapus
    - _Requirements: 8.5, 8.9, 8.13, 8.14_
  - [~] 14.3 Implementasi `src/ui/pages/LaporanPage.tsx`
    - Filter bulan (Januari–Desember) dan tahun (2000 sampai tahun berjalan + 1) dengan default bulan/tahun berjalan; total, jumlah sesi, jumlah pasien, rincian via `buildLaporan` dalam Format_Rupiah dan "DD MMMM YYYY"; pesan "Tidak ada pemasukan pada bulan ini" dan "Laporan gagal dimuat" dengan filter dipertahankan
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9_
  - [~] 14.4 Tulis unit test halaman laporan
    - Filter default, pesan bulan kosong, kondisi gagal memuat
    - _Requirements: 9.1, 9.7, 9.9_

- [ ] 15. Implementasi halaman cadangan
  - [~] 15.1 Implementasi `src/ui/pages/CadanganPage.tsx`
    - Tombol ekspor dengan pesan berhasil (nama file, lokasi, jumlah) atau "Ekspor gagal"
    - Tombol impor: pilih file → `parseBackup` → pesan alasan jika ditolak, atau dialog konfirmasi dengan jumlah dan peringatan penggantian; konfirmasi → `importBackup`; pembatalan pemilihan file tanpa pesan
    - _Requirements: 14.1, 14.3, 14.4, 14.5, 14.6, 14.7, 14.10, 14.11, 14.12_
  - [~] 15.2 Tulis unit test halaman cadangan
    - Pemilih file dibatalkan, file rusak menampilkan alasan tanpa dialog, batal impor, ekspor gagal, impor gagal mempertahankan data
    - _Requirements: 14.3, 14.5, 14.6, 14.7, 14.11, 14.12_

- [~] 16. Checkpoint - Pastikan seluruh test UI lulus
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Implementasi PWA dan pengemasan Android
  - [~] 17.1 Konfigurasi PWA dengan `vite-plugin-pwa`
    - Precache seluruh aset, manifest (`display: standalone`, nama "Data Pasien", ikon dari `assets/icon.png`)
    - _Requirements: 11.4, 11.5, 11.7_
  - [~] 17.2 Implementasi `src/infra/platform.ts` dan penanganan Tombol_Kembali
    - `PlatformAdapter` (web: no-op; Android: `@capacitor/app` `backButton` dan `exitApp`), handler di App: tutup dialog teratas → `navigate(-1)` jika bukan Halaman_Utama → dialog konfirmasi keluar (Keluar/Batal)
    - _Requirements: 13.14, 13.15, 13.16, 13.17, 13.18_
  - [~] 17.3 Tulis unit test logika Tombol_Kembali
    - Tiga keadaan: dialog terbuka, bukan Halaman_Utama, Halaman_Utama (keluar dan batal)
    - _Requirements: 13.14, 13.15, 13.16, 13.17, 13.18_
  - [~] 17.4 Konfigurasi Capacitor dan proyek Android
    - `capacitor.config.ts` (`appId: 'com.datapasien.terapi'`, `appName: 'Data Pasien'`, `webDir: 'dist'`, tanpa `server.url`), versi Capacitor dikunci, proyek `android/`
    - `android/app/build.gradle` membaca `versionCode`/`versionName` dari `version.json`, `minSdkVersion 24`, signing config dari `android/keystore.properties` atau env `DATAPASIEN_KEYSTORE_*`; tambahkan `keystore.properties` dan `*.jks` ke `.gitignore`; ikon via `@capacitor/assets`
    - _Requirements: 13.1, 13.2, 13.4, 13.6, 13.7, 13.8, 13.10, 13.12_
  - [~] 17.5 Implementasi `scripts/check-prereq.mjs` dan `scripts/build-android.mjs`
    - Cek Node ≥ 22, JDK ≥ 21, `ANDROID_HOME`; langkah berurutan (cek prasyarat, `vite build`, `cap sync android`, Gradle assemble, salin APK ke `release/`), setiap langkah gagal mencetak `Langkah gagal: <nama langkah>`, keluar non-nol, hapus APK sementara
    - Mode rilis: langkah "Cek Kunci_Penandatanganan", validasi `versionCode` lebih besar dan `versionName` berformat `^\d+\.\d+\.\d+$` serta berbeda dari `release/last-release.json`, perbarui file tersebut setelah berhasil
    - Tambahkan skrip npm `android:debug` dan `android:release`
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.13_
  - [~] 17.6 Tulis unit test skrip build
    - Validasi versi rilis (versionCode tidak naik, versionName tidak valid atau sama), kegagalan langkah mencetak nama langkah dan tidak menyalin APK, kunci tidak tersedia
    - _Requirements: 13.5, 13.13_
  - [~] 17.7 Tulis `docs/BUILD.md` (Dokumentasi_Build)
    - Prasyarat dan versi minimal, perintah APK_Debug dan APK_Rilis, pembuatan keystore dengan `keytool` dan penyimpanannya di luar repositori, lokasi keluaran `release/`, cara menaikkan versi di `version.json`
    - _Requirements: 13.3_

- [ ] 18. Uji end-to-end
  - [~] 18.1 Tulis test Playwright untuk tata letak, offline, dan persistensi
    - Tanpa scroll horizontal dan area sentuh ≥ 44×44 pada lebar 360, 414, 768, 1024, 1440, 1920 px; navigasi bawah vs sidebar; data tetap setelah reload; mode offline setelah service worker terpasang; laporan tampil < 2 detik dengan 5.000 sesi
    - _Requirements: 9.1, 9.2, 10.2, 11.1, 11.2, 11.3, 11.5, 11.6, 11.8_

- [~] 19. Final checkpoint - Pastikan seluruh test lulus
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tugas bertanda `*` bersifat opsional dan dapat dilewati untuk MVP yang lebih cepat
- Setiap tugas merujuk requirement spesifik untuk ketertelusuran
- Property test memvalidasi properti universal; unit test memvalidasi contoh spesifik dan kasus tepi
- Verifikasi pemasangan APK di perangkat/emulator (API 24 dan terbaru), pembaruan versi, penolakan downgrade/kunci berbeda, serta waktu buka < 5 detik (Req 13.6, 13.8, 13.12, 13.19) dilakukan secara manual di luar daftar tugas ini

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.1", "4.1", "4.4", "5.1", "5.4"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "4.2", "4.3", "4.5", "5.2", "5.3", "5.5", "5.6", "7.1", "9.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.4", "8.1", "9.2", "9.3", "9.4"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6", "9.5", "11.1"] },
    { "id": 7, "tasks": ["9.6", "11.2", "12.1", "13.1", "14.3", "15.1", "17.1"] },
    { "id": 8, "tasks": ["12.2", "13.2", "13.3", "14.1", "14.4", "15.2", "17.4"] },
    { "id": 9, "tasks": ["14.2", "17.5"] },
    { "id": 10, "tasks": ["17.2", "17.6", "17.7"] },
    { "id": 11, "tasks": ["17.3", "18.1"] }
  ]
}
```
