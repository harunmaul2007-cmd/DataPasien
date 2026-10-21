// Model data domain aplikasi Manajemen Pasien Terapi.
// Tanggal disimpan sebagai teks kalender lokal dan jam sebagai "HH:mm"
// untuk menghindari pergeseran zona waktu.

/** Tanggal kalender lokal berformat "YYYY-MM-DD". */
export type ISODate = string;

/** Jam 24 jam berformat "HH:mm". */
export type HHmm = string;

export type JenisKelamin = 'Laki-laki' | 'Wanita';
export const JENIS_KELAMIN: readonly JenisKelamin[] = ['Laki-laki', 'Wanita'];

export interface Pasien {
  /** UUID v4 (crypto.randomUUID), tidak pernah berubah. */
  id: string;
  /** Sudah di-trim, 1–100 karakter. */
  nama: string;
  /** Sudah di-trim, 0–255 karakter. */
  alamat: string;
  /** Nomor_HP_Valid. */
  noHp: string;
  /** Bilangan bulat 0–150 atau null bila kosong. */
  umur?: number | null;
  /** 'Laki-laki' | 'Wanita' atau null bila kosong. */
  jenisKelamin?: JenisKelamin | null;
  /** Epoch ms. */
  createdAt: number;
  updatedAt: number;
}

export interface SesiTerapi {
  id: string;
  /** FK → Pasien.id */
  pasienId: string;
  tanggal: ISODate;
  /** 1–1000 karakter. */
  keluhan: string;
  /** 0–1000 karakter ("" jika kosong). Disebut "Diagnosa" pada tampilan. */
  polaPenyakit: string;
  /** 1–1000 karakter. */
  terapi: string;
  /** 0–1000 karakter ("" jika kosong). */
  hasil: string;
  /** Bilangan bulat 0–999.999.999. */
  biaya: number;
  /** Dipakai sebagai tie-break urutan histori. */
  createdAt: number;
  updatedAt: number;
}

export type StatusJadwal = 'Terjadwal' | 'Selesai' | 'Dibatalkan';

export const STATUS_JADWAL: readonly StatusJadwal[] = ['Terjadwal', 'Selesai', 'Dibatalkan'];

export interface JadwalKunjungan {
  id: string;
  pasienId: string;
  tanggal: ISODate;
  jam: HHmm;
  /** 0–500 karakter. */
  catatan: string;
  status: StatusJadwal;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Model Foto Sesi
// ---------------------------------------------------------------------------

export interface FotoMeta {
  id: string;
  /** FK → SesiTerapi.id */
  sesiId: string;
  urutan: number;
  mime: 'image/jpeg' | 'image/png';
  ukuran: number;
  lebar: number;
  tinggi: number;
  ditambahkanPada: number;
}

export interface FotoData {
  id: string;
  data: ArrayBuffer;
}

export interface FotoDiproses {
  data: ArrayBuffer;
  mime: 'image/jpeg' | 'image/png';
  ukuran: number;
  lebar: number;
  tinggi: number;
}

export interface FotoSource {
  key: string;
  load(): Promise<Blob>;
}

// ---------------------------------------------------------------------------
// Model Pengaturan Laporan (Kop & Logo)
// ---------------------------------------------------------------------------

export interface LogoMeta {
  mime: 'image/jpeg' | 'image/png';
  ukuran: number;
  lebar: number;
  tinggi: number;
  diperbaruiPada: number;
}

export interface PengaturanLaporan {
  namaPraktik: string;
  alamatPraktik: string;
  noHpPraktik: string;
  logo: LogoMeta | null;
}

export interface PengaturanInput {
  namaPraktik: string;
  alamatPraktik: string;
  noHpPraktik: string;
}

export type PengaturanFields = Omit<PengaturanLaporan, 'logo'>;
export type PengaturanField = keyof PengaturanInput;

export type DraftLogo =
  | { jenis: 'tetap' }
  | { jenis: 'baru'; foto: FotoDiproses }
  | { jenis: 'hapus' };

// ---------------------------------------------------------------------------
// Model Laporan Sesi
// ---------------------------------------------------------------------------

export interface OpsiLaporan {
  sertakanBiaya: boolean;
  sertakanFoto: boolean;
}

export interface LaporanBaris {
  label: string;
  nilai: string;
}

export interface LaporanBagian {
  judul: 'Data Pasien' | 'Sesi Terapi';
  baris: LaporanBaris[];
}

export interface LaporanKop {
  namaPraktik: string;
  alamat: string | null;
  noHp: string | null;
  adaLogo: boolean;
}

export interface LaporanModel {
  kop: LaporanKop;
  judul: 'Laporan Hasil Terapi';
  bagian: LaporanBagian[];
  foto: FotoMeta[] | null;
  tanggalDibuat: string;
  namaFile: string;
  judulBagikan: string;
}

export interface AppData {
  pasien: Pasien[];
  sesi: SesiTerapi[];
  jadwal: JadwalKunjungan[];
}

/** Jumlah rekaman per jenis (dipakai ringkasan cadangan/impor). */
export interface Counts {
  pasien: number;
  sesi: number;
  jadwal: number;
}

// ---------------------------------------------------------------------------
// Input mentah formulir (semua berupa string sebelum dinormalisasi Validator)
// ---------------------------------------------------------------------------

export interface PasienInput {
  nama: string;
  alamat: string;
  noHp: string;
  umur?: string;
  jenisKelamin?: '' | JenisKelamin | null;
}

export interface SesiInput {
  tanggal: string;
  keluhan: string;
  /** Nilai isian Diagnosa (atribut tersimpan tetap polaPenyakit). */
  polaPenyakit: string;
  terapi: string;
  hasil: string;
  /** Teks dari input biaya; divalidasi sebagai bilangan bulat 0–999.999.999. */
  biaya: string;
}

export interface JadwalInput {
  pasienId: string;
  tanggal: string;
  jam: string;
  catatan: string;
}

// ---------------------------------------------------------------------------
// Nilai ternormalisasi hasil Validator (field yang dapat diisi pengguna)
// ---------------------------------------------------------------------------

export type PasienFields = Pick<Pasien, 'nama' | 'alamat' | 'noHp' | 'umur' | 'jenisKelamin'>;

export type SesiFields = Pick<
  SesiTerapi,
  'tanggal' | 'keluhan' | 'polaPenyakit' | 'terapi' | 'hasil' | 'biaya'
>;

export type JadwalFields = Pick<JadwalKunjungan, 'pasienId' | 'tanggal' | 'jam' | 'catatan'>;

export type PasienField = keyof PasienInput;
export type SesiField = keyof SesiInput;
export type JadwalField = keyof JadwalInput;

/** Pesan kesalahan per field. */
export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type ValidationResult<T, K extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<K> };
