// Data grafik garis jumlah pasien yang terapi per hari dalam satu bulan.

import type { Pasien, SesiTerapi } from './types';

export interface TitikGrafik {
  /** Tanggal dalam bulan, 1..jumlah hari. */
  hari: number;
  /** Jumlah pasien berbeda yang terapi pada hari itu. */
  jumlahPasien: number;
}

export interface GrafikBulanan {
  titik: TitikGrafik[];
  /** Jumlah pasien berbeda yang terapi sepanjang bulan. */
  totalPasien: number;
  /** Jumlah sesi terapi sepanjang bulan. */
  totalSesi: number;
  /** Nilai harian tertinggi. */
  puncak: number;
}

export function jumlahHari(bulan: number, tahun: number): number {
  return new Date(tahun, bulan, 0).getDate();
}

/**
 * Hitung jumlah pasien berbeda per hari pada bulan/tahun terpilih. Sesi yang
 * pasiennya sudah tidak ada diabaikan (sama dengan laporan pemasukan).
 * Seorang pasien dengan dua sesi di hari yang sama dihitung satu.
 */
export function buildGrafikBulanan(
  bulan: number,
  tahun: number,
  sesi: readonly SesiTerapi[],
  pasien: readonly Pasien[],
): GrafikBulanan {
  const prefix = `${String(tahun).padStart(4, '0')}-${String(bulan).padStart(2, '0')}-`;
  const adaPasien = new Set(pasien.map((p) => p.id));
  const hari = jumlahHari(bulan, tahun);
  const perHari = Array.from({ length: hari }, () => new Set<string>());
  const semua = new Set<string>();
  let totalSesi = 0;

  for (const s of sesi) {
    if (!s.tanggal.startsWith(prefix) || !adaPasien.has(s.pasienId)) continue;
    const d = Number(s.tanggal.slice(8, 10));
    if (d < 1 || d > hari) continue;
    perHari[d - 1]!.add(s.pasienId);
    semua.add(s.pasienId);
    totalSesi++;
  }

  const titik = perHari.map((set, i) => ({ hari: i + 1, jumlahPasien: set.size }));
  return {
    titik,
    totalPasien: semua.size,
    totalSesi,
    puncak: titik.reduce((m, t) => Math.max(m, t.jumlahPasien), 0),
  };
}

/** Batas atas sumbu Y yang "bulat" (min 1) dan jarak garis bantu bilangan bulat. */
export function skalaSumbuY(puncak: number): { maks: number; langkah: number } {
  if (puncak <= 0) return { maks: 1, langkah: 1 };
  const langkah = Math.max(1, Math.ceil(puncak / 5));
  return { maks: Math.ceil(puncak / langkah) * langkah, langkah };
}
