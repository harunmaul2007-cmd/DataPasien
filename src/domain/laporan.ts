// Penyusunan Laporan_Pemasukan bulanan (fungsi murni, tanpa memutasi input).

import { pad2 } from './tanggal';
import type { Pasien, SesiTerapi } from './types';

export interface RincianLaporan {
  id: string;
  tanggal: string;
  namaPasien: string;
  terapi: string;
  biaya: number;
}

export interface Laporan {
  total: number;
  jumlahSesi: number;
  /** Banyaknya pasienId berbeda pada rincian. */
  jumlahPasien: number;
  /** Urut tanggal menaik, lalu nama pasien menaik (case-insensitive), lalu id. */
  rincian: RincianLaporan[];
}

export const TAHUN_MINIMAL = 2000;

const collator = new Intl.Collator('id', { sensitivity: 'base' });

function compareRincian(a: RincianLaporan, b: RincianLaporan): number {
  // "YYYY-MM-DD" dapat dibandingkan secara leksikografis.
  if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
  const byNama = collator.compare(a.namaPasien, b.namaPasien);
  if (byNama !== 0) return byNama;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Laporan pemasukan untuk bulan (1–12) dan tahun tertentu.
 * Filter memakai prefiks "YYYY-MM-" sehingga seluruh hari dalam bulan
 * (termasuk 29 Februari) tercakup tanpa aritmetika tanggal. Sesi yang
 * pasiennya tidak ada diabaikan. Req 3.4, 6.4, 9.2–9.5, 9.7, 9.8
 */
export function buildLaporan(
  bulan: number,
  tahun: number,
  sesi: readonly SesiTerapi[],
  pasien: readonly Pasien[],
): Laporan {
  const prefix = `${String(tahun).padStart(4, '0')}-${pad2(bulan)}-`;
  const namaById = new Map<string, string>();
  for (const p of pasien) namaById.set(p.id, p.nama);

  const rincian: RincianLaporan[] = [];
  const pasienIds = new Set<string>();
  let total = 0;

  for (const s of sesi) {
    if (!s.tanggal.startsWith(prefix)) continue;
    const namaPasien = namaById.get(s.pasienId);
    if (namaPasien === undefined) continue;
    rincian.push({
      id: s.id,
      tanggal: s.tanggal,
      namaPasien,
      terapi: s.terapi,
      biaya: s.biaya,
    });
    pasienIds.add(s.pasienId);
    total += s.biaya;
  }

  rincian.sort(compareRincian);
  return { total, jumlahSesi: rincian.length, jumlahPasien: pasienIds.size, rincian };
}

/** Pilihan tahun pada filter laporan: 2000 sampai tahun berjalan + 1 (menaik). Req 9.2 */
export function pilihanTahun(now: Date = new Date()): number[] {
  const akhir = now.getFullYear() + 1;
  const hasil: number[] = [];
  for (let t = TAHUN_MINIMAL; t <= akhir; t++) hasil.push(t);
  return hasil;
}
