// Histori terapi per pasien (fungsi murni, tanpa I/O).
import type { SesiTerapi } from './types';

export interface Histori {
  /** Hanya sesi milik pasien; urut tanggal menurun, lalu createdAt menurun. */
  items: SesiTerapi[];
  /** Banyaknya sesi pada histori. */
  jumlah: number;
  /** Jumlah biaya seluruh sesi pada histori. */
  totalBiaya: number;
}

/**
 * Pembanding urutan histori: tanggal menurun, lalu createdAt menurun,
 * lalu id menaik sebagai tie-break akhir agar hasil sepenuhnya deterministik.
 * Tanggal "YYYY-MM-DD" dapat dibandingkan secara leksikografis.
 */
function compareHistori(a: SesiTerapi, b: SesiTerapi): number {
  if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? 1 : -1;
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

/** Membangun Histori_Terapi seorang pasien dari kumpulan sesi. Input tidak diubah. */
export function buildHistori(pasienId: string, sesi: readonly SesiTerapi[]): Histori {
  const items = sesi.filter((s) => s.pasienId === pasienId).sort(compareHistori);
  const totalBiaya = items.reduce((sum, s) => sum + s.biaya, 0);
  return { items, jumlah: items.length, totalBiaya };
}
