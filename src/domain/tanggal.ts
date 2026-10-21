// Utilitas tanggal kalender lokal. Tanggal diperlakukan sebagai teks
// "YYYY-MM-DD" tanpa konversi zona waktu.

import type { ISODate } from './types';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Angka dua digit dengan nol di depan (5 → "05"). */
export function pad2(n: number): string {
  return n < 10 && n >= 0 ? `0${n}` : String(n);
}

/** Tahun kabisat menurut kalender Gregorian (proleptik). */
export function isTahunKabisat(tahun: number): boolean {
  return (tahun % 4 === 0 && tahun % 100 !== 0) || tahun % 400 === 0;
}

/** Jumlah hari dalam bulan (bulan 1–12). */
export function jumlahHari(tahun: number, bulan: number): number {
  switch (bulan) {
    case 2:
      return isTahunKabisat(tahun) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/** Memecah "YYYY-MM-DD" yang valid menjadi angka; null jika tidak valid. */
export function parseTanggal(
  s: string | null | undefined,
): { tahun: number; bulan: number; hari: number } | null {
  if (typeof s !== 'string') return null;
  const m = ISO_DATE_RE.exec(s);
  if (!m) return null;
  const tahun = Number(m[1]);
  const bulan = Number(m[2]);
  const hari = Number(m[3]);
  if (bulan < 1 || bulan > 12) return null;
  if (hari < 1 || hari > jumlahHari(tahun, bulan)) return null;
  return { tahun, bulan, hari };
}

/** True jika s berformat "YYYY-MM-DD" dan merupakan tanggal kalender nyata. */
export function isTanggalValid(s: string | null | undefined): boolean {
  return parseTanggal(s) !== null;
}

/** Tanggal hari ini menurut jam perangkat (lokal), format "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): ISODate {
  const y = String(now.getFullYear()).padStart(4, '0');
  return `${y}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}
