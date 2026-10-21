# Build APK Android

Dokumen ini menjelaskan cara menghasilkan APK_Debug dan APK_Rilis Aplikasi Data Pasien dari kode sumber web yang sama dengan versi PWA. Package_Identifier tetap: `com.datapasien.terapi`; target minimal Android 7.0 (API 24).

## 1. Prasyarat

| Perangkat lunak | Versi minimal | Keterangan |
| --- | --- | --- |
| Node.js | 22 | Beserta npm. Jalankan `npm install` sekali di root repositori. |
| JDK | 21 | Atur `JAVA_HOME` atau pastikan `java` ada di `PATH`. |
| Android SDK | Platform API 36 (`compileSdkVersion` di `android/variables.gradle`) | Variabel lingkungan `ANDROID_HOME` wajib menunjuk ke direktori SDK. |

Cek prasyarat:

```sh
npm run android:prereq
```

Perintah build juga menjalankan cek ini sebagai langkah pertama dan berhenti bila ada yang belum terpenuhi.

## 2. Perintah build

```sh
npm run android:debug     # APK_Debug
npm run android:release   # APK_Rilis (butuh Kunci_Penandatanganan, lihat bagian 3)
```

Langkah yang dijalankan berurutan: cek prasyarat, (rilis saja: cek Kunci_Penandatanganan dan validasi versi), `vite build`, `cap sync android`, Gradle `assembleDebug`/`assembleRelease`, salin APK ke `release/`, (rilis saja: perbarui `release/last-release.json`).

Bila satu langkah gagal, proses berhenti dengan kode keluar non-nol, mencetak `Langkah gagal: <nama langkah>`, dan tidak meninggalkan APK baru di `release/`.

## 3. Kunci_Penandatanganan (mode rilis)

Seluruh APK_Rilis harus ditandatangani dengan kunci yang sama. Bila kunci hilang, pembaruan tidak bisa dipasang di atas versi lama, jadi simpan cadangannya di tempat aman.

### Membuat keystore

Simpan file keystore di luar repositori (file `*.jks`, `*.keystore`, dan `keystore.properties` sudah ada di `.gitignore`, tetapi tetap jangan taruh di dalam repo).

```sh
keytool -genkeypair -v -keystore C:/kunci/datapasien-release.jks -alias datapasien -keyalg RSA -keysize 2048 -validity 10000
```

`keytool` tersedia di folder `bin` JDK. Catat password store, alias, dan password key.

### Konfigurasi

Pilih salah satu cara berikut. Nilai di `keystore.properties` diutamakan; nilai yang kosong diambil dari variabel lingkungan.

Cara A: salin `android/keystore.properties.example` menjadi `android/keystore.properties` lalu isi:

```properties
storeFile=C:/kunci/datapasien-release.jks
storePassword=...
keyAlias=datapasien
keyPassword=...
```

Path relatif pada `storeFile` diselesaikan terhadap direktori `android/`.

Cara B: variabel lingkungan

| Variabel | Isi |
| --- | --- |
| `DATAPASIEN_KEYSTORE_FILE` | Path file keystore |
| `DATAPASIEN_KEYSTORE_PASSWORD` | Password store |
| `DATAPASIEN_KEYSTORE_ALIAS` | Alias key |
| `DATAPASIEN_KEYSTORE_KEY_PASSWORD` | Password key |

Contoh PowerShell:

```powershell
$env:DATAPASIEN_KEYSTORE_FILE = "C:/kunci/datapasien-release.jks"
$env:DATAPASIEN_KEYSTORE_PASSWORD = "..."
$env:DATAPASIEN_KEYSTORE_ALIAS = "datapasien"
$env:DATAPASIEN_KEYSTORE_KEY_PASSWORD = "..."
npm run android:release
```

Bila salah satu nilai tidak ada atau file keystore tidak ditemukan, build rilis gagal pada langkah `Cek Kunci_Penandatanganan`.

## 4. Lokasi keluaran

```
release/data-pasien-<versionName>-debug.apk
release/data-pasien-<versionName>-release.apk
```

Contoh: `release/data-pasien-1.0.0-release.apk`. File APK di `release/` tidak dikomit.

Setelah build rilis berhasil, `release/last-release.json` diperbarui dengan `versionName` dan `versionCode` rilis tersebut. File ini dipakai untuk memvalidasi rilis berikutnya, jadi komit file ini setiap kali merilis.

## 5. Menaikkan versi

Versi hanya diatur di `version.json` di root repositori (dibaca oleh `android/app/build.gradle`):

```json
{ "versionName": "1.0.1", "versionCode": 2 }
```

Aturan:

- `versionCode`: bilangan bulat ≥ 1; untuk rilis wajib lebih besar dari `versionCode` di `release/last-release.json`.
- `versionName`: format `MAJOR.MINOR.PATCH` (mis. `1.2.3`); untuk rilis wajib berbeda dari `versionName` rilis sebelumnya.

Bila aturan ini dilanggar, build rilis gagal pada langkah `Validasi versi rilis`. Build debug tidak memeriksa rilis sebelumnya.

## 6. Ikon aplikasi

`assets/icon.png` saat ini adalah ikon placeholder. Setelah menggantinya dengan ikon final (PNG persegi, disarankan 1024×1024), buat ulang ikon Android:

```sh
npm run android:icons
```

Lalu jalankan build seperti biasa.
