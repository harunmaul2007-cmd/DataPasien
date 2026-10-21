// Format tampilan nominal dan tanggal (Requirement 12).
// formatRupiah sengaja tidak memakai Intl.NumberFormat: keluaran id-ID memakai
// spasi tak-putus (U+00A0) dan bisa berbeda antar versi WebView.

import { pad2, parseTanggal } from './tanggal';

export const NAMA_BULAN: readonly string[] = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const KOSONG = '-';

/** Menyisipkan titik setiap tiga digit dari kanan ("1234567" → "1.234.567"). */
function kelompokRibuan(digits: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    const sisa = digits.length - i;
    if (i > 0 && sisa % 3 === 0) out += '.';
    out += digits[i];
  }
  return out;
}

/**
 * "Rp 150.000" (tepat satu spasi biasa). null/undefined/bukan angka → "-".
 * Nilai pecahan dibulatkan ke bawah menuju nol; nilai negatif diberi tanda "-".
 */
export function formatRupiah(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return KOSONG;
  const bulat = Math.trunc(n);
  const tanda = bulat < 0 ? '-' : '';
  return `Rp ${tanda}${kelompokRibuan(String(Math.abs(bulat)))}`;
}

/**
 * Kebalikan formatRupiah: hapus "Rp", spasi, dan titik lalu baca sebagai
 * bilangan bulat. Mengembalikan NaN jika teks tidak dapat dibaca.
 */
export function parseRupiah(s: string): number {
  const sisa = s.replace(/^Rp/, '').replace(/[\s.]/g, '');
  if (!/^-?\d+$/.test(sisa)) return NaN;
  return Number.parseInt(sisa, 10);
}

/** "05 Januari 2025". Kosong atau bukan tanggal kalender valid → "-". */
export function formatTanggal(iso: string | null | undefined): string {
  const t = parseTanggal(iso);
  if (!t) return KOSONG;
  return `${pad2(t.hari)} ${NAMA_BULAN[t.bulan - 1] ?? ''} ${String(t.tahun).padStart(4, '0')}`;
}

/** Jam format JJ:MM ("9:5" → "09:05"). Kosong atau tidak valid → "-". */
export function formatJam(hhmm: string | null | undefined): string {
  if (typeof hhmm !== 'string') return KOSONG;
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(hhmm.trim());
  if (!m) return KOSONG;
  const jam = Number(m[1]);
  const menit = Number(m[2]);
  if (jam > 23 || menit > 59) return KOSONG;
  return `${pad2(jam)}:${pad2(menit)}`;
}

/** Format umur: 35 → "35 tahun", 0 → "0 tahun", null/undefined → "-". */
export function formatUmur(umur: number | null | undefined): string {
  if (umur === null || umur === undefined || !Number.isInteger(umur) || umur < 0) {
    return KOSONG;
  }
  return `${umur} tahun`;
}

/** Format jenis kelamin: "Laki-laki" | "Wanita", null/undefined/kosong → "-". */
export function formatJenisKelamin(jk: import('./types').JenisKelamin | null | undefined): string {
  if (jk === 'Laki-laki' || jk === 'Wanita') return jk;
  return KOSONG;
}

/** Teks kosong atau whitespace saja diubah menjadi "-", selain itu dikembalikan apa adanya. */
export function atauStrip(s: string | null | undefined): string {
  if (typeof s !== 'string' || s.trim() === '') return KOSONG;
  return s;
}

