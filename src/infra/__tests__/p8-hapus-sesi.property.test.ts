// Feature: patient-therapy-management, Property 8: Hapus sesi hanya menghapus satu sesi
//
// **Validates: Requirements 6.3**
//
// Untuk setiap keadaan data dan sesi S, setelah menghapus S melalui Repository:
// jumlah sesi milik pasien S berkurang tepat satu, S tidak lagi ada, dan
// seluruh Pasien, Jadwal_Kunjungan, serta sesi lain tidak berubah.

import Dexie from 'dexie';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AppData } from '../../domain/types';
import { appDataArb } from '../../domain/__tests__/arbitraries';
import { openRepository } from '../repository';

/** Keadaan data dengan minimal satu sesi, beserta indeks sesi yang akan dihapus. */
const skenarioArb = appDataArb({ maxPasien: 4, maxSesi: 8, maxJadwal: 6 })
  .filter((d) => d.sesi.length > 0)
  .chain((data) => fc.record({ data: fc.constant(data), idx: fc.nat({ max: data.sesi.length - 1 }) }));

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sorted(d: AppData): AppData {
  return {
    pasien: d.pasien.map((r) => ({ ...r })).sort(byId),
    sesi: d.sesi.map((r) => ({ ...r })).sort(byId),
    jadwal: d.jadwal.map((r) => ({ ...r })).sort(byId),
  };
}

let counter = 0;

describe('Property 8: Hapus sesi hanya menghapus satu sesi', () => {
  it('hanya sesi S yang hilang; pasien, jadwal, dan sesi lain tidak berubah', async () => {
    await fc.assert(
      fc.asyncProperty(skenarioArb, async ({ data, idx }) => {
        const name = `p8-hapus-sesi-${Date.now()}-${counter++}`;
        const target = data.sesi[idx]!;
        try {
          const repo = await openRepository(name, { requestPersist: false });
          try {
            await repo.replaceAll(data);
            const before = await repo.loadAll();
            await repo.deleteSesi(target.id);
            const after = await repo.loadAll();

            const milik = (d: AppData) => d.sesi.filter((s) => s.pasienId === target.pasienId).length;
            expect(milik(after)).toBe(milik(before) - 1);
            expect(after.sesi.some((s) => s.id === target.id)).toBe(false);

            const want = sorted({ ...data, sesi: data.sesi.filter((s) => s.id !== target.id) });
            expect(sorted(after)).toStrictEqual(want);
          } finally {
            repo.close();
          }
        } finally {
          await Dexie.delete(name);
        }
      }),
      { numRuns: 100 },
    );
  }, 120_000);
});
