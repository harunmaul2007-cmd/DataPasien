// Feature: patient-therapy-management, Property 7: Hapus pasien berantai dan ringkasannya
//
// **Validates: Requirements 3.1, 3.2, 3.4, 3.5**
//
// Untuk setiap keadaan data dan pasien P di dalamnya, `deletionSummary(P)`
// mengembalikan jumlah sesi dan jadwal (semua status) milik P; setelah
// `deletePasienCascade(P)` tidak ada Pasien P maupun sesi/jadwal dengan
// pasienId P, jumlah yang terhapus sama dengan ringkasan, dan seluruh rekaman
// milik pasien lain tidak berubah. Laporan setiap bulan/tahun yang relevan
// tidak lagi memuat sesi milik P.

import Dexie from 'dexie';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildLaporan } from '../../domain/laporan';
import { deletionSummary } from '../../domain/pasienQuery';
import type { AppData } from '../../domain/types';
import { appDataNonEmptyArb } from '../../domain/__tests__/arbitraries';
import { openRepository } from '../repository';

const skenarioArb = appDataNonEmptyArb({ maxPasien: 4, maxSesi: 10, maxJadwal: 10 }).chain((data) =>
  fc.record({
    data: fc.constant(data),
    idx: fc.nat({ max: data.pasien.length - 1 }),
  }),
);

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sorted(d: AppData): AppData {
  return {
    pasien: [...d.pasien].sort(byId),
    sesi: [...d.sesi].sort(byId),
    jadwal: [...d.jadwal].sort(byId),
  };
}

/** Pasangan (bulan, tahun) dari seluruh tanggal sesi. */
function periode(data: AppData): Array<[number, number]> {
  const set = new Set(data.sesi.map((s) => s.tanggal.slice(0, 7)));
  return [...set].map((ym) => [Number(ym.slice(5, 7)), Number(ym.slice(0, 4))]);
}

let counter = 0;

describe('Property 7: Hapus pasien berantai dan ringkasannya', () => {
  it('ringkasan sesuai, rekaman P terhapus seluruhnya, data pasien lain utuh, laporan mengecualikan P', async () => {
    await fc.assert(
      fc.asyncProperty(skenarioArb, async ({ data, idx }) => {
        const target = data.pasien[idx]!;
        const pid = target.id;
        const name = `p7-hapus-berantai-${Date.now()}-${counter++}`;

        // Model: jumlah milik P (semua status jadwal) dan data yang harus tersisa.
        const sesiP = data.sesi.filter((s) => s.pasienId === pid);
        const jadwalP = data.jadwal.filter((j) => j.pasienId === pid);
        const want: AppData = sorted({
          pasien: data.pasien.filter((p) => p.id !== pid),
          sesi: data.sesi.filter((s) => s.pasienId !== pid),
          jadwal: data.jadwal.filter((j) => j.pasienId !== pid),
        });

        // Req 3.1: ringkasan menghitung sesi & jadwal milik P (0 bila tidak ada).
        const summary = deletionSummary(pid, data.sesi, data.jadwal);
        expect(summary).toEqual({ jumlahSesi: sesiP.length, jumlahJadwal: jadwalP.length, jumlahFoto: 0 });

        try {
          const repo = await openRepository(name, { requestPersist: false });
          let before: AppData;
          let after: AppData;
          try {
            await repo.replaceAll(data);
            before = await repo.loadAll();
            await repo.deletePasienCascade(pid);
            after = await repo.loadAll();
          } finally {
            repo.close();
          }

          // Req 3.2/3.5: tidak ada P maupun sesi/jadwal yatim milik P.
          expect(after.pasien.some((p) => p.id === pid)).toBe(false);
          expect(after.sesi.some((s) => s.pasienId === pid)).toBe(false);
          expect(after.jadwal.some((j) => j.pasienId === pid)).toBe(false);

          // Jumlah terhapus sama dengan ringkasan.
          expect(before.sesi.length - after.sesi.length).toBe(summary.jumlahSesi);
          expect(before.jadwal.length - after.jadwal.length).toBe(summary.jumlahJadwal);
          expect(before.pasien.length - after.pasien.length).toBe(1);

          // Rekaman pasien lain identik.
          expect(sorted(after)).toStrictEqual(want);

          // Req 3.4: laporan setiap periode tidak memuat sesi P dan sama dengan model.
          const idSesiP = new Set(sesiP.map((s) => s.id));
          for (const [bulan, tahun] of periode(data)) {
            const lap = buildLaporan(bulan, tahun, after.sesi, after.pasien);
            expect(lap.rincian.some((r) => idSesiP.has(r.id))).toBe(false);
            expect(lap).toStrictEqual(buildLaporan(bulan, tahun, want.sesi, want.pasien));
          }
        } finally {
          await Dexie.delete(name);
        }
      }),
      { numRuns: 100 },
    );
  }, 120_000);
});
