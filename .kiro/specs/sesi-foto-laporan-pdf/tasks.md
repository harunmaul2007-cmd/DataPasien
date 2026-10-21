# Implementation Plan: Foto Sesi, Laporan PDF, dan Penyempurnaan Data Pasien

## Overview

Implementasi dilakukan secara bertahap mengikuti arsitektur yang sudah ada:
1. Lapisan Domain (tipe baru, validasi umur & jenis kelamin, format, foto domain, laporan layout, kontak, WhatsApp, cadangan).
2. Lapisan Infrastruktur (skema database Dexie v2, repository foto & pengaturan, image processor, PDF renderer, gateway share/kontak/external link).
3. Lapisan State (DataStore dengan foto & pengaturan, optimistic updates, selektor baru).
4. Lapisan UI (komponen InfoPasien, FotoPicker, FotoStrip, PhotoViewer, NomorWhatsApp, LaporanSesiFlow, LogoPicker, serta integrasi halaman Pasien, Jadwal, Pengaturan, dan Cadangan).
5. Pengujian menyeluruh (unit test, property-based test dengan fast-check, dan verifikasi integrasi).

---

## Tasks

- [x] 1. Lapisan Domain & Model Data
  - [x] 1.1 Perluas model data di `src/domain/types.ts`
    - Tambah atribut `umur` (number | null) dan `jenisKelamin` ('Laki-laki' | 'Wanita' | null) pada `Pasien`, `PasienInput`, dan `PasienFields`
    - Definisikan tipe `FotoMeta`, `FotoDiproses`, `FotoData`, `FotoSource`
    - Definisikan tipe `PengaturanLaporan`, `PengaturanInput`, `PengaturanFields`
    - Definisikan tipe `LaporanModel`, `OpsiLaporan`
    - _Requirements: 1.1, 7.1, 10.9, 14.1, 14.2_
  - [x] 1.2 Perluas validator di `src/domain/validator.ts`
    - Implementasikan `parseUmur(s: string)` (angka 0–150, nol di depan diizinkan, spasi kosong -> null)
    - Perbarui `validatePasien` dengan validasi `umur` dan `jenisKelamin`
    - Perbarui `validateSesi` pesan kesalahan batas 1000 karakter polaPenyakit menjadi "Diagnosa melebihi batas 1000 karakter"
    - Implementasikan `validatePengaturan(input)` untuk namaPraktik, alamatPraktik, noHpPraktik
    - _Requirements: 7.3, 13.4, 14.3_
  - [x] 1.3 Perluas format tampilan di `src/domain/format.ts`
    - Implementasikan `formatUmur(umur: number | null)` -> "35 tahun", "0 tahun", null -> "-"
    - Implementasikan `formatJenisKelamin(jk: JenisKelamin | null)` -> "Laki-laki" | "Wanita" | "-"
    - Pindahkan / ekspor utilitas `atauStrip(s: string)`
    - _Requirements: 1.1, 1.2, 5.7, 14.6_
  - [x] 1.4 Implementasikan utilitas domain foto di `src/domain/foto.ts`
    - Konstanta `BATAS_JUMLAH_FOTO = 10`, `PROFIL_FOTO`, `PROFIL_LOGO`
    - `deteksiFormat(header: Uint8Array)` dari magic bytes (JPEG, PNG, GIF, BMP, WebP, HEIC, AVIF)
    - `ukuranTarget(w, h, maks)` mempertahankan rasio tanpa memperbesar
    - `teksAltFoto(n, tanggal)`, `posisiFoto(n, total)`, `navPenampil(index, total)`
    - Draft foto Formulir Sesi: `draftAwal`, `fotoDraftReducer`, `bolehTambah`, `diffDraft`, `pesanPenolakan`
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.10, 2.11, 2.21, 2.22, 3.4, 3.6, 3.8, 3.9, 10.2, 10.3_
  - [x] 1.5 Implementasikan utilitas WhatsApp & Kontak di `src/domain/whatsapp.ts` dan `src/domain/kontak.ts`
    - `nomorWhatsApp(noHp)` normalisasi ke format 62xxx tanpa '+'
    - `tautanWhatsApp(noHp)` -> `https://wa.me/{nomor}`
    - `normalisasiNomor(s)` hapus spasi dan simbol tanda baca nomor
    - `terapkanKontak(form, kontak, nomor)` untuk mengisi form pasien
    - _Requirements: 11.4, 11.7, 11.8, 12.2_
  - [x] 1.6 Perbarui serialisasi dan pemulihan cadangan di `src/domain/cadangan.ts`
    - `serializeBackup` menyertakan `umur` dan `jenisKelamin` (formatVersion tetap 1)
    - `parseBackup` memvalidasi `umur` dan `jenisKelamin`, serta kompatibel dengan data lama tanpa umur/jenisKelamin
    - Pastikan atribut `polaPenyakit` tetap sama di file JSON cadangan
    - _Requirements: 9.1, 9.11, 9.12, 9.13, 9.14, 13.6, 14.12_
  - [x] 1.7 Implementasikan model laporan dan tata letak PDF di `src/domain/warna.ts`, `src/domain/laporanSesi.ts`, dan `src/domain/laporanLayout.ts`
    - `warna.ts`: palet warna teks & latar dengan rasio kontras WCAG >= 4.5:1
    - `slugNama`, `namaFileLaporan`, `namaFileUnik`
    - `buildLaporanModel(pasien, sesi, foto, pengaturan, opsi, now)`
    - `laporanLayout.ts`: fungsi murni `bungkusTeks`, `layoutLaporan`, `gantiGlyphTakDidukung`
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9, 6.10, 6.11, 8.2, 8.3, 10.11, 10.12_

- [x] 2. Lapisan Infrastruktur & Dependensi
  - [x] 2.1 Pasang dependensi yang dibutuhkan
    - Instalasi `pdf-lib`, `@pdf-lib/fontkit`, `heic-to`, `@capacitor/share`, `@capacitor/app-launcher`
    - Sediakan font NotoSans-Regular.ttf dan NotoSans-Bold.ttf di `src/infra/fonts/`
    - Perbarui `vite.config.ts` untuk precache ttf & wasm
    - _Requirements: 2.20, 5.11, 6.7, 8.5, 12.3_
  - [x] 2.2 Perbarui skema database di `src/infra/db.ts`
    - Skema Dexie versi 2: tambah tabel `foto: 'id, sesiId, urutan'`, `fotoData: 'id'`, `pengaturan: 'id'`
    - Upgrade migrasi otomatis: migrasi pasien lama dengan default `umur: null, jenisKelamin: null`
    - _Requirements: 4.1, 4.8, 4.9, 14.9, 14.10_
  - [x] 2.3 Perbarui repository di `src/infra/repository.ts`
    - Perluas antarmuka `Repository` dengan `saveSesiDenganFoto`, `loadFotoData`, `savePengaturan`, `loadLogoData`
    - Implementasikan `saveSesiDenganFoto` dalam 1 transaksi atomik `rw`
    - Perbarui `deleteSesi`, `deletePasienCascade`, `replaceAll` untuk menghapus foto yatim
    - _Requirements: 4.2, 4.3, 4.4, 4.7, 9.4, 9.5, 9.7, 10.9_
  - [x] 2.4 Implementasikan `src/infra/imageProcessor.ts`
    - Dekode gambar via `createImageBitmap` / `heic-to`
    - Skalakan via canvas beresolusi tinggi, pertahankan rasio aspek
    - Deteksi transparansi alpha -> simpan sebagai PNG jika transparan, JPEG jika tanpa alpha
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.20, 2.21, 2.22, 10.2, 10.3_
  - [x] 2.5 Implementasikan gateway pendukung
    - Perluas `src/infra/fileGateway.ts` dengan `saveBinary` (dukungan Web `<a download>` & Android `Documents`)
    - Buat `src/infra/shareGateway.ts` (Web Share API Level 2 & `@capacitor/share`)
    - Buat `src/infra/externalLink.ts` (buka WhatsApp via PWA `window.open` atau Capacitor `AppLauncher`)
    - Buat `src/infra/contactGateway.ts` (PWA `navigator.contacts` & fallback)
    - Buat `src/infra/cameraGateway.ts` (deteksi kamera perangkat)
    - Buat `src/infra/pdfRenderer.ts` (render `Halaman[]` menjadi PDF bytes dengan `pdf-lib` + `fontkit`)
    - _Requirements: 2.2, 5.11, 8.4, 8.5, 8.6, 8.7, 8.8, 11.1, 11.2, 12.3_

- [x] 3. Lapisan State (DataStore)
  - [x] 3.1 Perluas state memori dan selector di `src/state/dataStore.ts`
    - Tambah `foto: FotoMeta[]` dan `pengaturan: PengaturanLaporan | null` di state
    - Tambah selector: `selectFotoSesi(sesiId)`, `selectJumlahFotoPasien(pasienId)`, `selectPengaturan()`, `loadFotoBlob(meta)`
    - Perbarui `selectDeletionSummary` untuk menyertakan `jumlahFoto`
    - _Requirements: 4.5, 4.6, 7.5_
  - [x] 3.2 Implementasikan aksi `simpanSesi` dan `simpanPengaturan`
    - `simpanSesi(pasienId, sesiId, input, draft)` dengan transaksi atomik dan rollback
    - `simpanPengaturan(input, logoDraft)` untuk menyimpan kop & logo
    - Pastikan `imporCadangan` membersihkan foto yatim dan mempertahankan pengaturan
    - _Requirements: 1.3, 1.6, 2.12, 2.13, 2.15, 7.2, 7.7, 7.10, 9.4, 9.5, 9.6, 10.9_

- [x] 4. Lapisan Antarmuka (UI Components & Pages)
  - [x] 4.1 Buat komponen baru
    - `src/ui/components/InfoPasien.tsx` (informasi baca-saja di atas form sesi)
    - `src/ui/components/FotoStrip.tsx` (thumbnail foto sesi dengan badge dan penanganan error)
    - `src/ui/components/PhotoViewer.tsx` (penampil foto layar penuh dengan navigasi prev/next & tombol kembali)
    - `src/ui/components/NomorWhatsApp.tsx` (tombol chat WhatsApp langsung `wa.me`)
    - `src/ui/pages/sesi/FotoPicker.tsx` (aksi tambah dari galeri & kamera beserta indikator proses)
    - `src/ui/pages/sesi/LaporanSesiFlow.tsx` (dialog pilihan laporan -> proses pembuatan -> pratinjau simpan & bagikan)
    - `src/ui/pages/pengaturan/LogoPicker.tsx` (pratinjau, ganti, dan hapus logo)
    - _Requirements: 1.1, 1.5, 2.1, 2.2, 2.9, 2.16, 3.1, 3.3, 3.4, 3.5, 5.2, 8.1, 10.1, 10.4, 12.1_
  - [x] 4.2 Perbarui halaman dan dialog yang sudah ada
    - `PasienFormDialog.tsx`: tambahkan field Umur, Jenis Kelamin, dan tombol "Ambil dari kontak"
    - `PasienDetailPage.tsx`: tampilkan Umur & Jenis Kelamin di detail pasien
    - `PasienListPage.tsx`: integrasikan `NomorWhatsApp` pada baris pasien
    - `SesiFormDialog.tsx`: integrasikan `InfoPasien`, `FotoPicker`, dan ganti label menjadi "Diagnosa"
    - `HistoriItem.tsx`: ganti label "Pola penyakit" menjadi "Diagnosa", tampilkan `FotoStrip` dan tombol "Buat laporan PDF"
    - `HapusSesiDialog.tsx` & `HapusPasienDialog.tsx`: sebutkan jumlah foto yang akan ikut terhapus
    - `JadwalPage.tsx` & `JadwalFormDialog.tsx`: integrasikan `NomorWhatsApp`
    - `CadanganPage.tsx`: perbarui pesan ekspor & konfirmasi impor terkait foto
    - _Requirements: 1.1, 1.4, 4.5, 4.6, 5.1, 9.2, 9.3, 11.1, 12.8, 12.9, 13.1, 13.2, 14.1, 14.4, 14.6_
  - [x] 4.3 Implementasikan `src/ui/pages/PengaturanPage.tsx` dan Navigasi
    - Buat halaman Pengaturan dengan formulir nama praktik, alamat, no HP, dan LogoPicker
    - Perbarui `src/ui/navigation/routes.ts` dan `src/ui/navigation/MainNav.tsx` untuk menyertakan menu Pengaturan
    - Tambahkan rute di `src/ui/App.tsx`
    - Tambahkan CSS untuk komponen baru di `src/ui/styles.css`
    - _Requirements: 7.1, 7.8, 7.9, 10.1, 10.4_

- [x] 5. Pengujian & Verifikasi Kualitas
  - [x] 5.1 Tulis unit & property test untuk domain baru
    - Test `validator.ts` untuk `umur`, `jenisKelamin`, `polaPenyakit -> Diagnosa`, dan `pengaturan`
    - Test `format.ts` untuk `formatUmur` dan `formatJenisKelamin`
    - Test `foto.ts` untuk deteksi magic bytes, perhitungan ukuran target, dan foto draft reducer
    - Test `whatsapp.ts` dan `kontak.ts`
    - Test `cadangan.ts` untuk migrasi roundtrip umur & jenis kelamin
    - Test `laporanLayout.ts` pembungkusan teks, penomoran halaman, dan kontras warna
  - [x] 5.2 Tulis test integrasi untuk Repository & DataStore
    - Test penyimpanan atomik sesi bersama foto
    - Test penghapusan foto berantai saat sesi / pasien dihapus
    - Test pembersihan foto yatim saat impor cadangan
  - [x] 5.3 Jalankan seluruh test suite dan verifikasi tidak ada regresi
    - Jalankan `npm test` dan pastikan seluruh test lama dan baru lulus 100%
