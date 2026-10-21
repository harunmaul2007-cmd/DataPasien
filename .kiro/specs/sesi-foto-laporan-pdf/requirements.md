# Requirements Document

## Introduction

Fitur ini memperluas Aplikasi Manajemen Pasien Terapi (spesifikasi "patient-therapy-management", selanjutnya disebut Spesifikasi_Dasar) dengan kemampuan berikut pada Sesi_Terapi dan Data_Pasien:

1. Menampilkan Data_Pasien (nama, Umur, Jenis_Kelamin, alamat, nomor HP) sebagai informasi baca-saja di formulir Sesi_Terapi, sehingga Pengguna tahu sesi dicatat untuk Pasien yang benar. Data_Pasien tidak diduplikasi ke dalam Sesi_Terapi; perubahan Data_Pasien tetap dilakukan lewat formulir ubah pasien (Requirement 2 Spesifikasi_Dasar).
2. Melampirkan beberapa Foto_Sesi (dari galeri atau kamera) pada setiap Sesi_Terapi, disimpan secara lokal dan dapat digunakan tanpa koneksi internet.
3. Membuat Laporan_Sesi berformat PDF yang menarik untuk satu Sesi_Terapi, berisi Data_Pasien dan data Sesi_Terapi, yang dapat disimpan ke perangkat atau dibagikan ke Pasien (misalnya melalui WhatsApp).
4. Menyediakan Halaman_Pengaturan yang dapat dibuka dari navigasi utama untuk mengatur Nama_Praktik, kontak praktik, dan Logo_Praktik pada Kop_Laporan.
5. Mengisi nomor HP pada formulir tambah/ubah pasien dengan memilih Kontak_Perangkat dari buku kontak ponsel (Requirement 11).
6. Membuka chat WhatsApp dengan Pasien langsung dari nomor HP di daftar pasien, halaman detail Pasien, Halaman_Jadwal, dan Formulir_Jadwal (Requirement 12).
7. Mengganti label tampilan "Pola penyakit" menjadi "Diagnosa" tanpa mengubah atribut data tersimpan (Requirement 13).
8. Menambahkan atribut opsional Umur dan Jenis_Kelamin pada Data_Pasien (Requirement 14).

Seluruh fitur berjalan sepenuhnya di perangkat (offline-first, tanpa server), baik pada PWA maupun APK_Android, kecuali chat WhatsApp (Requirement 12) yang diteruskan ke aplikasi WhatsApp atau peramban dan membutuhkan koneksi internet di luar Aplikasi, dan mengikuti seluruh aturan Spesifikasi_Dasar yang tidak diubah secara eksplisit di dokumen ini.

Keputusan (hasil konfirmasi Pengguna):

- K1. Batas Foto_Sesi dikonfirmasi: maksimal 10 Foto_Sesi per Sesi_Terapi, file sumber maksimal 20 MB, dan sisi terpanjang maksimal 1600 piksel. Galeri adalah Sumber_Foto utama; aksi kamera tetap tersedia.
- K2. Format sumber yang diterima: JPEG, PNG, WebP, HEIC/HEIF, GIF (hanya frame pertama), BMP, dan AVIF. Setiap format dikonversi di perangkat tanpa koneksi internet ke Format_Foto_Simpan (JPEG, atau PNG apabila sumber memiliki transparansi; ditetapkan final di desain). HEIC/HEIF wajib berfungsi di PWA dan APK_Android meskipun peramban tidak dapat mendekodenya secara bawaan. Batas waktu proses 3 detik per gambar, dan 5 detik per gambar untuk HEIC/HEIF (asumsi).
- K3. Kop_Laporan memuat Logo_Praktik opsional. Nama_Praktik dan Logo_Praktik diatur di Halaman_Pengaturan ("Pengaturan") yang dapat dibuka dari navigasi utama.
- K4. Bawaan dialog laporan dikonfirmasi: biaya tidak disertakan, foto disertakan.
- K5. Laporan_Sesi hanya dibuat per satu Sesi_Terapi; tidak ada laporan gabungan.
- K6. Foto_Sesi tidak memiliki keterangan (caption).
- K7. File_Cadangan tetap versi format 1 dan tidak memuat Foto_Sesi, Pengaturan_Laporan, maupun Logo_Praktik. Saat impor, Foto_Sesi yang Sesi_Terapi-nya tidak ada di file dihapus, sedangkan Foto_Sesi yang identitas Sesi_Terapi-nya juga ada di file dipertahankan (asumsi). Pengaturan_Laporan dan Logo_Praktik tidak berubah saat impor.
- K8. Aksi "Ambil dari kontak" tersedia pada APK_Android (melalui plugin kontak) dan pada PWA hanya apabila peramban mendukung Contact Picker API; selain itu aksi disembunyikan dan nomor HP tetap diisi manual. Nomor dari Kontak_Perangkat dinormalisasi lalu dimasukkan ke isian Nomor HP tanpa menyimpan otomatis. Nomor yang tetap bukan Nomor_HP_Valid setelah normalisasi tetap dimasukkan, dan pesan kesalahan baru ditampilkan oleh validasi biasa saat formulir dikirim. Isian Nama yang kosong diisi dengan nama Kontak_Perangkat (asumsi). Aplikasi hanya membaca Kontak_Perangkat yang dipilih dan tidak menyimpan data kontak lain.
- K9. Nomor HP di daftar pasien, halaman detail Pasien, setiap Jadwal_Kunjungan di Halaman_Jadwal, dan Formulir_Jadwal (setelah Pasien dipilih) menjadi aksi yang membuka Tautan_WhatsApp ("https://wa.me/{Nomor_WhatsApp}") melalui sistem. Aplikasi tidak memeriksa koneksi internet sebelum membuka tautan.
- K10. Label "Pola penyakit" diganti menjadi "Diagnosa" hanya pada tampilan (Formulir_Sesi, Histori_Terapi, Laporan_Sesi). Atribut data tersimpan tetap sama, sehingga tidak ada migrasi data dan format File_Cadangan tidak berubah.
- K11. Umur (bilangan bulat 0-150 tahun) dan Jenis_Kelamin ("Laki-laki" atau "Wanita") bersifat opsional agar Data_Pasien lama tetap valid (asumsi). Umur disimpan sesuai isian dan tidak bertambah otomatis seiring waktu; tanggal lahir tidak dipilih (asumsi). Umur dan Jenis_Kelamin ditampilkan di halaman detail Pasien, Formulir_Sesi, dan Laporan_Sesi, tetapi tidak ditampilkan di daftar pasien agar daftar tetap ringkas (keputusan). File_Cadangan tetap versi format 1 dengan atribut `umur` dan `jenisKelamin` yang boleh tidak ada.

Catatan penulisan: kata kunci pola EARS (WHEN, WHILE, IF/THEN, WHERE, THE, SHALL) ditulis dalam bahasa Inggris agar struktur requirement tetap konsisten, sedangkan isinya ditulis dalam Bahasa Indonesia. Rujukan "Requirement N Spesifikasi_Dasar" mengacu pada requirement di spesifikasi "patient-therapy-management".

## Glossary

Istilah berikut digunakan sesuai definisi di Spesifikasi_Dasar: Aplikasi, Pengguna, Pasien, Data_Pasien, Sesi_Terapi, Histori_Terapi, Jadwal_Kunjungan, Modul_Pasien, Modul_Terapi, Validator, Penyimpanan_Data, Nomor_HP_Valid, Format_Rupiah, APK_Android, PWA, Tombol_Kembali, Modul_Cadangan, File_Cadangan.

- **Spesifikasi_Dasar**: Spesifikasi "patient-therapy-management" yang telah diimplementasikan.
- **PWA**: Aplikasi yang dijalankan dan dipasang melalui peramban (Requirement 11 Spesifikasi_Dasar).
- **Formulir_Sesi**: Formulir tambah dan ubah Sesi_Terapi dalam dialog.
- **Foto_Sesi**: Gambar yang dilampirkan Pengguna pada satu Sesi_Terapi, terdiri dari identitas unik, gambar ber-Format_Foto_Simpan hasil konversi dan/atau pengecilan (atau gambar sumber apabila sudah ber-Format_Foto_Simpan dan tidak perlu dikecilkan), jenis gambar, ukuran dalam byte, lebar dan tinggi dalam piksel, urutan, dan waktu ditambahkan.
- **Modul_Foto**: Bagian Aplikasi yang menerima, mengecilkan, menyimpan, menampilkan, dan menghapus Foto_Sesi.
- **Sumber_Foto**: Asal Foto_Sesi, yaitu galeri/penyimpanan file perangkat atau kamera perangkat.
- **Thumbnail**: Tampilan Foto_Sesi berukuran kecil di Formulir_Sesi dan Histori_Terapi.
- **Penampil_Foto**: Tampilan layar penuh yang menampilkan satu Foto_Sesi dalam ukuran besar, dengan navigasi ke Foto_Sesi sebelumnya dan berikutnya dalam Sesi_Terapi atau Formulir_Sesi yang sama.
- **Batas_Jumlah_Foto**: Jumlah maksimal Foto_Sesi per Sesi_Terapi, yaitu 10.
- **Batas_Ukuran_Sumber**: Ukuran maksimal file gambar sumber yang diterima, yaitu 20 MB (20.971.520 byte).
- **Batas_Dimensi_Foto**: Panjang maksimal sisi terpanjang Foto_Sesi yang disimpan, yaitu 1600 piksel.
- **Format_Foto_Didukung**: Jenis file gambar sumber yang diterima, yaitu JPEG, PNG, WebP, HEIC/HEIF, GIF (hanya frame pertama yang digunakan), BMP, dan AVIF.
- **Format_Foto_Simpan**: Format gambar yang disimpan untuk Foto_Sesi dan Logo_Praktik, yaitu JPEG, atau PNG apabila gambar sumber memiliki piksel transparan. Format final ditetapkan di dokumen desain.
- **Laporan_Sesi**: Dokumen PDF untuk satu Sesi_Terapi yang berisi Kop_Laporan, Data_Pasien, data Sesi_Terapi, dan bagian opsional (biaya, Foto_Sesi).
- **Modul_Laporan_Sesi**: Bagian Aplikasi yang menyusun, menampilkan pratinjau, menyimpan, dan membagikan Laporan_Sesi.
- **Kop_Laporan**: Bagian atas halaman pertama Laporan_Sesi yang memuat Logo_Praktik apabila tersimpan, Nama_Praktik, serta alamat praktik dan nomor HP praktik apabila terisi.
- **Nama_Praktik**: Nama klinik/praktik yang ditampilkan pada Kop_Laporan, dengan nilai bawaan "Data Pasien".
- **Logo_Praktik**: Gambar logo klinik/praktik opsional yang diunggah Pengguna dari galeri, disimpan ber-Format_Foto_Simpan dengan sisi terpanjang tidak melebihi Batas_Dimensi_Logo.
- **Batas_Ukuran_Logo**: Ukuran maksimal file gambar sumber Logo_Praktik, yaitu 5 MB (5.242.880 byte).
- **Batas_Dimensi_Logo**: Panjang maksimal sisi terpanjang Logo_Praktik yang disimpan, yaitu 512 piksel.
- **Pengaturan_Laporan**: Data pengaturan yang tersimpan di perangkat berisi Nama_Praktik, alamat praktik opsional, nomor HP praktik opsional, dan Logo_Praktik opsional.
- **Halaman_Pengaturan**: Halaman Aplikasi berjudul "Pengaturan" yang memuat formulir Pengaturan_Laporan.
- **Modul_Pengaturan**: Bagian Aplikasi yang menampilkan Halaman_Pengaturan serta menerima, memproses, dan menyimpan Pengaturan_Laporan termasuk Logo_Praktik.
- **Navigasi_Utama**: Bilah navigasi utama Aplikasi yang memuat menu halaman-halaman utama (misalnya daftar pasien, jadwal, dan Cadangan).
- **Nama_File_Laporan**: Nama file Laporan_Sesi dengan format "laporan-terapi-{nama}-YYYYMMDD.pdf", dengan {nama} adalah nama Pasien yang diubah menjadi huruf kecil, setiap rangkaian karakter selain huruf a-z dan angka 0-9 diganti satu tanda "-", tanpa "-" di awal dan akhir, dipotong maksimal 40 karakter, dan YYYYMMDD adalah tanggal terapi.
- **Fitur_Berbagi**: Kemampuan sistem operasi untuk mengirim file ke aplikasi lain (misalnya WhatsApp, email), melalui Web Share API pada PWA atau lembar berbagi Android pada APK_Android.
- **Umur**: Atribut opsional Data_Pasien berupa bilangan bulat 0 sampai 150 yang menyatakan umur Pasien dalam tahun sesuai isian Pengguna, atau kosong. Dalam dokumen ini Data_Pasien berisi nama, Umur, Jenis_Kelamin, alamat, dan nomor HP.
- **Jenis_Kelamin**: Atribut opsional Data_Pasien yang bernilai tepat salah satu dari "Laki-laki" atau "Wanita", atau kosong. Pengodean nilai di Penyimpanan_Data dan File_Cadangan ditetapkan di dokumen desain.
- **Diagnosa**: Atribut Sesi_Terapi yang di Spesifikasi_Dasar disebut "pola penyakit". Dalam dokumen ini hanya label tampilannya yang menjadi "Diagnosa"; nama atribut dan nilai yang tersimpan tidak berubah.
- **Kontak_Perangkat**: Entri buku kontak di perangkat Pengguna yang berisi nama dan satu atau lebih nomor telepon.
- **Pemilih_Kontak**: Antarmuka bawaan sistem untuk memilih satu Kontak_Perangkat, yaitu melalui plugin kontak pada APK_Android atau Contact Picker API pada PWA.
- **Normalisasi_Nomor**: Aturan pengubahan nomor telepon dari Kontak_Perangkat dengan menghapus seluruh spasi, tanda "-", tanda ".", tanda "(" dan ")", serta mempertahankan seluruh karakter lain termasuk awalan "+62", "62", atau "0".
- **Nomor_WhatsApp**: Nomor HP Data_Pasien dalam format internasional tanpa "+", yaitu awalan "0" diganti "62" (contoh "081234567890" menjadi "6281234567890"), awalan "+62" diganti "62", dan awalan "62" tidak diubah.
- **Tautan_WhatsApp**: Alamat "https://wa.me/{Nomor_WhatsApp}" yang membuka chat WhatsApp dengan nomor tersebut.
- **Halaman_Jadwal**: Halaman "Jadwal" yang menampilkan daftar Jadwal_Kunjungan per tanggal (Requirement 8 Spesifikasi_Dasar).
- **Formulir_Jadwal**: Formulir tambah dan ubah Jadwal_Kunjungan dalam dialog, berisi isian "Pasien" untuk memilih Pasien.

## Requirements


### Requirement 1: Informasi Pasien pada Formulir Sesi Terapi

**User Story:** Sebagai Pengguna, saya ingin melihat data pasien di formulir sesi terapi, sehingga saya yakin sesi dicatat untuk pasien yang benar.

#### Acceptance Criteria

1. WHEN Pengguna membuka Formulir_Sesi dalam mode tambah maupun ubah, THE Modul_Terapi SHALL menampilkan nama, Umur, Jenis_Kelamin, alamat, dan nomor HP dari Data_Pasien pemilik Sesi_Terapi, masing-masing dengan label "Nama", "Umur", "Jenis Kelamin", "Alamat", dan "Nomor HP", dengan Umur ditampilkan dalam format "N tahun" (contoh "35 tahun"), di bagian atas Formulir_Sesi sebelum isian tanggal terapi, dengan nilai sama persis karakter demi karakter dengan Data_Pasien yang tersimpan saat Formulir_Sesi dibuka.
2. IF alamat, Umur, atau Jenis_Kelamin Data_Pasien kosong, THEN THE Modul_Terapi SHALL tetap menampilkan label isian tersebut dan menampilkan tanda "-" pada posisi nilainya di Formulir_Sesi.
3. WHEN Pengguna mengirim Formulir_Sesi yang lolos validasi Requirement 5 Spesifikasi_Dasar, THE Modul_Terapi SHALL menyimpan Sesi_Terapi dengan atribut sesuai Requirement 5 dan Requirement 6 Spesifikasi_Dasar yang terhubung dengan Data_Pasien yang ditampilkan di Formulir_Sesi, dan mempertahankan identitas unik, nama, Umur, Jenis_Kelamin, alamat, dan nomor HP Data_Pasien tersebut tanpa perubahan.
4. IF Data_Pasien pemilik Sesi_Terapi tidak ditemukan saat Formulir_Sesi dibuka, THEN THE Modul_Terapi SHALL menampilkan pesan "Data pasien tidak ditemukan" beserta aksi tutup, tidak menampilkan isian Formulir_Sesi, dan tidak membuat atau mengubah Sesi_Terapi maupun Foto_Sesi apa pun.
5. THE Modul_Terapi SHALL menampilkan informasi Data_Pasien pada Formulir_Sesi sebagai teks baca-saja yang tidak dapat difokuskan atau diubah sebagai isian formulir, dan menampilkan nama hingga 100 karakter dan alamat hingga 255 karakter secara utuh dengan pindah baris, tanpa terpotong dan tanpa melewati lebar Formulir_Sesi pada lebar layar 320 piksel atau lebih.
6. IF Data_Pasien pemilik Sesi_Terapi sudah tidak tersimpan saat Pengguna mengirim Formulir_Sesi, THEN THE Modul_Terapi SHALL tidak menyimpan Sesi_Terapi maupun Foto_Sesi apa pun dari pengiriman tersebut dan menampilkan pesan "Data pasien tidak ditemukan".

### Requirement 2: Menambahkan Foto pada Sesi Terapi

**User Story:** Sebagai Pengguna, saya ingin melampirkan beberapa foto pada sesi terapi, sehingga kondisi pasien sebelum dan sesudah terapi terdokumentasi.

#### Acceptance Criteria

1. THE Modul_Foto SHALL menyediakan pada Formulir_Sesi (mode tambah dan ubah) aksi "Tambah foto" yang memungkinkan Pengguna memilih satu atau lebih file gambar dari galeri/penyimpanan file perangkat dalam satu kali pemilihan.
2. WHERE perangkat memiliki kamera, THE Modul_Foto SHALL menyediakan pada Formulir_Sesi (mode tambah dan ubah) aksi "Ambil foto" untuk mengambil satu foto langsung dengan kamera perangkat sebagai Sumber_Foto setiap kali aksi dipilih.
3. WHEN Pengguna memilih atau mengambil gambar ber-Format_Foto_Didukung selain HEIC/HEIF dengan ukuran tidak melebihi Batas_Ukuran_Sumber, THE Modul_Foto SHALL mengonversi gambar di perangkat ke Format_Foto_Simpan dan mengecilkannya sehingga sisi terpanjangnya tidak melebihi Batas_Dimensi_Foto dengan rasio lebar dan tinggi dipertahankan (selisih pembulatan paling banyak 1 piksel pada sisi terpendek), lalu menampilkan Thumbnail gambar tersebut di Formulir_Sesi dalam waktu paling lama 3 detik per gambar, diukur sejak gambar diterima Modul_Foto hingga Thumbnail tampil.
4. IF sisi terpanjang gambar sumber sudah tidak melebihi Batas_Dimensi_Foto, THEN THE Modul_Foto SHALL menyimpan Foto_Sesi dengan lebar dan tinggi yang sama dengan gambar sumber tanpa memperbesarnya.
5. IF gambar sumber memiliki informasi orientasi EXIF, THEN THE Modul_Foto SHALL menyimpan dan menampilkan Foto_Sesi dengan orientasi tampilan yang sama seperti yang terlihat di galeri perangkat, dengan lebar dan tinggi Foto_Sesi yang dicatat sesuai orientasi tampilan tersebut.
6. IF file yang dipilih bukan Format_Foto_Didukung, tidak dapat dibaca sebagai gambar, atau gagal dikonversi ke Format_Foto_Simpan atau dikecilkan, THEN THE Modul_Foto SHALL menolak file tersebut tanpa menambahkan Thumbnail, menampilkan pesan yang menyebutkan nama file dan alasan "format gambar tidak didukung", dan tetap menerima file lain yang valid dalam pemilihan yang sama.
7. IF ukuran file yang dipilih melebihi Batas_Ukuran_Sumber, THEN THE Modul_Foto SHALL menolak file tersebut tanpa menambahkan Thumbnail, menampilkan pesan yang menyebutkan nama file dan batas ukuran 20 MB, dan tetap menerima file lain yang valid dalam pemilihan yang sama.
8. IF penambahan gambar akan membuat jumlah Foto_Sesi pada Formulir_Sesi melebihi Batas_Jumlah_Foto, THEN THE Modul_Foto SHALL menerima gambar valid sesuai urutan pemilihan hanya sampai jumlah mencapai Batas_Jumlah_Foto, menolak sisanya, dan menampilkan pesan "Maksimal 10 foto per sesi terapi".
9. WHILE jumlah Foto_Sesi pada Formulir_Sesi sama dengan Batas_Jumlah_Foto, THE Modul_Foto SHALL menonaktifkan aksi "Tambah foto" dan "Ambil foto", dan WHEN jumlah Foto_Sesi turun di bawah Batas_Jumlah_Foto, THE Modul_Foto SHALL mengaktifkan kembali kedua aksi tersebut.
10. WHEN Pengguna memilih hapus pada sebuah Thumbnail di Formulir_Sesi, THE Modul_Foto SHALL menghilangkan Foto_Sesi tersebut dari Formulir_Sesi dan mempertahankan Foto_Sesi lain beserta urutan relatifnya tanpa perubahan.
11. THE Modul_Foto SHALL menampilkan Thumbnail di Formulir_Sesi sesuai urutan ditambahkan, dengan gambar dalam satu pemilihan diurutkan sesuai urutan pemilihan dan foto yang ditambahkan kemudian ditempatkan setelah foto yang sudah ada.
12. WHEN Pengguna mengirim Formulir_Sesi yang lolos validasi Requirement 5 Spesifikasi_Dasar, THE Penyimpanan_Data SHALL menyimpan Sesi_Terapi beserta seluruh Foto_Sesi yang tampil di Formulir_Sesi dalam satu operasi atomik, sehingga Sesi_Terapi dan Foto_Sesi tersimpan bersama atau tidak tersimpan sama sekali.
13. WHEN Pengguna mengirim Formulir_Sesi mode ubah yang lolos validasi, THE Penyimpanan_Data SHALL menghapus Foto_Sesi yang dihilangkan Pengguna, menyimpan Foto_Sesi yang ditambahkan, dan mempertahankan Foto_Sesi lain beserta urutannya tanpa perubahan.
14. WHEN Pengguna membatalkan Formulir_Sesi atau menutupnya dengan Tombol_Kembali, THE Modul_Foto SHALL membuang seluruh penambahan dan penghapusan Foto_Sesi yang belum disimpan, sehingga jumlah, isi, dan urutan Foto_Sesi tersimpan sama dengan sebelum Formulir_Sesi dibuka.
15. IF Validator menolak Formulir_Sesi atau penyimpanan gagal, THEN THE Modul_Foto SHALL mempertahankan seluruh Thumbnail yang tampil di Formulir_Sesi beserta urutannya agar Pengguna dapat mengirim ulang tanpa memilih foto kembali.
16. WHILE Modul_Foto sedang memproses gambar yang dipilih, THE Modul_Foto SHALL menampilkan indikator proses dan menonaktifkan tombol Simpan, aksi "Tambah foto", dan aksi "Ambil foto" pada Formulir_Sesi hingga seluruh gambar dalam pemilihan tersebut selesai diterima atau ditolak.
17. WHILE perangkat tidak terhubung ke internet, THE Modul_Foto SHALL tetap dapat menambah, menampilkan, dan menghapus Foto_Sesi tanpa menampilkan pesan kesalahan koneksi.
18. WHEN Pengguna menutup pemilih file atau kamera tanpa memilih atau mengambil gambar, THE Modul_Foto SHALL kembali ke Formulir_Sesi dengan Thumbnail dan isian lain tanpa perubahan dan tanpa menampilkan pesan kesalahan.
19. IF izin akses kamera ditolak atau kamera gagal dibuka, THEN THE Modul_Foto SHALL menampilkan pesan yang menyatakan kamera tidak dapat digunakan dan menyarankan aksi "Tambah foto" dari galeri, serta mempertahankan seluruh Thumbnail dan isian Formulir_Sesi tanpa perubahan.
20. WHEN Pengguna memilih gambar HEIC/HEIF dengan ukuran tidak melebihi Batas_Ukuran_Sumber, THE Modul_Foto SHALL mengonversi gambar di perangkat ke Format_Foto_Simpan dan mengecilkannya sesuai kriteria 3 pada PWA maupun APK_Android, termasuk pada peramban yang tidak dapat mendekode HEIC/HEIF secara bawaan, lalu menampilkan Thumbnail dalam waktu paling lama 5 detik per gambar, diukur sejak gambar diterima Modul_Foto hingga Thumbnail tampil (batas 5 detik merupakan asumsi).
21. WHEN Pengguna memilih gambar GIF, termasuk GIF beranimasi, THE Modul_Foto SHALL menyimpan hanya frame pertama gambar tersebut sebagai Foto_Sesi.
22. IF gambar sumber memiliki satu atau lebih piksel transparan, THEN THE Modul_Foto SHALL menyimpan Foto_Sesi dalam Format_Foto_Simpan yang mempertahankan transparansi tersebut.
23. WHILE perangkat tidak terhubung ke internet, THE Modul_Foto SHALL mengonversi setiap gambar ber-Format_Foto_Didukung ke Format_Foto_Simpan sepenuhnya di perangkat tanpa mengirim gambar ke luar perangkat.

### Requirement 3: Melihat Foto Sesi Terapi

**User Story:** Sebagai Pengguna, saya ingin melihat foto sesi terapi dalam ukuran besar, sehingga detail kondisi pasien terlihat jelas.

#### Acceptance Criteria

1. WHEN halaman detail Pasien menampilkan Histori_Terapi, THE Modul_Terapi SHALL menampilkan pada setiap Sesi_Terapi yang memiliki Foto_Sesi: Thumbnail seluruh Foto_Sesi miliknya (1 sampai Batas_Jumlah_Foto) sesuai urutan tersimpan, dan jumlah Foto_Sesi dalam format "N foto" (contoh "3 foto").
2. IF sebuah Sesi_Terapi tidak memiliki Foto_Sesi, THEN THE Modul_Terapi SHALL menampilkan Sesi_Terapi tersebut tanpa area Thumbnail, tanpa teks jumlah foto, dan tanpa pesan kesalahan.
3. WHEN Pengguna mengetuk Thumbnail ke-N di Formulir_Sesi atau di Histori_Terapi, THE Modul_Foto SHALL membuka Penampil_Foto dalam waktu paling lama 1 detik dan menampilkan Foto_Sesi ke-N tersebut secara utuh tanpa terpotong dan tanpa perlu digulir, diskalakan dengan rasio lebar dan tinggi dipertahankan sehingga lebar atau tinggi foto sama dengan lebar atau tinggi area tampilan Penampil_Foto, beserta posisi foto dalam format "N / Total", dengan Total adalah jumlah Foto_Sesi yang tampil di tempat Penampil_Foto dibuka (Foto_Sesi pada Formulir_Sesi saat itu, termasuk yang belum disimpan, atau Foto_Sesi tersimpan pada Sesi_Terapi di Histori_Terapi).
4. WHILE Penampil_Foto terbuka dan Total Foto_Sesi lebih dari 1, THE Modul_Foto SHALL menyediakan aksi foto sebelumnya dan foto berikutnya, dengan aksi foto sebelumnya dinonaktifkan pada foto ke-1 dan aksi foto berikutnya dinonaktifkan pada foto ke-Total.
5. WHILE Penampil_Foto terbuka, WHEN Pengguna menekan Tombol_Kembali, tombol tutup, atau tombol Escape, THE Modul_Foto SHALL menutup Penampil_Foto, menampilkan kembali halaman detail Pasien atau Formulir_Sesi tempat Penampil_Foto dibuka dengan isian dan Foto_Sesi yang sama seperti sebelum Penampil_Foto dibuka, dan memindahkan fokus kembali ke Thumbnail yang terakhir ditampilkan di Penampil_Foto.
6. THE Modul_Foto SHALL menyertakan teks alternatif pada setiap Thumbnail dan gambar di Penampil_Foto dengan format "Foto N sesi terapi DD MMMM YYYY", dengan N adalah urutan foto mulai dari 1 dan tanggal adalah tanggal terapi Sesi_Terapi (pada Formulir_Sesi: nilai isian tanggal terapi saat itu), atau format "Foto N sesi terapi" apabila isian tanggal terapi pada Formulir_Sesi kosong.
7. IF Foto_Sesi gagal dimuat dari Penyimpanan_Data, THEN THE Modul_Foto SHALL menampilkan penanda "Foto tidak dapat dimuat" di posisi Thumbnail tersebut dan di Penampil_Foto saat foto tersebut ditampilkan, tetap menampilkan Foto_Sesi lain, data Sesi_Terapi, posisi "N / Total", serta aksi navigasi, dan tidak mengubah atau menghapus rekaman Foto_Sesi tersebut.
8. WHILE Penampil_Foto terbuka dan Total Foto_Sesi lebih dari 1, WHEN Pengguna memilih aksi foto sebelumnya atau foto berikutnya yang aktif, THE Modul_Foto SHALL menampilkan Foto_Sesi ke-(N-1) atau ke-(N+1) sesuai urutan dalam waktu paling lama 1 detik dan memperbarui posisi "N / Total" serta teks alternatif sesuai foto yang ditampilkan.
9. IF Total Foto_Sesi pada Penampil_Foto sama dengan 1, THEN THE Modul_Foto SHALL menampilkan posisi "1 / 1" dan menyembunyikan atau menonaktifkan aksi foto sebelumnya dan foto berikutnya.

### Requirement 4: Penyimpanan dan Penghapusan Foto

**User Story:** Sebagai Pengguna, saya ingin foto tersimpan bersama data sesi dan ikut terhapus saat datanya dihapus, sehingga tidak ada foto yatim yang memenuhi penyimpanan perangkat.

#### Acceptance Criteria

1. THE Penyimpanan_Data SHALL menyimpan setiap Foto_Sesi di penyimpanan lokal perangkat dengan keterhubungan ke tepat satu Sesi_Terapi, dan Foto_Sesi tersebut tetap tersedia setelah Aplikasi ditutup, dibuka kembali, atau perangkat dinyalakan ulang, tanpa memerlukan koneksi internet.
2. THE Penyimpanan_Data SHALL menjamin bahwa untuk setiap Foto_Sesi yang disimpan, memuat kembali Foto_Sesi tersebut menghasilkan isi gambar byte demi byte, jenis gambar, ukuran dalam byte, lebar, tinggi, urutan, waktu ditambahkan, dan keterhubungan Sesi_Terapi yang identik (round-trip).
3. WHEN Pengguna mengonfirmasi penghapusan sebuah Sesi_Terapi, THE Penyimpanan_Data SHALL menghapus Sesi_Terapi beserta seluruh Foto_Sesi miliknya dalam satu operasi atomik, sehingga setelah penghapusan tidak ada Foto_Sesi yang terhubung dengan Sesi_Terapi tersebut dan Foto_Sesi milik Sesi_Terapi lain tetap ada tanpa perubahan.
4. WHEN Pengguna mengonfirmasi penghapusan sebuah Data_Pasien, THE Penyimpanan_Data SHALL menghapus Data_Pasien, seluruh Sesi_Terapi, seluruh Jadwal_Kunjungan, dan seluruh Foto_Sesi milik Sesi_Terapi Pasien tersebut dalam satu operasi atomik, sehingga tidak tersisa Foto_Sesi tanpa Sesi_Terapi dan data Pasien lain tetap ada tanpa perubahan.
5. WHEN Pengguna memilih hapus pada sebuah Sesi_Terapi yang memiliki 1 sampai Batas_Jumlah_Foto Foto_Sesi, THE Modul_Terapi SHALL menyebutkan jumlah Foto_Sesi yang akan ikut terhapus dalam bentuk angka pada dialog konfirmasi penghapusan (Requirement 6.6 Spesifikasi_Dasar); untuk Sesi_Terapi dengan 0 Foto_Sesi, dialog konfirmasi ditampilkan tanpa keterangan jumlah Foto_Sesi.
6. WHEN Pengguna memilih hapus pada sebuah Data_Pasien, THE Modul_Pasien SHALL menyebutkan dalam bentuk angka jumlah total Foto_Sesi dari seluruh Sesi_Terapi milik Pasien tersebut yang akan ikut terhapus pada dialog konfirmasi penghapusan (Requirement 3.1 Spesifikasi_Dasar), termasuk angka 0 jika tidak ada.
7. IF penyimpanan Foto_Sesi gagal karena ruang penyimpanan perangkat penuh atau kesalahan sistem, THEN THE Modul_Terapi SHALL menampilkan pesan yang menyatakan data gagal disimpan, tidak menyimpan Sesi_Terapi maupun Foto_Sesi apa pun dari pengiriman tersebut, menghapus seluruh data gambar dan rekaman Foto_Sesi yang sempat tertulis di penyimpanan lokal selama pengiriman tersebut, mempertahankan Sesi_Terapi dan Foto_Sesi yang tersimpan sebelum pengiriman (pada mode ubah) tanpa perubahan, dan mempertahankan isian Formulir_Sesi termasuk Thumbnail yang tampil.
8. WHEN Aplikasi yang sudah berisi data dari versi sebelum fitur ini dibuka pertama kali setelah pembaruan, THE Penyimpanan_Data SHALL menyelesaikan migrasi struktur penyimpanan sebelum data apa pun ditampilkan, sehingga seluruh Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan tetap ada dengan jumlah rekaman dan nilai atribut yang sama, setiap Sesi_Terapi lama memiliki 0 Foto_Sesi, dan pembukaan Aplikasi berikutnya tidak menjalankan migrasi ulang maupun mengubah data.
9. IF migrasi struktur penyimpanan gagal, THEN THE Aplikasi SHALL menampilkan pesan yang menyatakan data gagal dimuat, mempertahankan data tersimpan sebelum migrasi tanpa menghapus atau menimpanya, dan menjalankan kembali migrasi pada pembukaan Aplikasi berikutnya.
10. IF penghapusan Sesi_Terapi atau Data_Pasien gagal karena kesalahan sistem, THEN THE Penyimpanan_Data SHALL membatalkan seluruh penghapusan dalam operasi tersebut sehingga Data_Pasien, Sesi_Terapi, Jadwal_Kunjungan, dan Foto_Sesi terkait tetap tersimpan tanpa perubahan, dan THE Aplikasi SHALL menampilkan pesan yang menyatakan data gagal dihapus.
11. WHEN Pengguna membatalkan dialog konfirmasi penghapusan Sesi_Terapi atau Data_Pasien, THE Aplikasi SHALL menutup dialog tanpa menghapus Data_Pasien, Sesi_Terapi, Jadwal_Kunjungan, maupun Foto_Sesi apa pun.

### Requirement 5: Isi Laporan Sesi Terapi

**User Story:** Sebagai Pengguna, saya ingin membuat laporan hasil terapi untuk satu sesi, sehingga pasien menerima ringkasan terapi yang dijalaninya.

#### Acceptance Criteria

1. THE Modul_Laporan_Sesi SHALL menyediakan aksi "Buat laporan PDF" pada setiap Sesi_Terapi di Histori_Terapi halaman detail Pasien, termasuk Sesi_Terapi tanpa Foto_Sesi.
2. WHEN Pengguna memilih aksi "Buat laporan PDF", THE Modul_Laporan_Sesi SHALL menampilkan dialog pilihan laporan berisi pilihan "Sertakan biaya" dalam keadaan tidak dipilih, pilihan "Sertakan foto" dalam keadaan dipilih apabila Sesi_Terapi memiliki 1 atau lebih Foto_Sesi, tanpa pilihan "Sertakan foto" apabila Sesi_Terapi memiliki 0 Foto_Sesi, serta aksi konfirmasi dan aksi batal.
3. WHEN Pengguna mengonfirmasi dialog pilihan laporan, THE Modul_Laporan_Sesi SHALL menyusun Laporan_Sesi yang memuat, secara berurutan: Kop_Laporan, judul "Laporan Hasil Terapi", bagian Data Pasien berisi pasangan label dan nilai untuk nama, Umur (format "N tahun"), Jenis_Kelamin (label "Jenis Kelamin"), alamat, dan nomor HP, serta bagian Sesi Terapi berisi pasangan label dan nilai untuk tanggal terapi, keluhan, Diagnosa (label "Diagnosa"), terapi yang diberikan, dan hasil terapi.
4. WHEN Pengguna mengonfirmasi dialog pilihan laporan dengan pilihan "Sertakan biaya" dipilih, THE Modul_Laporan_Sesi SHALL menampilkan biaya Sesi_Terapi dalam Format_Rupiah sebagai baris terakhir bagian Sesi Terapi, termasuk biaya bernilai 0; apabila pilihan tersebut tidak dipilih, THE Modul_Laporan_Sesi SHALL tidak menampilkan label maupun nilai biaya di mana pun pada Laporan_Sesi.
5. WHEN Pengguna mengonfirmasi dialog pilihan laporan dengan pilihan "Sertakan foto" dipilih, THE Modul_Laporan_Sesi SHALL menampilkan seluruh Foto_Sesi milik Sesi_Terapi sesuai urutan tersimpan dalam bagian "Dokumentasi Foto" setelah bagian Sesi Terapi, dengan setiap foto diperkecil bila lebar atau tingginya melebihi area di dalam margin halaman, tidak diperbesar melebihi ukuran asli, dan rasio lebar dan tinggi dipertahankan; apabila pilihan tersebut tidak dipilih atau tidak ditampilkan, THE Modul_Laporan_Sesi SHALL tidak menampilkan bagian "Dokumentasi Foto".
6. THE Modul_Laporan_Sesi SHALL menampilkan nilai setiap isian teks Laporan_Sesi sama persis dengan nilai tersimpan pada Data_Pasien dan Sesi_Terapi saat penyusunan dimulai, termasuk karakter non-ASCII dan baris baru, tanpa karakter yang hilang, diganti, atau ditambahkan, kecuali karakter yang tidak didukung font sesuai Requirement 6.11.
7. IF Umur, Jenis_Kelamin, alamat, Diagnosa, atau hasil terapi kosong, THEN THE Modul_Laporan_Sesi SHALL menampilkan tanda "-" pada posisi nilai tersebut di Laporan_Sesi dan tetap menampilkan labelnya.
8. THE Modul_Laporan_Sesi SHALL menampilkan tanggal terapi pada Laporan_Sesi dalam format "DD MMMM YYYY" dengan nama bulan Bahasa Indonesia sesuai Requirement 12 Spesifikasi_Dasar, contoh "05 Januari 2025".
9. THE Modul_Laporan_Sesi SHALL menampilkan di bagian bawah setiap halaman Laporan_Sesi tanggal pembuatan laporan menurut tanggal perangkat Pengguna saat penyusunan dimulai dalam format "DD MMMM YYYY", dan nomor halaman dalam format "Halaman N dari Total" dengan N dimulai dari 1 dan Total sama dengan jumlah halaman file PDF.
10. WHEN teks sebuah isian melebihi sisa ruang di dalam margin halaman, THE Modul_Laporan_Sesi SHALL melanjutkan sisa teks ke halaman berikutnya pada batas baris, tanpa ada baris teks yang terbelah antarhalaman, terpotong, tumpang tindih dengan elemen lain, atau keluar dari batas margin halaman.
11. WHILE perangkat tidak terhubung ke internet, THE Modul_Laporan_Sesi SHALL menyusun Laporan_Sesi sepenuhnya di perangkat tanpa menampilkan pesan kesalahan koneksi dan tanpa mengirim data apa pun ke luar perangkat.
12. WHEN Pengguna mengonfirmasi dialog pilihan laporan untuk Sesi_Terapi dengan 10 Foto_Sesi, pilihan "Sertakan foto" dan "Sertakan biaya" dipilih, serta keluhan, Diagnosa, terapi yang diberikan, dan hasil terapi masing-masing 1000 karakter, THE Modul_Laporan_Sesi SHALL menyelesaikan penyusunan Laporan_Sesi dan menampilkan pratinjau (Requirement 8.1) dalam waktu paling lama 10 detik sejak konfirmasi.
13. IF penyusunan Laporan_Sesi gagal, THEN THE Modul_Laporan_Sesi SHALL menghentikan penyusunan, menampilkan pesan "Laporan gagal dibuat, silakan coba lagi", menampilkan kembali halaman detail Pasien, tidak menyimpan atau membagikan file PDF apa pun, dan mempertahankan Data_Pasien, Sesi_Terapi, dan Foto_Sesi tanpa perubahan.
14. WHEN Pengguna memilih aksi batal atau menekan Tombol_Kembali pada dialog pilihan laporan, THE Modul_Laporan_Sesi SHALL menutup dialog tanpa menyusun Laporan_Sesi dan menampilkan kembali halaman detail Pasien tanpa mengubah data apa pun.
15. WHILE Modul_Laporan_Sesi sedang menyusun Laporan_Sesi, THE Modul_Laporan_Sesi SHALL menampilkan indikator proses dan menonaktifkan aksi konfirmasi dialog pilihan laporan serta aksi "Buat laporan PDF", sehingga satu konfirmasi menghasilkan tepat satu Laporan_Sesi.
16. IF satu atau lebih Foto_Sesi gagal dimuat dari Penyimpanan_Data saat menyusun Laporan_Sesi dengan pilihan "Sertakan foto" dipilih, THEN THE Modul_Laporan_Sesi SHALL menampilkan penanda "Foto tidak dapat dimuat" pada posisi foto tersebut di bagian "Dokumentasi Foto" dan tetap menyusun Laporan_Sesi dengan seluruh isi dan Foto_Sesi lainnya.

### Requirement 6: Tampilan Laporan Sesi

**User Story:** Sebagai Pengguna, saya ingin laporan PDF tampil rapi dan menarik, sehingga laporan layak dikirim ke pasien dan mencerminkan profesionalitas praktik.

#### Acceptance Criteria

1. THE Modul_Laporan_Sesi SHALL menyusun setiap halaman Laporan_Sesi berukuran kertas A4 tegak (210 x 297 mm) dengan margin minimal 15 mm di setiap sisi, dan seluruh teks, garis, blok warna, Foto_Sesi, serta bagian bawah halaman (tanggal pembuatan dan nomor halaman) berada di dalam margin tersebut.
2. THE Modul_Laporan_Sesi SHALL menampilkan Kop_Laporan hanya pada halaman pertama, berisi Logo_Praktik di sebelah kiri Nama_Praktik apabila Logo_Praktik tersimpan (Requirement 10), Nama_Praktik dengan ukuran huruf terbesar di antara seluruh teks pada halaman tersebut, diikuti baris alamat praktik dan baris nomor HP praktik hanya apabila masing-masing terisi, serta dipisahkan dari isi laporan dengan garis atau blok warna aksen selebar area di antara margin kiri dan kanan.
3. THE Modul_Laporan_Sesi SHALL menampilkan judul setiap bagian Laporan_Sesi (Data Pasien, Sesi Terapi, Dokumentasi Foto) dengan ukuran huruf minimal 2 pt lebih besar daripada teks isi atau dengan huruf tebal, sehingga judul bagian berbeda secara visual dari isi bagian tersebut.
4. THE Modul_Laporan_Sesi SHALL menampilkan isian pada bagian Data Pasien dan Sesi Terapi sebagai pasangan label dan nilai, dengan seluruh label dalam satu bagian rata kiri pada posisi horizontal yang sama, seluruh nilai dalam satu bagian dimulai pada posisi horizontal yang sama, dan baris lanjutan dari nilai yang lebih dari satu baris (termasuk baris baru) dimulai pada posisi horizontal yang sama dengan baris pertama nilai tersebut.
5. THE Modul_Laporan_Sesi SHALL menggunakan rasio kontras minimal 4,5:1 antara warna teks dan warna latar tepat di belakangnya pada seluruh teks Laporan_Sesi, termasuk teks di atas blok warna aksen.
6. WHERE pilihan "Sertakan foto" dipilih, THE Modul_Laporan_Sesi SHALL menyusun Foto_Sesi dalam grid dua kolom sesuai urutan tersimpan (dari kiri ke kanan, lalu baris berikutnya), dengan setiap foto berada utuh dalam satu halaman tanpa terpotong atau tumpang tindih dengan foto lain maupun bagian bawah halaman, dan foto terakhir pada jumlah Foto_Sesi ganjil ditempatkan di kolom kiri.
7. THE Modul_Laporan_Sesi SHALL menyematkan font yang mendukung seluruh huruf Latin, angka, tanda baca, dan huruf Latin beraksen pada teks Laporan_Sesi di dalam file PDF, sehingga Laporan_Sesi menampilkan teks yang sama ketika dibuka di penampil PDF yang berbeda.
8. IF Pengaturan_Laporan belum pernah diisi atau Nama_Praktik yang tersimpan kosong, THEN THE Modul_Laporan_Sesi SHALL menggunakan Nama_Praktik "Data Pasien" dan tidak menampilkan Logo_Praktik, baris alamat praktik, maupun baris nomor HP praktik pada Kop_Laporan.
9. THE Modul_Laporan_Sesi SHALL menggunakan ukuran huruf minimal 10 pt untuk label dan nilai isian Laporan_Sesi, dan minimal 8 pt untuk tanggal pembuatan dan nomor halaman di bagian bawah halaman.
10. IF Nama_Praktik atau alamat praktik melebihi lebar area di antara margin kiri dan kanan, THEN THE Modul_Laporan_Sesi SHALL membungkus teks tersebut ke baris berikutnya di dalam Kop_Laporan tanpa memotong, menyingkat, atau menghilangkan karakter apa pun.
11. IF teks Laporan_Sesi memuat karakter yang tidak didukung oleh font yang disematkan (misalnya emoji), THEN THE Modul_Laporan_Sesi SHALL tetap menyelesaikan penyusunan Laporan_Sesi, menampilkan seluruh karakter lain pada isian tersebut tanpa perubahan, dan menampilkan satu karakter pengganti yang sama pada setiap posisi karakter yang tidak didukung.

### Requirement 7: Pengaturan Kop Laporan

**User Story:** Sebagai pemilik praktik, saya ingin mengatur nama dan kontak praktik pada kop laporan, sehingga laporan yang diterima pasien menampilkan identitas praktik saya.

#### Acceptance Criteria

1. THE Aplikasi SHALL menyediakan di Halaman_Pengaturan formulir Pengaturan_Laporan berisi isian Nama_Praktik (wajib), alamat praktik (opsional), nomor HP praktik (opsional), dan Logo_Praktik (opsional, Requirement 10), beserta tombol Simpan dan Batal.
2. WHEN Pengguna mengirim formulir Pengaturan_Laporan dengan Nama_Praktik 1-100 karakter, alamat praktik 0-255 karakter, dan nomor HP praktik yang kosong atau merupakan Nomor_HP_Valid, dihitung setelah spasi di awal dan akhir setiap isian dihapus, THE Penyimpanan_Data SHALL menyimpan nilai ketiga isian yang telah dihapus spasi awal dan akhirnya sebagai Pengaturan_Laporan di perangkat, menggantikan Pengaturan_Laporan sebelumnya, sehingga nilai tersebut tetap ada setelah Aplikasi ditutup dan dibuka kembali, dan THE Aplikasi SHALL menampilkan pesan bahwa pengaturan berhasil disimpan.
3. IF Nama_Praktik kosong atau hanya berisi spasi, Nama_Praktik melebihi 100 karakter, alamat praktik melebihi 255 karakter, atau nomor HP praktik terisi tetapi bukan Nomor_HP_Valid, dihitung setelah spasi di awal dan akhir dihapus, THEN THE Validator SHALL menolak penyimpanan, menampilkan pesan kesalahan di samping setiap isian yang tidak valid yang menyebutkan aturan yang dilanggar, mempertahankan nilai seluruh isian formulir sebagaimana diketik Pengguna, dan mempertahankan Pengaturan_Laporan tersimpan tanpa perubahan.
4. WHEN Pengaturan_Laporan berhasil disimpan, THE Modul_Laporan_Sesi SHALL menggunakan nilai Pengaturan_Laporan terbaru pada Kop_Laporan setiap Laporan_Sesi yang disusun setelahnya tanpa memerlukan Aplikasi dibuka ulang, dan file Laporan_Sesi yang sudah disimpan atau dibagikan sebelumnya tidak berubah.
5. WHEN Pengguna membuka formulir Pengaturan_Laporan, THE Aplikasi SHALL mengisi setiap isian dengan nilai Pengaturan_Laporan tersimpan, atau dengan Nama_Praktik "Data Pasien" serta alamat praktik dan nomor HP praktik kosong apabila Pengaturan_Laporan belum pernah disimpan.
6. WHEN Pengguna memilih Batal atau menekan Tombol_Kembali pada formulir Pengaturan_Laporan, THE Aplikasi SHALL menutup formulir tanpa menyimpan perubahan apa pun, termasuk penambahan, penggantian, atau penghapusan Logo_Praktik, dan mempertahankan Pengaturan_Laporan tersimpan tanpa perubahan.
7. IF penyimpanan Pengaturan_Laporan gagal karena ruang penyimpanan perangkat penuh atau kesalahan sistem, THEN THE Aplikasi SHALL menampilkan pesan yang menyatakan pengaturan gagal disimpan, mempertahankan Pengaturan_Laporan sebelumnya tanpa perubahan, dan mempertahankan isian formulir agar Pengguna dapat mencoba lagi.
8. THE Aplikasi SHALL menyediakan menu "Pengaturan" pada Navigasi_Utama sehingga Halaman_Pengaturan dapat dibuka dari navigasi utama.
9. WHEN Pengguna memilih menu "Pengaturan" pada Navigasi_Utama, THE Aplikasi SHALL menampilkan Halaman_Pengaturan yang memuat formulir Pengaturan_Laporan dengan nilai sesuai kriteria 5.
10. WHEN Pengguna mengirim formulir Pengaturan_Laporan yang lolos validasi kriteria 2, THE Penyimpanan_Data SHALL menyimpan Nama_Praktik, alamat praktik, nomor HP praktik, dan perubahan Logo_Praktik (penambahan, penggantian, atau penghapusan) bersama-sama dalam satu operasi atomik.

### Requirement 8: Menyimpan dan Membagikan Laporan Sesi

**User Story:** Sebagai Pengguna, saya ingin menyimpan atau langsung mengirim laporan PDF ke pasien, sehingga pasien dapat menerima laporan melalui WhatsApp atau aplikasi lain.

#### Acceptance Criteria

1. WHEN Laporan_Sesi selesai disusun, THE Modul_Laporan_Sesi SHALL menampilkan dalam waktu paling lama 1 detik tampilan pratinjau yang memuat Nama_File_Laporan, nama Pasien, tanggal terapi dalam format "DD MMMM YYYY", jumlah halaman Laporan_Sesi, serta aksi "Simpan PDF" dan "Bagikan".
2. THE Modul_Laporan_Sesi SHALL memberi nama file Laporan_Sesi sesuai Nama_File_Laporan, dengan YYYYMMDD diambil dari tanggal terapi Sesi_Terapi (bukan tanggal pembuatan laporan), contoh "laporan-terapi-siti-aminah-20250105.pdf" untuk Pasien "Siti Aminah" dengan tanggal terapi 5 Januari 2025.
3. IF nama Pasien tidak menghasilkan satu pun huruf a-z atau angka 0-9 setelah diubah sesuai aturan Nama_File_Laporan, THEN THE Modul_Laporan_Sesi SHALL menggunakan "pasien" sebagai bagian {nama} pada Nama_File_Laporan.
4. WHEN Pengguna memilih "Simpan PDF" pada PWA, THE Modul_Laporan_Sesi SHALL mengunduh Laporan_Sesi melalui mekanisme unduhan peramban dengan Nama_File_Laporan dan tetap menampilkan tampilan pratinjau setelah unduhan dimulai.
5. WHEN Pengguna memilih "Simpan PDF" pada APK_Android, THE Modul_Laporan_Sesi SHALL menyimpan Laporan_Sesi ke folder Documents perangkat dengan Nama_File_Laporan (atau nama dengan akhiran sesuai kriteria 6) dan menampilkan pesan berhasil yang menyebutkan nama file sebenarnya dan folder Documents sebagai lokasi penyimpanan.
6. IF file dengan Nama_File_Laporan yang sama sudah ada di folder Documents pada APK_Android, THEN THE Modul_Laporan_Sesi SHALL menyimpan Laporan_Sesi dengan akhiran "-N" sebelum ekstensi ".pdf", dengan N adalah bilangan bulat terkecil mulai dari 2 yang belum dipakai oleh file lain di folder tersebut, tanpa menimpa file yang sudah ada, contoh "laporan-terapi-siti-aminah-20250105-2.pdf".
7. WHEN Pengguna memilih "Bagikan" dan Fitur_Berbagi tersedia untuk file PDF, THE Modul_Laporan_Sesi SHALL membuka Fitur_Berbagi dalam waktu paling lama 2 detik dengan Laporan_Sesi sebagai lampiran ber-Nama_File_Laporan dan judul "Laporan Hasil Terapi - {nama Pasien}", dengan {nama Pasien} sama persis dengan nama tersimpan pada Data_Pasien.
8. IF Fitur_Berbagi untuk file PDF tidak tersedia di perangkat atau peramban, THEN THE Modul_Laporan_Sesi SHALL menonaktifkan aksi "Bagikan" dan menampilkan keterangan pada tampilan pratinjau bahwa laporan dapat disimpan dengan "Simpan PDF" lalu dikirim secara manual.
9. WHEN Pengguna menutup Fitur_Berbagi tanpa memilih aplikasi tujuan, THE Modul_Laporan_Sesi SHALL kembali ke tampilan pratinjau dengan aksi "Simpan PDF" dan "Bagikan" tetap aktif, tanpa menampilkan pesan kesalahan.
10. IF penyimpanan atau pembagian Laporan_Sesi gagal karena kesalahan sistem, ruang penyimpanan perangkat penuh, atau izin akses penyimpanan ditolak, THEN THE Modul_Laporan_Sesi SHALL menampilkan pesan kesalahan yang menyatakan laporan gagal disimpan atau dibagikan, tidak meninggalkan file Laporan_Sesi yang tidak lengkap di folder Documents, tetap menampilkan tampilan pratinjau dengan aksi "Simpan PDF" dan "Bagikan" aktif agar Pengguna dapat mencoba lagi, dan mempertahankan Data_Pasien, Sesi_Terapi, dan Foto_Sesi tanpa perubahan.
11. WHILE tampilan pratinjau Laporan_Sesi terbuka, WHEN Pengguna menekan Tombol_Kembali atau tombol tutup pratinjau, THE Modul_Laporan_Sesi SHALL menutup pratinjau dan menampilkan halaman detail Pasien pemilik Sesi_Terapi tanpa mengubah data apa pun.
12. WHILE Modul_Laporan_Sesi sedang menyimpan Laporan_Sesi atau membuka Fitur_Berbagi, THE Modul_Laporan_Sesi SHALL menampilkan indikator proses dan menonaktifkan aksi "Simpan PDF" dan "Bagikan" sampai proses selesai atau gagal.
13. WHEN tampilan pratinjau Laporan_Sesi ditutup, THE Modul_Laporan_Sesi SHALL membuang Laporan_Sesi yang telah disusun tanpa menyimpannya di Penyimpanan_Data, sehingga Laporan_Sesi untuk Sesi_Terapi yang sama hanya dapat diperoleh kembali dengan memilih aksi "Buat laporan PDF" lagi.
14. WHILE perangkat tidak terhubung ke internet, THE Modul_Laporan_Sesi SHALL tetap dapat menjalankan aksi "Simpan PDF" pada PWA dan APK_Android tanpa menampilkan pesan kesalahan koneksi.

### Requirement 9: Cadangan dan Pemulihan Tanpa Foto

**User Story:** Sebagai Pengguna, saya ingin cadangan data tetap ringkas tanpa foto dan pemulihan tidak meninggalkan foto yatim, sehingga File_Cadangan mudah dipindahkan dan penyimpanan perangkat tetap rapi.

#### Acceptance Criteria

1. WHEN Pengguna memilih ekspor data, THE Modul_Cadangan SHALL membuat tepat satu File_Cadangan dengan versi format 1 sesuai Requirement 14.1 Spesifikasi_Dasar, berisi Data_Pasien (termasuk Umur dan Jenis_Kelamin sesuai kriteria 11), Sesi_Terapi, dan Jadwal_Kunjungan, tanpa data gambar maupun atribut Foto_Sesi, Pengaturan_Laporan, maupun Logo_Praktik, dan tanpa mengubah Foto_Sesi maupun Pengaturan_Laporan yang tersimpan.
2. WHEN ekspor data berhasil, THE Modul_Cadangan SHALL menampilkan pesan berhasil sesuai Requirement 14.1 Spesifikasi_Dasar yang juga menyatakan bahwa Foto_Sesi tidak disertakan dalam File_Cadangan, termasuk ketika jumlah Foto_Sesi tersimpan adalah 0.
3. WHEN Pengguna memilih File_Cadangan yang lolos pemeriksaan Requirement 14.6 Spesifikasi_Dasar, THE Modul_Cadangan SHALL menampilkan dialog konfirmasi impor sesuai Requirement 14.3 Spesifikasi_Dasar yang juga menyatakan bahwa Foto_Sesi tidak disertakan dalam File_Cadangan, tanpa mengubah Foto_Sesi tersimpan sebelum Pengguna mengonfirmasi.
4. WHEN Pengguna mengonfirmasi impor File_Cadangan, THE Modul_Cadangan SHALL mengganti seluruh Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan sesuai Requirement 14.4 Spesifikasi_Dasar dan, dalam operasi atomik yang sama, menghapus rekaman beserta data gambar setiap Foto_Sesi tersimpan yang identitas Sesi_Terapi-nya tidak ada di dalam File_Cadangan, sehingga setelah impor jumlah Foto_Sesi tanpa Sesi_Terapi adalah 0.
5. WHEN Pengguna mengonfirmasi impor File_Cadangan yang memuat Sesi_Terapi dengan identitas unik yang sama dengan Sesi_Terapi tersimpan, THE Modul_Cadangan SHALL mempertahankan Foto_Sesi milik Sesi_Terapi tersebut beserta isi gambar byte demi byte, jumlah, urutan, dan atributnya tanpa perubahan, dan tetap menghubungkannya dengan Sesi_Terapi hasil impor yang memiliki identitas unik tersebut (asumsi).
6. WHEN Pengguna mengonfirmasi impor File_Cadangan, THE Modul_Cadangan SHALL mempertahankan Pengaturan_Laporan (Nama_Praktik, alamat praktik, nomor HP praktik, dan Logo_Praktik) tanpa perubahan.
7. IF penulisan data hasil impor oleh Penyimpanan_Data gagal, THEN THE Modul_Cadangan SHALL menampilkan pesan kesalahan yang menyatakan impor gagal, dan THE Penyimpanan_Data SHALL mempertahankan seluruh Data_Pasien, Sesi_Terapi, Jadwal_Kunjungan, Foto_Sesi (termasuk Foto_Sesi yang seharusnya dihapus menurut kriteria 4), dan Pengaturan_Laporan dalam keadaan sebelum impor dimulai, tanpa menyimpan atau menghapus sebagian data.
8. IF File_Cadangan memiliki versi format selain 1, THEN THE Modul_Cadangan SHALL menolak impor sebelum dialog konfirmasi ditampilkan sesuai Requirement 14.6 Spesifikasi_Dasar, menampilkan pesan yang menyatakan versi format tidak didukung, dan mempertahankan seluruh data tersimpan, termasuk Foto_Sesi dan Pengaturan_Laporan, tanpa perubahan.
9. THE Modul_Cadangan SHALL menjamin bahwa untuk setiap kumpulan Data_Pasien, Sesi_Terapi, Jadwal_Kunjungan, dan Foto_Sesi tersimpan yang lolos aturan Validator, mengekspor ke File_Cadangan lalu mengimpornya kembali tanpa perubahan data lain di antara ekspor dan impor menghasilkan Data_Pasien, Sesi_Terapi, Jadwal_Kunjungan, dan Foto_Sesi dengan jumlah, identitas unik, keterhubungan, dan nilai setiap atribut (termasuk Umur dan Jenis_Kelamin Data_Pasien, Diagnosa Sesi_Terapi, dan isi gambar Foto_Sesi byte demi byte) yang identik dengan sebelum ekspor (round-trip).
10. IF Pengguna membatalkan dialog konfirmasi impor, menutup pemilihan file impor tanpa memilih file, atau File_Cadangan ditolak oleh pemeriksaan Requirement 14.6 Spesifikasi_Dasar, THEN THE Modul_Cadangan SHALL mempertahankan seluruh Foto_Sesi dan Pengaturan_Laporan tersimpan tanpa perubahan jumlah, isi, urutan, maupun atribut.
11. WHEN Pengguna memilih ekspor data, THE Modul_Cadangan SHALL menuliskan pada setiap rekaman Data_Pasien di File_Cadangan atribut `umur` dan `jenisKelamin` dengan nilai Umur dan Jenis_Kelamin tersimpan, termasuk nilai kosong, tanpa mengubah versi format 1.
12. WHEN Pengguna memilih File_Cadangan untuk diimpor yang memuat rekaman Data_Pasien tanpa atribut `umur` atau `jenisKelamin`, THE Modul_Cadangan SHALL menerima rekaman tersebut dan memperlakukan atribut yang tidak ada sebagai Umur kosong atau Jenis_Kelamin kosong.
13. IF File_Cadangan yang dipilih untuk diimpor memuat rekaman Data_Pasien dengan `umur` terisi yang bukan bilangan bulat atau berada di luar rentang 0 sampai 150, atau dengan `jenisKelamin` terisi yang bukan salah satu nilai Jenis_Kelamin yang sah, THEN THE Modul_Cadangan SHALL menolak impor sebelum dialog konfirmasi ditampilkan sesuai Requirement 14.6 Spesifikasi_Dasar, menampilkan pesan kesalahan yang menyebutkan atribut yang tidak valid sebagai alasan penolakan, dan mempertahankan seluruh data tersimpan tanpa perubahan.
14. THE Modul_Cadangan SHALL membaca atribut Diagnosa Sesi_Terapi dari dan menuliskannya ke File_Cadangan dengan nama atribut yang sama seperti sebelum label "Diagnosa" diterapkan, sehingga File_Cadangan yang dibuat sebelum dan sesudah fitur ini saling dapat diimpor.

### Requirement 10: Logo Praktik

**User Story:** Sebagai pemilik praktik, saya ingin mengunggah logo klinik untuk kop laporan, sehingga laporan yang diterima pasien menampilkan identitas visual praktik saya.

#### Acceptance Criteria

1. WHILE formulir Pengaturan_Laporan di Halaman_Pengaturan tidak menampilkan pratinjau Logo_Praktik, THE Modul_Pengaturan SHALL menyediakan aksi "Pilih logo" untuk memilih tepat satu file gambar dari galeri/penyimpanan file perangkat sebagai Logo_Praktik.
2. WHEN Pengguna memilih gambar ber-Format_Foto_Didukung dengan ukuran tidak melebihi Batas_Ukuran_Logo sebagai Logo_Praktik, THE Modul_Pengaturan SHALL mengonversi gambar di perangkat ke Format_Foto_Simpan dan mengecilkannya sehingga sisi terpanjangnya tidak melebihi Batas_Dimensi_Logo dengan rasio lebar dan tinggi dipertahankan (selisih pembulatan paling banyak 1 piksel pada sisi terpendek), tanpa memperbesar gambar yang sisi terpanjangnya sudah tidak melebihi Batas_Dimensi_Logo, dengan orientasi tampilan sesuai informasi orientasi EXIF dan hanya frame pertama untuk GIF, lalu menampilkan pratinjau dalam waktu paling lama 3 detik, atau 5 detik untuk HEIC/HEIF, diukur sejak gambar diterima Modul_Pengaturan hingga pratinjau tampil.
3. IF gambar sumber Logo_Praktik memiliki satu atau lebih piksel transparan, THEN THE Modul_Pengaturan SHALL menyimpan Logo_Praktik dalam Format_Foto_Simpan yang mempertahankan transparansi tersebut (PNG).
4. WHEN Logo_Praktik selesai diproses atau Halaman_Pengaturan dibuka dengan Logo_Praktik tersimpan, THE Modul_Pengaturan SHALL menampilkan pada formulir Pengaturan_Laporan pratinjau Logo_Praktik secara utuh tanpa terpotong dengan rasio lebar dan tinggi dipertahankan, dengan teks alternatif "Logo praktik", beserta aksi "Ganti logo" dan "Hapus logo" sebagai pengganti aksi "Pilih logo".
5. WHEN Pengguna memilih "Ganti logo" dan memilih gambar yang lolos ketentuan kriteria 2, THE Modul_Pengaturan SHALL mengganti pratinjau dengan Logo_Praktik baru hasil pemrosesan sesuai kriteria 2 tanpa mengubah Logo_Praktik tersimpan sebelum Simpan dipilih.
6. WHEN Pengguna memilih "Hapus logo", THE Modul_Pengaturan SHALL menghilangkan pratinjau Logo_Praktik serta aksi "Ganti logo" dan "Hapus logo", dan menampilkan kembali aksi "Pilih logo", tanpa mengubah Logo_Praktik tersimpan sebelum Simpan dipilih.
7. IF file yang dipilih sebagai Logo_Praktik bukan Format_Foto_Didukung, tidak dapat dibaca sebagai gambar, gagal dikonversi ke Format_Foto_Simpan, atau gagal dikecilkan, THEN THE Modul_Pengaturan SHALL menolak file tersebut, menampilkan pesan yang menyebutkan nama file dan alasan "format gambar tidak didukung", dan mempertahankan pratinjau Logo_Praktik sebelumnya (atau aksi "Pilih logo" apabila belum ada pratinjau) serta isian formulir lainnya tanpa perubahan.
8. IF ukuran file yang dipilih sebagai Logo_Praktik melebihi Batas_Ukuran_Logo, THEN THE Modul_Pengaturan SHALL menolak file tersebut tanpa memprosesnya, menampilkan pesan yang menyebutkan nama file dan batas ukuran 5 MB, dan mempertahankan pratinjau Logo_Praktik sebelumnya (atau aksi "Pilih logo" apabila belum ada pratinjau) serta isian formulir lainnya tanpa perubahan.
9. WHEN Pengguna memilih Simpan pada formulir Pengaturan_Laporan yang lolos validasi Requirement 7.2, THE Penyimpanan_Data SHALL menyimpan Logo_Praktik sesuai pratinjau terakhir (ditambahkan, diganti, atau dihapus) bersama isian Pengaturan_Laporan lainnya sesuai Requirement 7.10, sehingga setelah Aplikasi ditutup dan dibuka kembali Logo_Praktik tersimpan identik byte demi byte dengan pratinjau terakhir, atau tidak ada Logo_Praktik tersimpan apabila logo dihapus.
10. WHEN Pengguna memilih Batal atau menekan Tombol_Kembali pada formulir Pengaturan_Laporan, THE Modul_Pengaturan SHALL membuang seluruh perubahan Logo_Praktik yang belum disimpan, sehingga Logo_Praktik tersimpan (atau ketiadaannya) sama dengan sebelum formulir dibuka.
11. WHILE Logo_Praktik tersimpan, THE Modul_Laporan_Sesi SHALL menampilkan Logo_Praktik pada Kop_Laporan halaman pertama di sebelah kiri Nama_Praktik, diskalakan dengan rasio lebar dan tinggi dipertahankan sehingga tinggi logo paling besar 25 mm (toleransi 1 mm) dan lebar logo paling besar 60 mm (toleransi 1 mm), tanpa tumpang tindih dengan teks Kop_Laporan dan seluruhnya berada di dalam margin halaman sesuai Requirement 6.1.
12. WHILE Logo_Praktik tidak tersimpan, THE Modul_Laporan_Sesi SHALL menampilkan Kop_Laporan berisi teks saja sesuai Requirement 6.2 dengan Nama_Praktik dimulai pada margin kiri tanpa ruang kosong untuk logo.
13. IF Logo_Praktik gagal dimuat saat Laporan_Sesi disusun, THEN THE Modul_Laporan_Sesi SHALL tetap menyelesaikan penyusunan Laporan_Sesi dengan Kop_Laporan berisi teks saja sesuai kriteria 12, tanpa menghentikan penyusunan dengan pesan "Laporan gagal dibuat, silakan coba lagi", dan tidak mengubah atau menghapus Logo_Praktik tersimpan.
14. WHILE perangkat tidak terhubung ke internet, THE Modul_Pengaturan SHALL memproses, menampilkan, dan menyimpan Logo_Praktik sepenuhnya di perangkat tanpa mengirim gambar ke luar perangkat dan tanpa menampilkan pesan kesalahan koneksi.
15. WHILE Modul_Pengaturan sedang memproses gambar yang dipilih sebagai Logo_Praktik, THE Modul_Pengaturan SHALL menampilkan indikator proses dan menonaktifkan tombol Simpan serta aksi "Pilih logo", "Ganti logo", dan "Hapus logo" hingga gambar tersebut selesai diterima atau ditolak.
16. WHEN Pengguna menutup pemilih file tanpa memilih gambar, THE Modul_Pengaturan SHALL kembali ke formulir Pengaturan_Laporan dengan pratinjau Logo_Praktik (atau aksi "Pilih logo") dan isian lainnya tanpa perubahan dan tanpa menampilkan pesan kesalahan.

### Requirement 11: Nomor HP dari Kontak

**User Story:** Sebagai Pengguna, saya ingin mengisi nomor HP pasien dengan memilih kontak dari ponsel, sehingga saya tidak perlu mengetik ulang nomor dan risiko salah ketik berkurang.

#### Acceptance Criteria

1. WHERE platform menyediakan Pemilih_Kontak (APK_Android melalui plugin kontak, atau PWA pada peramban yang mendukung Contact Picker API), THE Modul_Pasien SHALL menampilkan aksi "Ambil dari kontak" di samping isian Nomor HP pada formulir tambah pasien dan formulir ubah pasien.
2. IF platform tidak menyediakan Pemilih_Kontak, THEN THE Modul_Pasien SHALL menyembunyikan aksi "Ambil dari kontak" dan tetap menerima pengisian Nomor HP secara manual sesuai Requirement 1 dan Requirement 2 Spesifikasi_Dasar.
3. WHEN Pengguna memilih aksi "Ambil dari kontak", THE Modul_Pasien SHALL meminta izin akses kontak apabila izin tersebut belum diberikan, lalu membuka Pemilih_Kontak untuk memilih tepat satu Kontak_Perangkat.
4. WHEN Pengguna memilih Kontak_Perangkat yang memiliki tepat satu nomor telepon, THE Modul_Pasien SHALL menerapkan Normalisasi_Nomor pada nomor tersebut dan mengisi isian Nomor HP dengan hasilnya, menggantikan nilai sebelumnya, tanpa menyimpan Data_Pasien.
5. WHEN Pengguna memilih Kontak_Perangkat yang memiliki dua atau lebih nomor telepon, THE Modul_Pasien SHALL menampilkan daftar seluruh nomor telepon Kontak_Perangkat tersebut sesuai urutan dari Pemilih_Kontak, tanpa mengubah isian formulir sebelum Pengguna memilih satu nomor.
6. WHEN isian Nomor HP diisi dari Kontak_Perangkat, THE Modul_Pasien SHALL mempertahankan isian Nomor HP tetap dapat diubah Pengguna dan menyimpan Data_Pasien hanya ketika Pengguna mengirim formulir yang lolos validasi Requirement 1 Spesifikasi_Dasar.
7. WHEN isian Nomor HP diisi dari Kontak_Perangkat dan isian Nama kosong atau hanya berisi spasi, THE Modul_Pasien SHALL mengisi isian Nama dengan nama Kontak_Perangkat tersebut setelah spasi di awal dan akhir dihapus, dipotong menjadi paling banyak 100 karakter (asumsi); apabila nama Kontak_Perangkat kosong atau hanya berisi spasi, THE Modul_Pasien SHALL mempertahankan isian Nama tanpa perubahan.
8. WHEN isian Nomor HP diisi dari Kontak_Perangkat dan isian Nama sudah berisi teks selain spasi, THE Modul_Pasien SHALL mempertahankan isian Nama tanpa perubahan.
9. IF hasil Normalisasi_Nomor bukan Nomor_HP_Valid, THEN THE Modul_Pasien SHALL tetap mengisi isian Nomor HP dengan hasil Normalisasi_Nomor tanpa menampilkan pesan saat itu, dan THE Validator SHALL menampilkan pesan "Nomor HP tidak valid" sesuai Requirement 1.3 Spesifikasi_Dasar ketika formulir dikirim.
10. WHEN Pengguna menutup Pemilih_Kontak atau daftar nomor telepon tanpa memilih, THE Modul_Pasien SHALL kembali ke formulir dengan seluruh isian tanpa perubahan dan tanpa menampilkan pesan.
11. IF izin akses kontak ditolak atau Pemilih_Kontak gagal dibuka atau gagal mengembalikan Kontak_Perangkat karena kesalahan sistem, THEN THE Modul_Pasien SHALL menampilkan pesan yang menyatakan kontak tidak dapat diakses dan nomor HP dapat diisi manual, serta mempertahankan seluruh isian formulir tanpa perubahan.
12. THE Modul_Pasien SHALL hanya membaca nama dan nomor telepon dari Kontak_Perangkat yang dipilih Pengguna, dan tidak menyimpan data Kontak_Perangkat apa pun di Penyimpanan_Data selain nilai Nama dan Nomor HP yang dikirim melalui formulir.
13. WHILE perangkat tidak terhubung ke internet, THE Modul_Pasien SHALL tetap dapat menjalankan aksi "Ambil dari kontak" tanpa menampilkan pesan kesalahan koneksi.
14. WHEN Pengguna memilih satu nomor dari daftar nomor telepon pada kriteria 5, THE Modul_Pasien SHALL menutup daftar tersebut dan mengisi isian Nomor HP sesuai kriteria 4 dengan nomor yang dipilih, serta mengisi isian Nama sesuai kriteria 7 dan kriteria 8.
15. IF Kontak_Perangkat yang dipilih tidak memiliki nomor telepon, THEN THE Modul_Pasien SHALL menampilkan pesan yang menyatakan kontak tersebut tidak memiliki nomor telepon, dan mempertahankan isian Nomor HP, isian Nama, serta isian formulir lainnya tanpa perubahan.

### Requirement 12: Chat WhatsApp dari Nomor HP

**User Story:** Sebagai Pengguna, saya ingin langsung membuka chat WhatsApp dengan pasien dari nomor HP-nya, sehingga saya dapat menghubungi pasien tanpa menyalin nomor.

#### Acceptance Criteria

1. THE Modul_Pasien SHALL menampilkan nomor HP Data_Pasien di daftar pasien, di halaman detail Pasien, pada setiap Jadwal_Kunjungan di Halaman_Jadwal, dan di Formulir_Jadwal sesuai kriteria 9 sebagai aksi yang dapat diketuk dan dapat dijalankan dengan keyboard (tombol Enter saat aksi difokuskan), dengan teks nomor HP yang ditampilkan sama persis karakter demi karakter dengan nomor HP tersimpan (bukan Nomor_WhatsApp), dan dengan label aksesibel "Chat WhatsApp {nama}", dengan {nama} adalah nama Pasien tersebut.
2. WHEN Modul_Pasien menyusun Tautan_WhatsApp, THE Modul_Pasien SHALL mengubah nomor HP menjadi Nomor_WhatsApp, sehingga "081234567890" menjadi "6281234567890", "+6281234567890" menjadi "6281234567890", dan "6281234567890" tetap "6281234567890", tanpa mengubah nomor HP yang tersimpan di Data_Pasien.
3. WHEN Pengguna mengetuk aksi nomor HP, THE Modul_Pasien SHALL menyerahkan Tautan_WhatsApp Pasien tersebut ke sistem dalam waktu paling lama 1 detik sejak ketukan untuk dibuka di luar Aplikasi, yaitu melalui aplikasi WhatsApp atau peramban pada APK_Android dan melalui tab atau jendela baru peramban pada PWA.
4. WHEN Pengguna mengetuk aksi nomor HP di daftar pasien, di halaman detail Pasien, di Halaman_Jadwal, atau di Formulir_Jadwal, THE Modul_Pasien SHALL hanya membuka Tautan_WhatsApp dan tetap menampilkan halaman atau Formulir_Jadwal tempat aksi diketuk, tanpa membuka halaman detail Pasien dari daftar pasien dan tanpa membuka dialog atau formulir lain apa pun.
5. IF sistem tidak dapat membuka Tautan_WhatsApp karena tidak ada aplikasi WhatsApp maupun peramban yang dapat menanganinya, THEN THE Modul_Pasien SHALL menampilkan pesan yang menyatakan WhatsApp tidak dapat dibuka beserta nomor HP Pasien, dan mempertahankan seluruh data tanpa perubahan.
6. WHILE perangkat tidak terhubung ke internet, WHEN Pengguna mengetuk aksi nomor HP, THE Modul_Pasien SHALL tetap menyerahkan Tautan_WhatsApp ke sistem tanpa menampilkan pesan kesalahan koneksi; ketersediaan chat bergantung pada koneksi internet aplikasi WhatsApp atau peramban.
7. WHEN Pengguna mengetuk aksi nomor HP, THE Aplikasi SHALL mempertahankan seluruh Data_Pasien, Sesi_Terapi, Jadwal_Kunjungan, dan Foto_Sesi tanpa perubahan.
8. THE Modul_Pasien SHALL menampilkan aksi nomor HP pada setiap Jadwal_Kunjungan di Halaman_Jadwal untuk seluruh status Jadwal_Kunjungan (Terjadwal, Selesai, dan Dibatalkan), menggunakan nomor HP Data_Pasien pemilik Jadwal_Kunjungan tersebut.
9. WHILE sebuah Pasien terpilih pada isian "Pasien" di Formulir_Jadwal mode tambah maupun ubah, THE Modul_Pasien SHALL menampilkan nomor HP Data_Pasien tersebut sebagai aksi nomor HP tepat di bawah isian "Pasien".
10. WHILE belum ada Pasien yang terpilih pada isian "Pasien" di Formulir_Jadwal, THE Modul_Pasien SHALL menampilkan Formulir_Jadwal tanpa aksi nomor HP.
11. WHEN Pengguna mengganti Pasien yang terpilih pada isian "Pasien" di Formulir_Jadwal, THE Modul_Pasien SHALL memperbarui teks, label aksesibel, dan Tautan_WhatsApp aksi nomor HP sesuai Data_Pasien yang baru dipilih sebelum aksi tersebut dapat diketuk kembali.
12. WHEN Pengguna mengetuk aksi nomor HP pada sebuah Jadwal_Kunjungan di Halaman_Jadwal, THE Modul_Pasien SHALL hanya membuka Tautan_WhatsApp tanpa menjalankan aksi Tandai Selesai, Dibatalkan, Ubah, maupun Hapus pada Jadwal_Kunjungan tersebut dan tanpa membuka dialog apa pun.
13. WHEN Pengguna mengetuk aksi nomor HP di Formulir_Jadwal, THE Modul_Pasien SHALL hanya membuka Tautan_WhatsApp, tetap menampilkan Formulir_Jadwal dalam keadaan terbuka, mempertahankan seluruh nilai isian Formulir_Jadwal tanpa perubahan, dan tidak menyimpan Jadwal_Kunjungan apa pun.
14. IF Data_Pasien pemilik sebuah Jadwal_Kunjungan tidak ditemukan, THEN THE Modul_Pasien SHALL menampilkan Jadwal_Kunjungan tersebut di Halaman_Jadwal tanpa aksi nomor HP.

### Requirement 13: Label Diagnosa

**User Story:** Sebagai Pengguna, saya ingin isian "Pola penyakit" disebut "Diagnosa", sehingga istilahnya sesuai dengan yang biasa dipakai di praktik.

#### Acceptance Criteria

1. THE Modul_Terapi SHALL menampilkan label "Diagnosa" sebagai pengganti label "Pola penyakit" pada isian Diagnosa di Formulir_Sesi mode tambah dan ubah, dengan nama aksesibel isian tersebut juga "Diagnosa", dan tidak menampilkan teks "Pola penyakit" pada label, teks petunjuk, maupun nama aksesibel isian tersebut.
2. THE Modul_Terapi SHALL menampilkan label "Diagnosa" untuk nilai Diagnosa pada setiap Sesi_Terapi di Histori_Terapi, dengan tanda "-" apabila Diagnosa kosong sesuai Requirement 7.4 Spesifikasi_Dasar, dan tidak menampilkan teks "Pola penyakit" di mana pun pada Histori_Terapi.
3. THE Modul_Laporan_Sesi SHALL menampilkan label "Diagnosa" untuk nilai Diagnosa pada bagian Sesi Terapi Laporan_Sesi sesuai Requirement 5.3, dan tidak menampilkan teks "Pola penyakit" di mana pun pada Laporan_Sesi.
4. IF isian Diagnosa pada Formulir_Sesi melebihi 1000 karakter, THEN THE Validator SHALL menolak penyimpanan sesuai aturan pola penyakit pada Requirement 5.6 dan 5.8 Spesifikasi_Dasar, menampilkan pesan kesalahan batas karakter yang menyebut kolom "Diagnosa" tanpa menyebut "Pola penyakit", dan mempertahankan seluruh isian Formulir_Sesi; isian Diagnosa yang kosong atau berisi 1 sampai 1000 karakter SHALL diterima.
5. THE Penyimpanan_Data SHALL menyimpan dan memuat Diagnosa dengan nama atribut dan nilai yang sama seperti sebelum label "Diagnosa" diterapkan, tanpa migrasi data, sehingga nilai Diagnosa setiap Sesi_Terapi lama tampil identik karakter demi karakter dengan nilai pola penyakit yang tersimpan sebelumnya.
6. WHEN Pengguna mengekspor atau mengimpor File_Cadangan, THE Modul_Cadangan SHALL menulis dan membaca Diagnosa dengan nama atribut yang sama seperti sebelum label "Diagnosa" diterapkan dan File_Cadangan berversi format 1, sehingga File_Cadangan yang dibuat sebelum dan sesudah perubahan label dapat diimpor dengan nilai Diagnosa identik karakter demi karakter (keputusan K10).

### Requirement 14: Umur dan Jenis Kelamin Pasien

**User Story:** Sebagai Pengguna, saya ingin mencatat umur dan jenis kelamin pasien, sehingga data pasien lebih lengkap untuk keperluan terapi dan laporan.

#### Acceptance Criteria

1. THE Modul_Pasien SHALL menampilkan pada formulir tambah pasien dan formulir ubah pasien isian "Umur" berupa isian angka dalam satuan tahun dan isian "Jenis Kelamin" berupa pilihan tunggal dengan tepat dua opsi, "Laki-laki" dan "Wanita", yang keduanya dapat dibiarkan kosong, dengan isian "Jenis Kelamin" menyediakan cara mengembalikan pilihan ke keadaan kosong setelah salah satu opsi dipilih.
2. WHEN Pengguna mengirim formulir tambah atau ubah pasien yang lolos aturan Requirement 1 Spesifikasi_Dasar dengan Umur kosong atau berupa bilangan bulat 0 sampai 150 dan Jenis_Kelamin kosong atau salah satu dari dua opsi, THE Modul_Pasien SHALL menyimpan Umur sebagai nilai bilangan bulat (contoh isian "035" disimpan sebagai 35) dan Jenis_Kelamin sesuai isian bersama atribut Data_Pasien lainnya, dengan isian Umur yang hanya berisi spasi diperlakukan sebagai Umur kosong.
3. IF isian Umur terisi tetapi, setelah spasi di awal dan akhir dihapus, memuat karakter selain angka 0-9 (termasuk tanda minus, koma, titik, atau huruf) atau bernilai di luar rentang 0 sampai 150, THEN THE Validator SHALL menolak penyimpanan, menampilkan pesan "Umur harus berupa angka 0 sampai 150" pada isian Umur bersamaan dengan pesan kesalahan isian lain menurut Requirement 1 Spesifikasi_Dasar apabila ada, tidak membuat atau mengubah Data_Pasien, dan mempertahankan seluruh isian formulir sebagaimana dimasukkan Pengguna.
4. WHEN Pengguna membuka formulir ubah pasien, THE Modul_Pasien SHALL mengisi isian Umur dan Jenis Kelamin dengan nilai Umur dan Jenis_Kelamin yang tersimpan, atau membiarkannya kosong apabila nilai tersimpan kosong.
5. THE Modul_Pasien SHALL menyimpan Umur tepat sesuai nilai yang dikirim Pengguna tanpa menambah atau mengubahnya secara otomatis seiring berjalannya waktu (asumsi; tanggal lahir tidak digunakan).
6. WHEN Pengguna membuka halaman detail Pasien, THE Modul_Pasien SHALL menampilkan Umur dalam format "N tahun" (termasuk "0 tahun" untuk Umur 0) dengan label "Umur" dan Jenis_Kelamin dengan label "Jenis Kelamin", atau tanda "-" untuk nilai yang kosong.
7. THE Modul_Pasien SHALL menampilkan setiap Data_Pasien di daftar pasien tanpa Umur dan Jenis_Kelamin, sesuai isi daftar pada Requirement 4.1 Spesifikasi_Dasar (keputusan K11).
8. THE Modul_Pasien SHALL menjalankan pencarian pasien hanya berdasarkan nama dan nomor HP sesuai Requirement 4.3 Spesifikasi_Dasar, tanpa mencocokkan Umur maupun Jenis_Kelamin.
9. WHEN Aplikasi yang sudah berisi Data_Pasien dari versi sebelum fitur ini dibuka pertama kali setelah pembaruan, THE Penyimpanan_Data SHALL menyelesaikan migrasi sesuai Requirement 4.8, sehingga setiap Data_Pasien lama memiliki Umur kosong dan Jenis_Kelamin kosong, dan seluruh atribut lain Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan tetap sama.
10. IF migrasi untuk menambahkan Umur dan Jenis_Kelamin gagal, THEN THE Aplikasi SHALL berperilaku sesuai Requirement 4.9, yaitu menampilkan pesan data gagal dimuat, mempertahankan data tersimpan tanpa perubahan, dan menjalankan kembali migrasi pada pembukaan Aplikasi berikutnya.
11. THE Penyimpanan_Data SHALL menjamin bahwa untuk setiap Data_Pasien yang lolos pemeriksaan Validator, termasuk dengan Umur atau Jenis_Kelamin kosong, menyimpan lalu memuat kembali menghasilkan Umur dan Jenis_Kelamin yang identik dengan nilai semula (round-trip).
12. THE Modul_Cadangan SHALL mengekspor dan mengimpor Umur dan Jenis_Kelamin sesuai Requirement 9.11, 9.12, dan 9.13, dengan File_Cadangan tetap berversi format 1.
