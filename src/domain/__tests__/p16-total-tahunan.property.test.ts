// Feature: patient-therapy-management, Property 16: Total dua belas bulan sama dengan total tahunan
//
// **Validates: Requirements 9.8**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildLaporan } from '../laporan';
import type { AppData, SesiTerapi } from '../types';
import { appDataArb, idArb, sesiArb, tanggalValidArb } from './arbitraries';

const NUM_RUNS = 200;
const MIN_YEAR = 2023;
const MAX_YEAR = 2025;

/** Tanggal terkonsentrasi di beberapa tahun agar tahun terpilih sering punya sesi. */
const tanggalSempitArb = tanggalValidArb({ minYear: MIN_YEAR, maxYear: MAX_YEAR });

/**
 * AppData dengan tanggal sesi dipadatkan ke rentang sempit, ditambah sesi
 * "yatim" (pasienId tidak terdaftar) yang harus diabaikan laporan.
 */
const skenarioArb: fc.Arbitrary<{ data: AppData; sesi: SesiTerapi[]; tahun: number }> = appDataArb({
  maxPasien: 5,
  maxSesi: 20,
  maxJadwal: 0,
}).chain((data) =>
  fc
    .tuple(
      fc.array(tanggalSempitArb, { minLength: data.sesi.length, maxLength: data.sesi.length }),
      fc.array(
        fc.tuple(sesiArb(idArb.filter((id) => !data.pasien.some((p) => p.id === id))), tanggalSempitArb),
        { maxLength: 4 },
      ),
      fc.integer({ min: MIN_YEAR - 1, max: MAX_YEAR + 1 }),
    )
    .map(([tanggal, yatim, tahun]) => {
      const sesi: SesiTerapi[] = [
        ...data.sesi.map((s, i) => ({ ...s, tanggal: tanggal[i] as string })),
        ...yatim.map(([s, t]) => ({ ...s, tanggal: t })),
      ];
      return { data, sesi, tahun };
    }),
);

describe('Property 16: Total dua belas bulan sama dengan total tahunan', () => {
  it('jumlah total buildLaporan bulan 1..12 = jumlah biaya sesi (pasien ada) bertanggal tahun Y', () => {
    fc.assert(
      fc.property(skenarioArb, ({ data, sesi, tahun }) => {
        let totalBulanan = 0;
        let jumlahSesiBulanan = 0;
        for (let bulan = 1; bulan <= 12; bulan++) {
          const lap = buildLaporan(bulan, tahun, sesi, data.pasien);
          totalBulanan += lap.total;
          jumlahSesiBulanan += lap.jumlahSesi;
        }

        const pasienIds = new Set(data.pasien.map((p) => p.id));
        const sesiTahun = sesi.filter(
          (s) => pasienIds.has(s.pasienId) && Number(s.tanggal.slice(0, 4)) === tahun,
        );
        const totalTahunan = sesiTahun.reduce((acc, s) => acc + s.biaya, 0);

        expect(totalBulanan).toBe(totalTahunan);
        expect(jumlahSesiBulanan).toBe(sesiTahun.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
