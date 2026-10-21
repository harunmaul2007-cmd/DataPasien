# Requirements Document

## Introduction

Aplikasi Manajemen Pasien Terapi adalah aplikasi web responsif untuk praktik terapi yang dapat dikonversi menjadi aplikasi Android. Aplikasi ini digunakan untuk mengelola data pasien (tambah, ubah, hapus), mencatat sesi terapi setiap pasien beserta historinya (satu pasien dapat menjalani beberapa kali terapi), mengatur jadwal kunjungan pasien, dan menampilkan laporan pemasukan biaya terapi yang dapat difilter per bulan.

Selain dapat dipasang sebagai aplikasi web (Requirement 11), Aplikasi juga dipersiapkan agar dapat dikonversi menjadi file APK Android yang dapat dipasang langsung di perangkat Android (Requirement 13). File APK dihasilkan dari kode sumber web yang sama melalui proses build yang terdokumentasi dan dapat diulang, sehingga tidak ada dua basis kode terpisah yang harus dipelihara. Karena seluruh data hanya disimpan secara lokal di perangkat, Aplikasi juga menyediakan fitur cadangan dan pemulihan data (Requirement 14) agar data tidak hilang jika Aplikasi dihapus atau perangkat diganti.

Asumsi yang perlu dikonfirmasi Pengguna:

- Versi Android minimal yang didukung APK_Android adalah Android 7.0 (API level 24).
- Fitur cadangan dan pemulihan data (Requirement 14) disertakan dalam lingkup, dengan format file JSON dan mode impor yang menggantikan seluruh data yang ada (bukan menggabungkan).
- Halaman_Utama adalah halaman daftar pasien.

Catatan penulisan: kata kunci pola EARS (WHEN, WHILE, IF/THEN, WHERE, THE, SHALL) ditulis dalam bahasa Inggris agar struktur requirement tetap konsisten, sedangkan isinya ditulis dalam Bahasa Indonesia.

## Glossary

- **Aplikasi**: Aplikasi web responsif Manajemen Pasien Terapi secara keseluruhan, termasuk versi yang dikemas sebagai aplikasi Android.
- **Pengguna**: Terapis atau staf praktik yang mengoperasikan Aplikasi.
- **Pasien**: Orang yang menerima terapi, dengan atribut nama, alamat, dan nomor HP.
- **Data_Pasien**: Rekaman data seorang Pasien yang berisi nama, alamat, dan nomor HP.
- **Sesi_Terapi**: Rekaman satu kali terapi untuk seorang Pasien yang berisi tanggal terapi, keluhan, pola penyakit, terapi yang diberikan, hasil terapi, dan biaya.
- **Histori_Terapi**: Kumpulan seluruh Sesi_Terapi milik satu Pasien.
- **Jadwal_Kunjungan**: Rekaman rencana kunjungan seorang Pasien yang berisi tanggal, jam, dan catatan opsional, serta memiliki status (Terjadwal, Selesai, atau Dibatalkan).
- **Laporan_Pemasukan**: Ringkasan total biaya dari Sesi_Terapi dalam satu bulan tertentu.
- **Modul_Pasien**: Bagian Aplikasi yang mengelola Data_Pasien.
- **Modul_Terapi**: Bagian Aplikasi yang mengelola Sesi_Terapi dan Histori_Terapi.
- **Modul_Jadwal**: Bagian Aplikasi yang mengelola Jadwal_Kunjungan.
- **Modul_Laporan**: Bagian Aplikasi yang menyusun Laporan_Pemasukan.
- **Validator**: Komponen Aplikasi yang memeriksa kebenaran isian formulir sebelum data disimpan.
- **Penyimpanan_Data**: Komponen Aplikasi yang menyimpan dan memuat seluruh data secara persisten.
- **Nomor_HP_Valid**: Nomor HP yang hanya berisi angka dengan awalan opsional "+", diawali "08" atau "+628" atau "628", dengan panjang total 10 sampai 15 digit.
- **Format_Rupiah**: Format tampilan nominal uang dengan awalan "Rp" dan pemisah ribuan titik, contoh "Rp 150.000".
- **APK_Android**: File paket aplikasi Android (berekstensi .apk) yang berisi Aplikasi dan dapat dipasang langsung di perangkat Android tanpa melalui peramban.
- **APK_Debug**: APK_Android yang ditandatangani dengan kunci debug untuk keperluan pengujian.
- **APK_Rilis**: APK_Android yang ditandatangani dengan Kunci_Penandatanganan untuk didistribusikan kepada Pengguna.
- **Kunci_Penandatanganan**: Kunci kriptografis milik pemilik proyek yang digunakan untuk menandatangani setiap APK_Rilis; kunci yang sama harus dipakai untuk seluruh versi agar pembaruan dapat dipasang.
- **Proses_Build**: Rangkaian langkah otomatis yang menghasilkan APK_Debug atau APK_Rilis dari kode sumber web Aplikasi.
- **Dokumentasi_Build**: Dokumen di dalam repositori proyek yang menjelaskan prasyarat dan langkah menjalankan Proses_Build.
- **Package_Identifier**: Identitas unik APK_Android di sistem Android dalam format nama domain terbalik, contoh "com.contoh.datapasien".
- **versionCode**: Bilangan bulat positif pada APK_Android yang digunakan sistem Android untuk menentukan urutan versi.
- **versionName**: Teks versi APK_Android yang ditampilkan kepada Pengguna dengan format "MAJOR.MINOR.PATCH", contoh "1.0.0".
- **Halaman_Utama**: Halaman pertama yang ditampilkan saat Aplikasi dibuka, yaitu halaman daftar pasien.
- **Tombol_Kembali**: Tombol atau gestur kembali bawaan sistem Android.
- **Modul_Cadangan**: Bagian Aplikasi yang mengekspor seluruh data ke File_Cadangan dan mengimpor data dari File_Cadangan.
- **File_Cadangan**: File berformat JSON hasil ekspor Modul_Cadangan yang berisi versi format, waktu ekspor, serta seluruh Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan.

## Requirements

### Requirement 1: Menambah Data Pasien

**User Story:** Sebagai Pengguna, saya ingin menambahkan data pasien baru, sehingga pasien tersebut tercatat dan dapat diberikan sesi terapi.

#### Acceptance Criteria

1. WHEN Pengguna mengirim formulir tambah pasien dengan nama yang tidak kosong setelah spasi di awal dan akhir dihapus dan panjangnya 1-100 karakter, alamat dengan panjang maksimal 255 karakter setelah spasi di awal dan akhir dihapus, dan nomor HP yang merupakan Nomor_HP_Valid, THE Modul_Pasien SHALL menyimpan tepat satu Data_Pasien baru, menampilkan pesan konfirmasi bahwa data berhasil disimpan, dan menampilkan Data_Pasien tersebut di daftar pasien tanpa Pengguna perlu memuat ulang halaman.
2. IF nama pasien kosong atau hanya berisi spasi, THEN THE Validator SHALL menolak penyimpanan, menampilkan pesan "Nama wajib diisi", tidak membuat Data_Pasien baru, dan mempertahankan isian formulir lainnya yang sudah dimasukkan Pengguna.
3. IF nomor HP yang diisi bukan Nomor_HP_Valid, THEN THE Validator SHALL menolak penyimpanan, menampilkan pesan "Nomor HP tidak valid", tidak membuat Data_Pasien baru, dan mempertahankan isian formulir yang sudah dimasukkan Pengguna.
4. IF panjang nama setelah spasi di awal dan akhir dihapus melebihi 100 karakter, THEN THE Validator SHALL menolak penyimpanan, menampilkan pesan kesalahan yang menyatakan batas maksimal nama 100 karakter, dan tidak membuat Data_Pasien baru.
5. WHEN Data_Pasien baru disimpan, THE Modul_Pasien SHALL memberikan identitas unik pada Data_Pasien tersebut yang berbeda dari identitas semua Data_Pasien lain yang sudah ada dan tidak berubah selama Data_Pasien tersebut ada.
6. WHEN Data_Pasien baru disimpan, THE Modul_Pasien SHALL menyimpan nama dan alamat setelah menghapus spasi di awal dan akhir teks, dengan penghapusan spasi dilakukan sebelum validasi panjang dan validasi nama kosong.
7. IF panjang alamat setelah spasi di awal dan akhir dihapus melebihi 255 karakter, THEN THE Validator SHALL menolak penyimpanan, menampilkan pesan kesalahan yang menyatakan batas maksimal alamat 255 karakter, dan tidak membuat Data_Pasien baru.
8. IF lebih dari satu isian formulir gagal validasi pada satu kali pengiriman, THEN THE Validator SHALL menampilkan seluruh pesan kesalahan yang relevan secara bersamaan, masing-masing pada isian yang bersangkutan.
9. IF penyimpanan Data_Pasien gagal karena kesalahan sistem setelah validasi berhasil, THEN THE Modul_Pasien SHALL menampilkan pesan kesalahan yang menyatakan data gagal disimpan, tidak menambahkan Data_Pasien apa pun ke daftar pasien, dan mempertahankan seluruh isian formulir agar Pengguna dapat mengirim ulang.

### Requirement 2: Mengubah Data Pasien

**User Story:** Sebagai Pengguna, saya ingin mengubah data pasien, sehingga data pasien selalu akurat.

#### Acceptance Criteria

1. WHEN Pengguna membuka formulir ubah pasien untuk satu Pasien yang tersimpan, THE Modul_Pasien SHALL menampilkan formulir dengan isian nama, alamat, dan nomor HP yang sudah terisi nilai Data_Pasien yang tersimpan saat formulir dibuka, sama persis karakter demi karakter.
2. WHEN Pengguna mengirim formulir ubah pasien dengan isian yang memenuhi semua aturan Requirement 1 (nama wajib diisi dengan panjang 1 sampai 100 karakter, alamat maksimal 255 karakter, dan nomor HP berupa Nomor_HP_Valid), THE Modul_Pasien SHALL menyimpan nilai nama, alamat, dan nomor HP yang dikirim sebagai Data_Pasien, mempertahankan identitas unik dan seluruh entri Histori_Terapi milik Pasien tersebut tanpa perubahan, lalu menampilkan pesan yang menyatakan perubahan berhasil disimpan.
3. IF satu atau lebih isian formulir ubah pasien tidak memenuhi aturan Requirement 1, THEN THE Validator SHALL menolak seluruh perubahan, mempertahankan Data_Pasien yang tersimpan sebelumnya tanpa perubahan pada field mana pun, menampilkan pesan kesalahan pada setiap isian yang tidak valid yang menyebutkan aturan yang dilanggar, dan tetap menampilkan nilai yang dimasukkan Pengguna di formulir.
4. IF Pasien yang akan diubah tidak lagi tersimpan saat formulir ubah pasien dibuka atau dikirim, THEN THE Modul_Pasien SHALL tidak menyimpan perubahan apa pun dan menampilkan pesan kesalahan yang menyatakan data Pasien tidak ditemukan.
5. WHEN Pengguna membatalkan formulir ubah pasien sebelum mengirimnya, THE Modul_Pasien SHALL menutup formulir tanpa menyimpan perubahan, sehingga Data_Pasien tetap sama dengan nilai sebelum formulir dibuka.

### Requirement 3: Menghapus Data Pasien

**User Story:** Sebagai Pengguna, saya ingin menghapus data pasien, sehingga data yang tidak diperlukan tidak lagi muncul di daftar.

#### Acceptance Criteria

1. WHEN Pengguna memilih hapus pada sebuah Data_Pasien, THE Modul_Pasien SHALL menampilkan dialog konfirmasi yang menyebutkan nama pasien, jumlah Sesi_Terapi, dan jumlah Jadwal_Kunjungan (dari semua status: Terjadwal, Selesai, dan Dibatalkan) milik Pasien tersebut yang akan ikut terhapus, menampilkan angka 0 jika tidak ada data terkait, serta menyediakan pilihan untuk mengonfirmasi dan membatalkan penghapusan.
2. WHEN Pengguna mengonfirmasi penghapusan, THE Modul_Pasien SHALL menghapus Data_Pasien beserta seluruh Sesi_Terapi dan seluruh Jadwal_Kunjungan dari semua status milik Pasien tersebut melalui Penyimpanan_Data, sehingga tidak ada Sesi_Terapi atau Jadwal_Kunjungan yang tersisa tanpa Pasien.
3. WHEN Pengguna memilih batal atau menutup dialog konfirmasi tanpa memilih konfirmasi, THE Modul_Pasien SHALL menutup dialog dan mempertahankan Data_Pasien beserta seluruh Sesi_Terapi dan Jadwal_Kunjungan miliknya tanpa perubahan.
4. WHEN Laporan_Pemasukan ditampilkan setelah sebuah Data_Pasien dihapus, THE Modul_Laporan SHALL mengecualikan Sesi_Terapi milik Pasien tersebut dari total pemasukan, jumlah Sesi_Terapi, jumlah Pasien berbeda, dan rincian Sesi_Terapi untuk setiap bulan dan tahun yang dipilih.
5. WHEN penghapusan Data_Pasien berhasil disimpan oleh Penyimpanan_Data, THE Modul_Pasien SHALL menutup dialog konfirmasi, menampilkan pesan berhasil, dan menampilkan daftar pasien serta hasil pencarian tanpa Data_Pasien tersebut, dan THE Modul_Jadwal SHALL tidak lagi menampilkan Jadwal_Kunjungan milik Pasien tersebut pada halaman jadwal.
6. IF penghapusan Data_Pasien gagal disimpan oleh Penyimpanan_Data, THEN THE Modul_Pasien SHALL menampilkan pesan kesalahan yang menyatakan penghapusan gagal dan mempertahankan Data_Pasien beserta seluruh Sesi_Terapi dan Jadwal_Kunjungan miliknya tanpa ada yang terhapus sebagian.

### Requirement 4: Daftar dan Pencarian Pasien

**User Story:** Sebagai Pengguna, saya ingin melihat daftar pasien dan mencarinya, sehingga saya dapat menemukan pasien dengan cepat.

#### Acceptance Criteria

1. WHEN Pengguna membuka halaman daftar pasien, THE Modul_Pasien SHALL menampilkan seluruh Data_Pasien yang tersimpan, masing-masing berisi nama, alamat, nomor HP, dan tanggal Sesi_Terapi terakhir, yaitu tanggal terapi paling akhir di antara seluruh Sesi_Terapi milik Pasien tersebut, ditampilkan sesuai format tanggal pada Requirement 12.
2. THE Modul_Pasien SHALL mengurutkan daftar pasien, termasuk daftar hasil pencarian, berdasarkan nama secara alfabetis menaik tanpa membedakan huruf besar dan kecil.
3. WHEN Pengguna menambah atau menghapus karakter pada kolom pencarian, THE Modul_Pasien SHALL dalam waktu paling lama 500 milidetik dan tanpa perlu menekan tombol menampilkan hanya Data_Pasien yang nama atau nomor HP-nya mengandung kata kunci tersebut sebagai bagian teks di posisi mana pun, tanpa membedakan huruf besar dan kecil, setelah spasi di awal dan akhir kata kunci dihapus.
4. WHEN kolom pencarian dikosongkan atau hanya berisi spasi, THE Modul_Pasien SHALL menampilkan kembali seluruh Data_Pasien dengan urutan sesuai kriteria 2.
5. IF tidak ada Data_Pasien yang cocok dengan kata kunci yang tidak kosong, THEN THE Modul_Pasien SHALL menampilkan daftar kosong dan pesan "Pasien tidak ditemukan".
6. THE Modul_Pasien SHALL membatasi panjang kata kunci pada kolom pencarian maksimal 100 karakter dan tidak menerima karakter ke-101 dan seterusnya.
7. IF seorang Pasien belum memiliki Sesi_Terapi, THEN THE Modul_Pasien SHALL menampilkan tanda "-" pada kolom tanggal Sesi_Terapi terakhir untuk Pasien tersebut.
8. IF belum ada Data_Pasien yang tersimpan, THEN THE Modul_Pasien SHALL menampilkan pesan "Belum ada data pasien" pada halaman daftar pasien, bukan pesan "Pasien tidak ditemukan".

### Requirement 5: Mencatat Sesi Terapi

**User Story:** Sebagai Pengguna, saya ingin mencatat setiap sesi terapi pasien, sehingga detail terapi dan biayanya terdokumentasi.

#### Acceptance Criteria

1. WHEN Pengguna mengirim formulir sesi terapi yang lolos seluruh aturan validasi pada kriteria 3, 4, 5, dan 8 untuk seorang Pasien, THE Modul_Terapi SHALL menyimpan Sesi_Terapi baru yang terhubung dengan Pasien tersebut, berisi tanggal terapi, keluhan, pola penyakit, terapi yang diberikan, hasil terapi, dan biaya, setelah menghapus spasi di awal dan akhir setiap isian teks, lalu menampilkan pesan bahwa sesi terapi berhasil disimpan dan menampilkan Sesi_Terapi tersebut di Histori_Terapi Pasien.
2. THE Modul_Terapi SHALL mengizinkan satu Pasien memiliki lebih dari satu Sesi_Terapi, termasuk lebih dari satu Sesi_Terapi pada tanggal yang sama, dan menyimpan setiap pengiriman formulir yang valid sebagai Sesi_Terapi terpisah tanpa menimpa Sesi_Terapi yang sudah ada.
3. IF tanggal terapi kosong atau bukan tanggal kalender yang valid, THEN THE Validator SHALL menolak penyimpanan dan menampilkan pesan "Tanggal terapi wajib diisi".
4. IF keluhan atau terapi yang diberikan kosong atau hanya berisi spasi, THEN THE Validator SHALL menolak penyimpanan dan menampilkan pesan bahwa kolom tersebut wajib diisi, di dekat kolom yang bermasalah.
5. IF biaya kosong, bukan bilangan bulat, bernilai negatif, atau lebih dari 999.999.999, THEN THE Validator SHALL menolak penyimpanan dan menampilkan pesan "Biaya harus berupa angka 0 atau lebih".
6. THE Modul_Terapi SHALL memperlakukan pola penyakit dan hasil terapi sebagai isian opsional, dan menyimpan Sesi_Terapi dengan pola penyakit atau hasil terapi kosong tanpa menampilkan pesan kesalahan.
7. WHEN Pengguna membuka formulir sesi terapi baru, THE Modul_Terapi SHALL mengisi tanggal terapi dengan tanggal hari ini menurut perangkat Pengguna sebagai nilai awal yang dapat diubah oleh Pengguna.
8. IF keluhan, pola penyakit, terapi yang diberikan, atau hasil terapi melebihi 1000 karakter, THEN THE Validator SHALL menolak penyimpanan dan menampilkan pesan bahwa kolom tersebut melebihi batas 1000 karakter.
9. IF formulir sesi terapi melanggar lebih dari satu aturan validasi, THEN THE Validator SHALL menampilkan seluruh pesan kesalahan yang relevan secara bersamaan dalam satu kali pengiriman.
10. IF Validator menolak penyimpanan formulir sesi terapi, THEN THE Modul_Terapi SHALL mempertahankan seluruh nilai yang telah diisi Pengguna pada formulir dan tidak membuat atau mengubah Sesi_Terapi apa pun.

### Requirement 6: Mengubah dan Menghapus Sesi Terapi

**User Story:** Sebagai Pengguna, saya ingin mengubah atau menghapus sesi terapi, sehingga kesalahan pencatatan dapat diperbaiki.

#### Acceptance Criteria

1. WHEN Pengguna mengirim formulir ubah sesi terapi dengan isian yang lolos seluruh aturan pada Requirement 5, THE Modul_Terapi SHALL memperbarui tanggal terapi, keluhan, pola penyakit, terapi yang diberikan, hasil terapi, dan biaya pada Sesi_Terapi tersebut, mempertahankan keterhubungannya dengan Pasien yang sama, dan menampilkan nilai terbaru di Histori_Terapi Pasien tersebut tanpa menambah jumlah Sesi_Terapi.
2. IF isian formulir ubah sesi terapi tidak lolos aturan pada Requirement 5 kriteria 3, 4, 5, atau 8, THEN THE Validator SHALL menolak perubahan, menampilkan pesan kesalahan yang sama dengan pesan pada kriteria Requirement 5 yang dilanggar, mempertahankan isian formulir yang sudah diketik Pengguna, dan mempertahankan Sesi_Terapi yang tersimpan sebelumnya tanpa perubahan.
3. WHEN Pengguna mengonfirmasi penghapusan sebuah Sesi_Terapi, THE Modul_Terapi SHALL menghapus Sesi_Terapi tersebut dari Histori_Terapi, mengurangi jumlah Sesi_Terapi milik Pasien tepat satu, dan mempertahankan Data_Pasien, Jadwal_Kunjungan, serta seluruh Sesi_Terapi lainnya tanpa perubahan.
4. WHEN sebuah Sesi_Terapi diubah atau dihapus, THE Modul_Laporan SHALL menyusun Laporan_Pemasukan berikutnya yang ditampilkan berdasarkan tanggal terapi dan biaya terbaru dari Sesi_Terapi yang diubah, serta mengecualikan biaya Sesi_Terapi yang dihapus, termasuk memindahkan biaya ke bulan baru apabila tanggal terapi diubah ke bulan atau tahun yang berbeda.
5. WHEN Pengguna membuka formulir ubah sesi terapi, THE Modul_Terapi SHALL menampilkan nilai tanggal terapi, keluhan, pola penyakit, terapi yang diberikan, hasil terapi, dan biaya yang tersimpan saat ini pada Sesi_Terapi tersebut.
6. WHEN Pengguna memilih hapus pada sebuah Sesi_Terapi, THE Modul_Terapi SHALL menampilkan dialog konfirmasi yang menyebutkan nama Pasien, tanggal terapi, dan biaya dalam Format_Rupiah dari Sesi_Terapi yang akan dihapus, tanpa menghapus data sebelum Pengguna mengonfirmasi.
7. WHEN Pengguna membatalkan dialog konfirmasi penghapusan Sesi_Terapi, THE Modul_Terapi SHALL menutup dialog dan mempertahankan Sesi_Terapi tersebut beserta seluruh data terkaitnya tanpa perubahan.

### Requirement 7: Histori Terapi Pasien

**User Story:** Sebagai Pengguna, saya ingin melihat histori terapi seorang pasien, sehingga saya dapat memantau perkembangan kondisinya.

#### Acceptance Criteria

1. WHEN Pengguna membuka halaman detail Pasien, THE Modul_Terapi SHALL menampilkan Data_Pasien (nama, alamat, dan nomor HP) beserta seluruh Sesi_Terapi dalam Histori_Terapi milik Pasien tersebut tanpa pembatasan jumlah Sesi_Terapi yang ditampilkan.
2. WHILE halaman detail Pasien sedang dibuka, THE Modul_Terapi SHALL menampilkan Histori_Terapi yang hanya berisi Sesi_Terapi yang terhubung dengan Pasien tersebut dan tidak menampilkan satu pun Sesi_Terapi milik Pasien lain.
3. THE Modul_Terapi SHALL mengurutkan Histori_Terapi berdasarkan tanggal terapi dari yang terbaru ke yang terlama, dan untuk Sesi_Terapi dengan tanggal terapi yang sama SHALL menempatkan Sesi_Terapi yang lebih akhir disimpan di posisi lebih atas.
4. THE Modul_Terapi SHALL menampilkan setiap Sesi_Terapi dalam Histori_Terapi dengan tanggal terapi dalam format "DD MMMM YYYY", keluhan, pola penyakit, terapi yang diberikan, hasil terapi, dan biaya dalam Format_Rupiah, serta menampilkan tanda "-" untuk pola penyakit atau hasil terapi yang kosong.
5. WHEN Pengguna membuka halaman detail Pasien, THE Modul_Terapi SHALL menampilkan jumlah Sesi_Terapi yang sama dengan banyaknya Sesi_Terapi dalam Histori_Terapi Pasien tersebut dan total biaya dalam Format_Rupiah yang sama dengan jumlah biaya seluruh Sesi_Terapi milik Pasien tersebut.
6. IF Pasien belum memiliki Sesi_Terapi, THEN THE Modul_Terapi SHALL menampilkan pesan "Belum ada histori terapi", jumlah Sesi_Terapi 0, dan total biaya "Rp 0".
7. WHEN Pengguna menyimpan, mengubah, atau menghapus Sesi_Terapi milik Pasien yang halaman detailnya sedang dibuka, THE Modul_Terapi SHALL memperbarui Histori_Terapi, jumlah Sesi_Terapi, dan total biaya pada halaman tersebut tanpa Pengguna harus membuka ulang halaman.
8. IF Pasien yang diminta tidak ditemukan dalam Penyimpanan_Data, THEN THE Modul_Terapi SHALL menampilkan pesan yang menyatakan bahwa Pasien tidak ditemukan dan tidak menampilkan Histori_Terapi apa pun.
9. IF Penyimpanan_Data gagal memuat Histori_Terapi, THEN THE Modul_Terapi SHALL menampilkan pesan yang menyatakan bahwa histori terapi gagal dimuat tanpa mengubah atau menghapus Sesi_Terapi yang tersimpan.

### Requirement 8: Jadwal Kunjungan Pasien

**User Story:** Sebagai Pengguna, saya ingin mengatur jadwal kunjungan pasien, sehingga saya mengetahui pasien mana yang akan datang dan kapan.

#### Acceptance Criteria

1. WHEN Pengguna mengirim formulir jadwal kunjungan dengan Pasien yang sudah terdaftar, tanggal, dan jam (format 24 jam, presisi menit) yang terisi serta catatan opsional, THE Modul_Jadwal SHALL menyimpan Jadwal_Kunjungan baru dengan status Terjadwal, menampilkan pesan berhasil, dan menampilkan Jadwal_Kunjungan tersebut pada halaman jadwal untuk tanggal yang bersangkutan.
2. IF Pasien, tanggal, atau jam pada formulir jadwal kunjungan kosong, THEN THE Validator SHALL menolak penyimpanan, menampilkan pesan bahwa kolom tersebut wajib diisi pada setiap kolom yang kosong, dan mempertahankan isian formulir lainnya.
3. IF tanggal dan jam Jadwal_Kunjungan yang dikirim (baru maupun hasil ubah) lebih awal dari waktu perangkat saat formulir dikirim, THEN THE Validator SHALL menolak penyimpanan, menampilkan pesan "Jadwal tidak boleh di waktu yang sudah lewat", dan mempertahankan isian formulir.
4. WHEN Pengguna membuka halaman jadwal, THE Modul_Jadwal SHALL menampilkan seluruh Jadwal_Kunjungan (semua status) pada tanggal yang dipilih, dengan tanggal hari ini sebagai pilihan awal, diurutkan berdasarkan jam secara menaik.
5. IF tidak ada Jadwal_Kunjungan pada tanggal yang dipilih di halaman jadwal, THEN THE Modul_Jadwal SHALL menampilkan pesan "Tidak ada jadwal pada tanggal ini".
6. THE Modul_Jadwal SHALL menampilkan setiap Jadwal_Kunjungan dengan nama Pasien, nomor HP, tanggal, jam (format JJ:MM), catatan (dikosongkan jika tidak diisi), dan status.
7. WHEN Pengguna mengirim formulir ubah Jadwal_Kunjungan dengan isian yang lolos kriteria 2, 3, dan 12, THE Modul_Jadwal SHALL memperbarui Jadwal_Kunjungan tersebut dengan mempertahankan statusnya dan memperbarui tampilan jadwal.
8. IF isian formulir ubah Jadwal_Kunjungan tidak lolos kriteria 2, 3, atau 12, THEN THE Validator SHALL menolak perubahan dan mempertahankan Jadwal_Kunjungan yang tersimpan sebelumnya.
9. WHEN Pengguna menandai sebuah Jadwal_Kunjungan berstatus Terjadwal sebagai Selesai, THE Modul_Jadwal SHALL mengubah status menjadi Selesai dan menampilkan pilihan untuk membuka formulir Sesi_Terapi baru bagi Pasien tersebut dengan tanggal terapi terisi sesuai tanggal jadwal; jika Pengguna menolak pilihan tersebut, status tetap Selesai tanpa Sesi_Terapi dibuat.
10. WHEN Pengguna menandai sebuah Jadwal_Kunjungan berstatus Terjadwal sebagai Dibatalkan, THE Modul_Jadwal SHALL mengubah status menjadi Dibatalkan dan memperbarui tampilan jadwal.
11. WHEN Pengguna membuka halaman detail Pasien, THE Modul_Jadwal SHALL menampilkan hanya Jadwal_Kunjungan berstatus Terjadwal milik Pasien tersebut, diurutkan berdasarkan tanggal dan jam secara menaik, atau pesan "Belum ada jadwal kunjungan" jika tidak ada.
12. THE Validator SHALL membatasi panjang catatan Jadwal_Kunjungan maksimal 500 karakter dan menolak penyimpanan dengan pesan yang menunjukkan batas tersebut jika terlampaui.
13. WHEN Pengguna memilih hapus pada sebuah Jadwal_Kunjungan, THE Modul_Jadwal SHALL menampilkan dialog konfirmasi yang menyebutkan nama Pasien, tanggal, dan jam, lalu menghapus Jadwal_Kunjungan tersebut tanpa mengubah Data_Pasien maupun Sesi_Terapi hanya jika Pengguna mengonfirmasi, dan mempertahankannya tanpa perubahan jika Pengguna membatalkan.
14. IF Jadwal_Kunjungan berstatus Selesai atau Dibatalkan, THEN THE Modul_Jadwal SHALL tidak menyediakan aksi ubah, tandai Selesai, maupun tandai Dibatalkan untuk Jadwal_Kunjungan tersebut.

### Requirement 9: Laporan Pemasukan per Bulan

**User Story:** Sebagai Pengguna, saya ingin melihat laporan pemasukan biaya terapi per bulan, sehingga saya mengetahui pendapatan praktik setiap bulan.

#### Acceptance Criteria

1. WHEN Pengguna membuka halaman laporan, THE Modul_Laporan SHALL mengisi filter dengan bulan dan tahun berjalan berdasarkan tanggal perangkat dan menampilkan Laporan_Pemasukan untuk bulan dan tahun tersebut dalam waktu paling lama 2 detik.
2. WHEN Pengguna memilih bulan (Januari sampai Desember) dan tahun (2000 sampai tahun berjalan ditambah 1) pada filter, THE Modul_Laporan SHALL memperbarui Laporan_Pemasukan dalam waktu paling lama 2 detik dan menampilkan hanya Sesi_Terapi yang tanggal terapinya berada di antara tanggal 1 sampai tanggal terakhir bulan tersebut (inklusif, termasuk 29 Februari pada tahun kabisat) pada tahun yang dipilih.
3. THE Modul_Laporan SHALL menampilkan total pemasukan yang sama dengan jumlah biaya seluruh Sesi_Terapi yang lolos filter, termasuk Sesi_Terapi dengan biaya 0.
4. THE Modul_Laporan SHALL menampilkan jumlah Sesi_Terapi yang lolos filter (termasuk Sesi_Terapi dengan biaya 0) dan jumlah Pasien berbeda yang memiliki minimal satu Sesi_Terapi yang lolos filter, di mana Pasien dengan beberapa Sesi_Terapi dalam bulan tersebut dihitung satu kali.
5. THE Modul_Laporan SHALL menampilkan rincian Sesi_Terapi yang lolos filter berisi tanggal terapi dalam format "DD MMMM YYYY", nama Pasien, terapi yang diberikan, dan biaya, diurutkan berdasarkan tanggal terapi secara menaik, dan Sesi_Terapi dengan tanggal terapi yang sama diurutkan berdasarkan nama Pasien secara alfabetis menaik.
6. THE Modul_Laporan SHALL menampilkan total pemasukan dan setiap biaya pada rincian Sesi_Terapi dalam Format_Rupiah.
7. IF tidak ada Sesi_Terapi dengan tanggal terapi pada bulan dan tahun yang dipilih, THEN THE Modul_Laporan SHALL menampilkan total pemasukan "Rp 0", jumlah Sesi_Terapi 0, jumlah Pasien 0, daftar rincian kosong, dan pesan "Tidak ada pemasukan pada bulan ini".
8. THE Modul_Laporan SHALL menghasilkan Laporan_Pemasukan sehingga, untuk setiap tahun dan setiap kumpulan Sesi_Terapi, jumlah total pemasukan dari dua belas bulan (Januari sampai Desember) tahun tersebut sama dengan jumlah biaya seluruh Sesi_Terapi yang tanggal terapinya berada pada tahun tersebut.
9. IF Penyimpanan_Data gagal memuat data Sesi_Terapi saat Laporan_Pemasukan disusun, THEN THE Modul_Laporan SHALL menampilkan pesan kesalahan yang menyatakan laporan gagal dimuat, tidak menampilkan total pemasukan maupun rincian Sesi_Terapi, dan mempertahankan pilihan bulan dan tahun pada filter.

### Requirement 10: Penyimpanan Data

**User Story:** Sebagai Pengguna, saya ingin data tersimpan secara permanen, sehingga data tidak hilang saat aplikasi ditutup atau perangkat dinyalakan ulang.

#### Acceptance Criteria

1. WHEN Pengguna menyimpan, mengubah, atau menghapus Data_Pasien, Sesi_Terapi, atau Jadwal_Kunjungan, THE Penyimpanan_Data SHALL menyelesaikan penulisan perubahan tersebut secara persisten sebelum Aplikasi menampilkan pesan berhasil, sehingga perubahan tetap ada setelah Aplikasi ditutup paksa atau perangkat dinyalakan ulang segera setelah pesan berhasil tampil.
2. WHEN Aplikasi dibuka kembali setelah ditutup atau setelah perangkat dinyalakan ulang, THE Penyimpanan_Data SHALL memuat seluruh Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan yang tersimpan sebelumnya, dengan jumlah rekaman yang sama dan tanpa memuat rekaman yang telah dihapus.
3. THE Penyimpanan_Data SHALL menjamin bahwa untuk setiap Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan yang lolos pemeriksaan Validator, menyimpan lalu memuat kembali menghasilkan rekaman dengan identitas unik dan nilai setiap atribut yang identik dengan data semula (round-trip), termasuk teks yang memuat karakter non-ASCII dan teks dengan panjang maksimal yang diizinkan Validator.
4. IF proses penyimpanan, pengubahan, atau penghapusan gagal, THEN THE Aplikasi SHALL menampilkan pesan kesalahan yang menyatakan bahwa data gagal disimpan, tidak menampilkan pesan berhasil, dan mempertahankan seluruh isian formulir tanpa perubahan agar Pengguna dapat mencoba lagi.
5. IF proses penyimpanan, pengubahan, atau penghapusan gagal, THEN THE Penyimpanan_Data SHALL mempertahankan data tersimpan dalam keadaan sebelum operasi dimulai, tanpa menyimpan sebagian perubahan.
6. IF Penyimpanan_Data gagal memuat data saat Aplikasi dibuka, THEN THE Aplikasi SHALL menampilkan pesan kesalahan yang menyatakan bahwa data gagal dimuat dan SHALL NOT menimpa atau menghapus data tersimpan yang ada.
7. IF Aplikasi dibuka untuk pertama kali dan belum ada data tersimpan, THEN THE Aplikasi SHALL menampilkan daftar Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan dalam keadaan kosong tanpa menampilkan pesan kesalahan.

### Requirement 11: Tampilan Responsif dan Dukungan Android

**User Story:** Sebagai Pengguna, saya ingin aplikasi dapat digunakan di komputer maupun ponsel Android, sehingga saya dapat mengelola data di mana saja.

#### Acceptance Criteria

1. THE Aplikasi SHALL menampilkan setiap halaman dan formulir pada Modul_Pasien, Modul_Terapi, Modul_Jadwal, dan Modul_Laporan tanpa scroll horizontal serta tanpa teks, tombol, atau kotak isian yang terpotong atau saling tumpang tindih pada setiap lebar layar mulai dari 360 piksel hingga 1920 piksel.
2. WHILE lebar layar kurang dari 768 piksel, THE Aplikasi SHALL menampilkan navigasi utama dalam bentuk menu bawah atau menu lipat yang berisi menu Pasien, Jadwal, dan Laporan, dengan setiap menu dapat dicapai dalam paling banyak 2 kali ketukan dari halaman mana pun.
3. THE Aplikasi SHALL menyediakan area sentuh berukuran minimal 44 x 44 piksel untuk setiap tombol, tautan, item menu, kotak isian, dan kotak pilihan pada setiap lebar layar mulai dari 360 piksel hingga 1920 piksel.
4. WHEN Aplikasi selesai dipasang di perangkat Android, THE Aplikasi SHALL muncul di layar utama atau daftar aplikasi perangkat dengan ikon Aplikasi dan nama Aplikasi sendiri, terpisah dari ikon dan nama peramban.
5. WHILE perangkat tidak terhubung ke internet dan Aplikasi telah dibuka minimal satu kali saat perangkat terhubung ke internet, THE Aplikasi SHALL tetap dapat membuka setiap halaman serta menampilkan, menambah, mengubah, dan menghapus Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan melalui Penyimpanan_Data tanpa menampilkan pesan kesalahan koneksi.
6. WHILE lebar layar 768 piksel atau lebih, THE Aplikasi SHALL menampilkan menu Pasien, Jadwal, dan Laporan pada navigasi utama secara terus-menerus terlihat tanpa Pengguna perlu membuka menu tambahan.
7. WHEN Pengguna mengetuk ikon Aplikasi di perangkat Android, THE Aplikasi SHALL terbuka dalam tampilan layar penuh tanpa bilah alamat peramban dan menampilkan halaman utama dalam waktu paling lama 5 detik.
8. WHEN perangkat kembali terhubung ke internet setelah Pengguna menambah, mengubah, atau menghapus data saat tidak terhubung, THE Aplikasi SHALL tetap menampilkan seluruh perubahan tersebut tanpa ada data yang hilang atau tercatat ganda.

### Requirement 12: Format Tampilan Nominal dan Tanggal

**User Story:** Sebagai Pengguna, saya ingin nominal biaya dan tanggal tampil dalam format Indonesia, sehingga informasi mudah dibaca.

#### Acceptance Criteria

1. THE Aplikasi SHALL menampilkan setiap nominal biaya berupa bilangan bulat dari 0 sampai 999.999.999 dalam Format_Rupiah, yaitu awalan "Rp", diikuti tepat satu spasi, diikuti angka tanpa digit desimal dan tanpa nol di depan, dengan pemisah titik setiap tiga digit dihitung dari kanan (contoh: "Rp 0", "Rp 500", "Rp 1.000", "Rp 150.000", "Rp 999.999.999").
2. THE Aplikasi SHALL menampilkan setiap tanggal dengan format "DD MMMM YYYY", yaitu tanggal dua digit dengan nol di depan untuk tanggal 1 sampai 9, diikuti satu spasi, nama bulan lengkap Bahasa Indonesia dengan huruf awal kapital (Januari, Februari, Maret, April, Mei, Juni, Juli, Agustus, September, Oktober, November, Desember), diikuti satu spasi, dan tahun empat digit (contoh: "05 Januari 2025", "31 Desember 2024").
3. THE Aplikasi SHALL menghasilkan Format_Rupiah untuk setiap bilangan bulat biaya dari 0 sampai 999.999.999 sedemikian rupa sehingga menghapus awalan "Rp", spasi, dan seluruh titik pemisah, lalu membaca sisa angkanya sebagai bilangan bulat, menghasilkan nilai biaya semula (round-trip).
4. IF nilai biaya atau tanggal pada suatu data tidak tersedia (kosong), THEN THE Aplikasi SHALL menampilkan tanda "-" di posisi nilai tersebut sebagai pengganti "Rp 0" atau tanggal default.
5. IF nilai tanggal yang tersimpan tidak merupakan tanggal kalender yang valid (contoh: 31 Februari), THEN THE Aplikasi SHALL menampilkan tanda "-" di posisi tanggal tersebut tanpa mengubah data yang tersimpan.

### Requirement 13: Pembuatan File APK Android

**User Story:** Sebagai pemilik praktik, saya ingin Aplikasi dapat dikonversi menjadi file APK Android, sehingga Aplikasi dapat dipasang langsung di ponsel Android tanpa bergantung pada peramban.

Catatan: Requirement 11 mengatur tampilan responsif dan pemasangan Aplikasi sebagai aplikasi web; Requirement 13 mengatur keluaran berupa APK_Android. Kedua jalur pemasangan menggunakan kode sumber yang sama.

#### Acceptance Criteria

1. WHEN Proses_Build mode debug dijalankan sesuai perintah yang tercantum di Dokumentasi_Build, THE Proses_Build SHALL selesai dengan status berhasil dan menghasilkan tepat satu file APK_Debug di lokasi keluaran yang tercantum di Dokumentasi_Build, dibangun dari kode sumber web Aplikasi yang sama dengan versi web, tanpa memerlukan perubahan manual pada kode sumber Modul_Pasien, Modul_Terapi, Modul_Jadwal, Modul_Laporan, Modul_Cadangan, maupun Penyimpanan_Data.
2. WHEN Proses_Build mode rilis dijalankan dengan Kunci_Penandatanganan yang tersedia di lokasi dan dengan cara akses yang tercantum di Dokumentasi_Build, THE Proses_Build SHALL selesai dengan status berhasil dan menghasilkan tepat satu file APK_Rilis di lokasi keluaran yang tercantum di Dokumentasi_Build, yang tanda tangannya cocok dengan sertifikat Kunci_Penandatanganan tersebut.
3. THE Dokumentasi_Build SHALL memuat seluruh butir berikut: daftar perangkat lunak prasyarat beserta versi minimalnya, perintah untuk menghasilkan APK_Debug, perintah untuk menghasilkan APK_Rilis, cara membuat dan menyimpan Kunci_Penandatanganan, lokasi file APK_Android yang dihasilkan, serta cara menaikkan versionCode dan versionName.
4. WHEN Proses_Build dijalankan dua kali atau lebih dari kode sumber dan konfigurasi yang sama, THE Proses_Build SHALL menghasilkan APK_Android dengan nama Aplikasi, ikon, Package_Identifier, versionCode, dan versionName yang identik pada setiap kali dijalankan.
5. IF salah satu langkah Proses_Build gagal, termasuk karena perangkat lunak prasyarat tidak terpasang, versi prasyarat lebih rendah dari versi minimal di Dokumentasi_Build, atau Kunci_Penandatanganan tidak tersedia pada mode rilis, THEN THE Proses_Build SHALL menghentikan proses dengan status gagal, menampilkan pesan yang menyebutkan nama langkah yang gagal, dan tidak menghasilkan file APK_Android baru di lokasi keluaran.
6. WHEN APK_Debug atau APK_Rilis dipasang pada perangkat dengan Android 7.0 (API level 24) atau versi lebih baru yang belum memiliki aplikasi dengan Package_Identifier yang sama, THE APK_Android SHALL terpasang hingga selesai tanpa pesan kesalahan dari pemasang Android dan muncul di daftar aplikasi perangkat dengan nama Aplikasi dan ikon Aplikasi sendiri, bukan ikon peramban.
7. THE APK_Android SHALL menggunakan satu Package_Identifier tetap yang sama untuk seluruh versi APK_Rilis.
8. WHEN Pengguna mengetuk ikon APK_Android yang telah terpasang dan Aplikasi belum berjalan di latar belakang, THE APK_Android SHALL membuka Aplikasi dalam tampilan layar penuh tanpa bilah alamat, tab, maupun elemen antarmuka peramban lainnya, dan menampilkan Halaman_Utama dalam waktu paling lama 5 detik sejak ikon diketuk.
9. THE APK_Android SHALL menyediakan seluruh fungsi Modul_Pasien, Modul_Terapi, Modul_Jadwal, Modul_Laporan, dan Modul_Cadangan dengan perilaku yang sama seperti ditetapkan pada Requirement 1 sampai Requirement 10, Requirement 12, dan Requirement 14.
10. WHILE perangkat tidak terhubung ke internet, termasuk saat APK_Android dibuka pertama kali setelah dipasang, THE APK_Android SHALL membuka setiap halaman Aplikasi serta menampilkan, menambah, mengubah, dan menghapus Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan melalui Penyimpanan_Data tanpa menampilkan pesan kesalahan koneksi.
11. WHEN APK_Android dibuka kembali setelah ditutup, setelah dihentikan paksa, atau setelah perangkat dinyalakan ulang, THE Penyimpanan_Data SHALL memuat seluruh Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan yang telah berhasil disimpan di penyimpanan lokal perangkat sebelumnya, dengan jumlah rekaman dan nilai setiap atribut yang sama.
12. WHEN APK_Rilis dengan versionCode lebih besar dan Kunci_Penandatanganan yang sama dipasang di atas APK_Rilis yang sudah terpasang, THE APK_Android SHALL terpasang sebagai pembaruan tanpa perlu menghapus aplikasi lama dan THE Penyimpanan_Data SHALL mempertahankan seluruh Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan yang tersimpan sebelum pembaruan dengan jumlah rekaman dan nilai setiap atribut yang sama.
13. WHEN APK_Rilis versi baru dihasilkan untuk didistribusikan, THE Proses_Build SHALL menghasilkan APK_Rilis dengan versionCode yang lebih besar dari versionCode APK_Rilis sebelumnya dan versionName berformat "MAJOR.MINOR.PATCH" yang berbeda dari versionName APK_Rilis sebelumnya.
14. WHILE Aplikasi menampilkan halaman selain Halaman_Utama dan tidak ada dialog yang terbuka, WHEN Pengguna menekan Tombol_Kembali, THE APK_Android SHALL menampilkan halaman yang dibuka Pengguna tepat sebelum halaman saat ini tanpa menutup Aplikasi.
15. WHILE sebuah dialog konfirmasi atau formulir dalam dialog sedang terbuka, WHEN Pengguna menekan Tombol_Kembali, THE APK_Android SHALL menutup dialog tersebut dengan perilaku yang sama seperti memilih batal, tanpa menyimpan, mengubah, atau menghapus data apa pun, dan tetap menampilkan halaman tempat dialog dibuka.
16. WHILE Aplikasi menampilkan Halaman_Utama dan tidak ada dialog yang terbuka, WHEN Pengguna menekan Tombol_Kembali, THE APK_Android SHALL menampilkan dialog konfirmasi keluar Aplikasi yang menyediakan tepat dua pilihan, yaitu keluar dan batal.
17. WHEN Pengguna memilih keluar pada dialog konfirmasi keluar Aplikasi, THE APK_Android SHALL menutup Aplikasi sehingga Aplikasi tidak lagi tampil di layar dan THE Penyimpanan_Data SHALL mempertahankan seluruh data yang telah berhasil disimpan sehingga data tersebut dimuat kembali dengan jumlah rekaman dan nilai atribut yang sama saat Aplikasi dibuka berikutnya.
18. WHEN Pengguna memilih batal pada dialog konfirmasi keluar Aplikasi, THE APK_Android SHALL menutup dialog dan tetap menampilkan Halaman_Utama tanpa perubahan data.
19. IF APK_Rilis yang ditandatangani dengan kunci selain Kunci_Penandatanganan, atau dengan versionCode yang sama atau lebih kecil, dipasang di atas APK_Rilis yang sudah terpasang, THEN THE APK_Android yang sudah terpasang SHALL tetap tidak berubah versinya dan THE Penyimpanan_Data SHALL mempertahankan seluruh Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan dengan jumlah rekaman dan nilai setiap atribut yang sama seperti sebelum percobaan pemasangan.

### Requirement 14: Cadangan dan Pemulihan Data

**User Story:** Sebagai Pengguna, saya ingin mencadangkan dan memulihkan seluruh data ke dan dari sebuah file, sehingga data tidak hilang jika Aplikasi dihapus, data peramban dibersihkan, atau perangkat diganti.

#### Acceptance Criteria

1. WHEN Pengguna memilih ekspor data, THE Modul_Cadangan SHALL membuat tepat satu File_Cadangan berisi versi format file, waktu ekspor (tanggal dan jam perangkat saat ekspor), serta seluruh Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan yang tersimpan saat ekspor dimulai beserta identitas unik dan seluruh atributnya, lalu menampilkan pesan berhasil yang menyebutkan nama file, lokasi penyimpanannya, dan jumlah Data_Pasien, Sesi_Terapi, serta Jadwal_Kunjungan yang diekspor.
2. THE Modul_Cadangan SHALL memberi nama File_Cadangan dengan format "datapasien-cadangan-YYYYMMDD-HHmm.json" berdasarkan tanggal dan jam lokal perangkat saat ekspor dilakukan, dengan jam dalam format 24 jam (00-23) dan setiap komponen tanggal serta jam ditulis dengan angka nol di depan sesuai jumlah digitnya, contoh "datapasien-cadangan-20250105-0930.json".
3. WHEN Pengguna memilih sebuah file untuk diimpor dan file tersebut lolos seluruh pemeriksaan pada kriteria 6, THE Modul_Cadangan SHALL menampilkan dialog konfirmasi yang menyebutkan jumlah Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan di dalam file serta peringatan bahwa seluruh data yang ada saat ini akan diganti, dengan pilihan untuk mengonfirmasi dan membatalkan, tanpa mengubah data tersimpan sebelum Pengguna mengonfirmasi.
4. WHEN Pengguna mengonfirmasi impor, THE Modul_Cadangan SHALL mengganti seluruh Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan yang tersimpan dengan isi File_Cadangan melalui Penyimpanan_Data dengan mempertahankan identitas unik setiap rekaman dari file, menampilkan pesan berhasil yang menyebutkan jumlah Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan yang diimpor, dan menampilkan data hasil impor pada daftar pasien, histori terapi, dan jadwal kunjungan tanpa Pengguna perlu menutup dan membuka ulang Aplikasi.
5. WHEN Pengguna membatalkan dialog konfirmasi impor, THE Modul_Cadangan SHALL menutup dialog dan mempertahankan seluruh data yang tersimpan tanpa perubahan.
6. IF file yang dipilih untuk diimpor kosong, bukan JSON yang valid, tidak sesuai struktur File_Cadangan, memiliki versi format yang tidak didukung, memuat rekaman yang tidak lolos aturan Validator, memuat dua atau lebih rekaman sejenis dengan identitas unik yang sama, atau memuat Sesi_Terapi maupun Jadwal_Kunjungan yang terhubung dengan Pasien yang tidak ada di dalam file, THEN THE Modul_Cadangan SHALL menolak impor sebelum dialog konfirmasi ditampilkan, menampilkan pesan kesalahan yang menyebutkan alasan penolakan, dan mempertahankan seluruh data yang tersimpan tanpa perubahan.
7. IF penulisan data hasil impor oleh Penyimpanan_Data gagal, THEN THE Modul_Cadangan SHALL menampilkan pesan kesalahan yang menyatakan impor gagal dan THE Penyimpanan_Data SHALL mempertahankan data tersimpan dalam keadaan sebelum impor dimulai, tanpa menyimpan sebagian data impor, sehingga daftar pasien, histori terapi, dan jadwal kunjungan yang ditampilkan sama dengan sebelum impor.
8. THE Modul_Cadangan SHALL menjamin bahwa untuk setiap kumpulan Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan yang lolos pemeriksaan Validator, mengekspor ke File_Cadangan lalu mengimpor kembali File_Cadangan tersebut menghasilkan kumpulan rekaman dengan jumlah, identitas unik, keterhubungan dengan Pasien, dan nilai setiap atribut (termasuk tanggal, jam, dan nominal biaya) yang identik dengan data semula (round-trip), termasuk teks yang memuat karakter non-ASCII.
9. WHEN File_Cadangan yang sama diimpor dan dikonfirmasi lebih dari satu kali secara berturut-turut tanpa perubahan data lain di antaranya, THE Modul_Cadangan SHALL menghasilkan data tersimpan yang sama dengan hasil impor satu kali, tanpa rekaman ganda.
10. IF belum ada data tersimpan saat Pengguna memilih ekspor data, THEN THE Modul_Cadangan SHALL tetap membuat File_Cadangan yang valid berisi daftar Data_Pasien, Sesi_Terapi, dan Jadwal_Kunjungan kosong, dan pesan berhasil menyebutkan jumlah 0 untuk ketiganya.
11. IF pembuatan atau penyimpanan File_Cadangan saat ekspor gagal, THEN THE Modul_Cadangan SHALL menampilkan pesan kesalahan yang menyatakan ekspor gagal, tidak menampilkan pesan berhasil, dan mempertahankan seluruh data yang tersimpan tanpa perubahan.
12. WHEN Pengguna menutup pemilihan file impor tanpa memilih file, THE Modul_Cadangan SHALL tidak menampilkan dialog konfirmasi maupun pesan kesalahan dan mempertahankan seluruh data yang tersimpan tanpa perubahan.
