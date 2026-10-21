// Utilitas domain kontak telepon perangkat (Requirement 11).

import { BATAS_NAMA } from './validator';

/**
 * Normalisasi_Nomor: menghapus seluruh spasi, tanda "-", tanda ".",
 * tanda "(" dan ")", serta mempertahankan seluruh karakter lain.
 */
export function normalisasiNomor(s: string): string {
  return s.replace(/[\s\-.( )]/g, '');
}

/**
 * Potong string menjadi maksimal `max` code point.
 */
function potongCodePoint(s: string, max: number): string {
  const chars = [...s];
  if (chars.length <= max) return s;
  return chars.slice(0, max).join('');
}

/**
 * Terapkan nomor dan nama dari kontak terpilih ke isian formulir pasien:
 * - isian noHp selalu diisi hasil normalisasiNomor(nomor)
 * - isian nama hanya diisi nama kontak (dipotong maksimal 100 code point) apabila
 *   isian nama formulir saat ini kosong (setelah trim) dan nama kontak tidak kosong.
 */
export function terapkanKontak(
  form: { nama: string; noHp: string },
  kontak: { nama: string },
  nomor: string,
): { nama: string; noHp: string } {
  const noHp = normalisasiNomor(nomor);
  let nama = form.nama;

  if (form.nama.trim() === '') {
    const namaTrim = kontak.nama.trim();
    if (namaTrim.length > 0) {
      nama = potongCodePoint(namaTrim, BATAS_NAMA);
    }
  }

  return { nama, noHp };
}
