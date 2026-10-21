// Validator formulir: fungsi murni yang menormalisasi input mentah dan
// mengumpulkan seluruh kesalahan per field sekaligus (Req 1.8, 5.9).
// Panjang teks dihitung per code point ([...s].length) sehingga emoji dan
// karakter non-ASCII lain dihitung satu karakter.

import { isTanggalValid, parseTanggal } from './tanggal';
import type {
  FieldErrors,
  JadwalField,
  JadwalFields,
  JadwalInput,
  PasienField,
  PasienFields,
  PasienInput,
  PengaturanField,
  PengaturanFields,
  PengaturanInput,
  SesiField,
  SesiFields,
  SesiInput,
  ValidationResult,
} from './types';

export { isTanggalValid };

export const BATAS_NAMA = 100;
export const BATAS_ALAMAT = 255;
export const BATAS_TEKS_SESI = 1000;
export const BATAS_CATATAN = 500;
export const BATAS_BIAYA = 999_999_999;
export const BATAS_NAMA_PRAKTIK = 100;
export const BATAS_ALAMAT_PRAKTIK = 255;

export const PESAN = {
  namaWajib: 'Nama wajib diisi',
  namaMaks: 'Nama maksimal 100 karakter',
  alamatMaks: 'Alamat maksimal 255 karakter',
  noHpTidakValid: 'Nomor HP tidak valid',
  umurTidakValid: 'Umur harus berupa angka 0 sampai 150',
  jenisKelaminTidakValid: 'Jenis kelamin tidak valid',
  namaPraktikWajib: 'Nama praktik wajib diisi',
  namaPraktikMaks: 'Nama praktik maksimal 100 karakter',
  alamatPraktikMaks: 'Alamat praktik maksimal 255 karakter',
  noHpPraktikTidakValid: 'Nomor HP praktik tidak valid',
  tanggalTerapiWajib: 'Tanggal terapi wajib diisi',
  keluhanWajib: 'Keluhan wajib diisi',
  terapiWajib: 'Terapi yang diberikan wajib diisi',
  keluhanMaks: 'Keluhan melebihi batas 1000 karakter',
  polaPenyakitMaks: 'Diagnosa melebihi batas 1000 karakter',
  terapiMaks: 'Terapi yang diberikan melebihi batas 1000 karakter',
  hasilMaks: 'Hasil terapi melebihi batas 1000 karakter',
  biayaTidakValid: 'Biaya harus berupa angka 0 atau lebih',
  pasienWajib: 'Pasien wajib diisi',
  tanggalWajib: 'Tanggal wajib diisi',
  jamWajib: 'Jam wajib diisi',
  jadwalLewat: 'Jadwal tidak boleh di waktu yang sudah lewat',
  catatanMaks: 'Catatan maksimal 500 karakter',
} as const;

const JAM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const BIAYA_RE = /^\d+$/;

/** Panjang string dalam code point. */
export function panjangKarakter(s: string): number {
  return [...s].length;
}

/** True jika s berformat "HH:mm" 24 jam. */
export function isJamValid(s: string): boolean {
  return JAM_RE.test(s);
}

/**
 * Nomor_HP_Valid: hanya angka dengan "+" opsional di depan; awalan
 * 08 | 628 | +628; total digit 10–15.
 */
export function isNomorHpValid(s: string): boolean {
  if (!/^\+?\d+$/.test(s)) return false;
  if (!/^(08|628|\+628)/.test(s)) return false;
  const digits = s.replace('+', '').length;
  return digits >= 10 && digits <= 15;
}

/**
 * Parse umur: bilangan bulat 0 sampai 150. Nol di depan diizinkan.
 * String kosong atau whitespace saja menghasilkan null.
 */
export function parseUmur(s: string): { ok: true; value: number | null } | { ok: false } {
  const trimmed = s.trim();
  if (trimmed === '') return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false };
  const stripped = trimmed.replace(/^0+/, '');
  if (stripped.length > 3) return { ok: false };
  const val = Number(trimmed);
  if (val >= 0 && val <= 150) {
    return { ok: true, value: val };
  }
  return { ok: false };
}

function hasil<T, K extends string>(value: T, errors: FieldErrors<K>): ValidationResult<T, K> {
  return Object.keys(errors).length === 0 ? { ok: true, value } : { ok: false, errors };
}

export function validatePasien(
  input: PasienInput,
): ValidationResult<PasienFields, PasienField> {
  const nama = input.nama.trim();
  const alamat = input.alamat.trim();
  const noHp = input.noHp.trim();
  const errors: FieldErrors<PasienField> = {};

  if (nama.length === 0) errors.nama = PESAN.namaWajib;
  else if (panjangKarakter(nama) > BATAS_NAMA) errors.nama = PESAN.namaMaks;

  if (panjangKarakter(alamat) > BATAS_ALAMAT) errors.alamat = PESAN.alamatMaks;

  if (!isNomorHpValid(noHp)) errors.noHp = PESAN.noHpTidakValid;

  const parsedUmur = parseUmur(input.umur ?? '');
  let umur: number | null = null;
  if (!parsedUmur.ok) {
    errors.umur = PESAN.umurTidakValid;
  } else {
    umur = parsedUmur.value;
  }

  const jkRaw = input.jenisKelamin;
  let jenisKelamin: 'Laki-laki' | 'Wanita' | null = null;
  if (jkRaw === 'Laki-laki' || jkRaw === 'Wanita') {
    jenisKelamin = jkRaw;
  } else if (jkRaw !== undefined && jkRaw !== null && String(jkRaw).trim() !== '') {
    errors.jenisKelamin = PESAN.jenisKelaminTidakValid;
  }

  return hasil({ nama, alamat, noHp, umur, jenisKelamin }, errors);
}

export function validatePengaturan(
  input: PengaturanInput,
): ValidationResult<PengaturanFields, PengaturanField> {
  const namaPraktik = input.namaPraktik.trim();
  const alamatPraktik = input.alamatPraktik.trim();
  const noHpPraktik = input.noHpPraktik.trim();
  const errors: FieldErrors<PengaturanField> = {};

  if (namaPraktik.length === 0) {
    errors.namaPraktik = PESAN.namaPraktikWajib;
  } else if (panjangKarakter(namaPraktik) > BATAS_NAMA_PRAKTIK) {
    errors.namaPraktik = PESAN.namaPraktikMaks;
  }

  if (panjangKarakter(alamatPraktik) > BATAS_ALAMAT_PRAKTIK) {
    errors.alamatPraktik = PESAN.alamatPraktikMaks;
  }

  if (noHpPraktik.length > 0 && !isNomorHpValid(noHpPraktik)) {
    errors.noHpPraktik = PESAN.noHpPraktikTidakValid;
  }

  return hasil({ namaPraktik, alamatPraktik, noHpPraktik }, errors);
}

export function validateSesi(input: SesiInput): ValidationResult<SesiFields, SesiField> {
  const tanggal = input.tanggal;
  const keluhan = input.keluhan.trim();
  const polaPenyakit = input.polaPenyakit.trim();
  const terapi = input.terapi.trim();
  const hasilTerapi = input.hasil.trim();
  const biayaTeks = input.biaya.trim();
  const errors: FieldErrors<SesiField> = {};

  if (!isTanggalValid(tanggal)) errors.tanggal = PESAN.tanggalTerapiWajib;

  if (keluhan.length === 0) errors.keluhan = PESAN.keluhanWajib;
  else if (panjangKarakter(keluhan) > BATAS_TEKS_SESI) errors.keluhan = PESAN.keluhanMaks;

  if (panjangKarakter(polaPenyakit) > BATAS_TEKS_SESI) {
    errors.polaPenyakit = PESAN.polaPenyakitMaks;
  }

  if (terapi.length === 0) errors.terapi = PESAN.terapiWajib;
  else if (panjangKarakter(terapi) > BATAS_TEKS_SESI) errors.terapi = PESAN.terapiMaks;

  if (panjangKarakter(hasilTerapi) > BATAS_TEKS_SESI) errors.hasil = PESAN.hasilMaks;

  let biaya = 0;
  if (!BIAYA_RE.test(biayaTeks)) {
    errors.biaya = PESAN.biayaTidakValid;
  } else {
    biaya = Number(biayaTeks);
    if (biaya > BATAS_BIAYA) errors.biaya = PESAN.biayaTidakValid;
  }

  return hasil(
    { tanggal, keluhan, polaPenyakit, terapi, hasil: hasilTerapi, biaya },
    errors,
  );
}

export interface ValidateJadwalOptions {
  /**
   * Lewati aturan "jadwal tidak boleh lewat". Dipakai saat impor cadangan
   * karena jadwal historis sah.
   */
  abaikanWaktuLewat?: boolean;
}

/** Epoch ms waktu lokal dari tanggal "YYYY-MM-DD" dan jam "HH:mm". */
function waktuLokal(tanggal: string, jam: string): number | null {
  const t = parseTanggal(tanggal);
  if (!t || !isJamValid(jam)) return null;
  const d = new Date(2000, 0, 1, 0, 0, 0, 0);
  d.setFullYear(t.tahun, t.bulan - 1, t.hari);
  d.setHours(Number(jam.slice(0, 2)), Number(jam.slice(3, 5)), 0, 0);
  return d.getTime();
}

/** `now` dibulatkan ke bawah ke menit (waktu lokal). */
function potongKeMenit(now: Date): number {
  const d = new Date(now.getTime());
  d.setSeconds(0, 0);
  return d.getTime();
}

export function validateJadwal(
  input: JadwalInput,
  now: Date,
  pasienIds: ReadonlySet<string>,
  options: ValidateJadwalOptions = {},
): ValidationResult<JadwalFields, JadwalField> {
  const { pasienId, tanggal, jam } = input;
  const catatan = input.catatan.trim();
  const errors: FieldErrors<JadwalField> = {};

  // Pasien kosong atau tidak terdaftar sama-sama berarti belum dipilih.
  if (pasienId.length === 0 || !pasienIds.has(pasienId)) errors.pasienId = PESAN.pasienWajib;

  const tanggalOk = isTanggalValid(tanggal);
  const jamOk = isJamValid(jam);
  if (!tanggalOk) errors.tanggal = PESAN.tanggalWajib;
  if (!jamOk) errors.jam = PESAN.jamWajib;

  if (tanggalOk && jamOk && !options.abaikanWaktuLewat) {
    const waktu = waktuLokal(tanggal, jam);
    if (waktu !== null && waktu < potongKeMenit(now)) {
      // Pesan ditempatkan pada field tanggal (kolom waktu jadwal).
      errors.tanggal = PESAN.jadwalLewat;
    }
  }

  if (panjangKarakter(catatan) > BATAS_CATATAN) errors.catatan = PESAN.catatanMaks;

  return hasil({ pasienId, tanggal, jam, catatan }, errors);
}
