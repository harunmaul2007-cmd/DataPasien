// Feature: patient-therapy-management, Property 19: Round-trip penyimpanan
//
// **Validates: Requirements 10.2, 10.3, 13.11**
//
// Untuk setiap kumpulan rekaman valid (termasuk teks non-ASCII dan panjang
// maksimal), menulis seluruhnya melalui Repository, menghapus sebagian
// (hapus berantai pasien, hapus sesi, hapus jadwal), lalu membuka instance
// Repository baru pada basis data yang sama dan memanggil `loadAll` harus
// menghasilkan kumpulan rekaman yang identik dengan yang diharapkan, tanpa
// rekaman yang sudah dihapus.

import Dexie from 'dexie';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AppData } from '../../domain/types';
import { appDataArb } from '../../domain/__tests__/arbitraries';
import { openRepository } from '../repository';

interface Skenario {
  data: AppData;
  hapusPasien: boolean[];
  hapusSesi: boolean[];
  hapusJadwal: boolean[];
}

// Bias ke "tidak dihapus" (peluang hapus 1/4) agar sebagian besar data tetap tersisa.
const hapusArb = fc.integer({ min: 0, max: 3 }).map((n) => n === 0);

const skenarioArb: fc.Arbitrary<Skenario> = appDataArb({ maxPasien: 5, maxSesi: 8, maxJadwal: 8 }).chain((data) =>
  fc.record({
    data: fc.constant(data),
    hapusPasien: fc.array(hapusArb, { minLength: data.pasien.length, maxLength: data.pasien.length }),
    hapusSesi: fc.array(hapusArb, { minLength: data.sesi.length, maxLength: data.sesi.length }),
    hapusJadwal: fc.array(hapusArb, { minLength: data.jadwal.length, maxLength: data.jadwal.length }),
  }),
);

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Model: data yang diharapkan tersisa setelah penghapusan. */
function expected({ data, hapusPasien, hapusSesi, hapusJadwal }: Skenario): AppData {
  const pasienDihapus = new Set(data.pasien.filter((_, i) => hapusPasien[i]).map((p) => p.id));
  return {
    pasien: data.pasien.filter((p) => !pasienDihapus.has(p.id)).map((p) => ({ ...p })).sort(byId),
    sesi: data.sesi
      .filter((s, i) => !hapusSesi[i] && !pasienDihapus.has(s.pasienId))
      .map((s) => ({ ...s }))
      .sort(byId),
    jadwal: data.jadwal
      .filter((j, i) => !hapusJadwal[i] && !pasienDihapus.has(j.pasienId))
      .map((j) => ({ ...j }))
      .sort(byId),
  };
}

let counter = 0;

describe('Property 19: Round-trip penyimpanan', () => {
  it('rekaman yang ditulis lalu dibaca dari instance baru identik, tanpa rekaman terhapus', async () => {
    await fc.assert(
      fc.asyncProperty(skenarioArb, async (sk) => {
        const name = `p19-round-trip-${Date.now()}-${counter++}`;
        const want = expected(sk);
        try {
          const repo1 = await openRepository(name, { requestPersist: false });
          try {
            for (const p of sk.data.pasien) await repo1.addPasien(p);
            for (const s of sk.data.sesi) await repo1.addSesi(s);
            for (const j of sk.data.jadwal) await repo1.addJadwal(j);

            for (const [i, s] of sk.data.sesi.entries()) if (sk.hapusSesi[i]) await repo1.deleteSesi(s.id);
            for (const [i, j] of sk.data.jadwal.entries()) if (sk.hapusJadwal[i]) await repo1.deleteJadwal(j.id);
            for (const [i, p] of sk.data.pasien.entries())
              if (sk.hapusPasien[i]) await repo1.deletePasienCascade(p.id);
          } finally {
            repo1.close();
          }

          const repo2 = await openRepository(name, { requestPersist: false });
          let got: AppData;
          try {
            got = await repo2.loadAll();
          } finally {
            repo2.close();
          }

          const sorted: AppData = {
            pasien: [...got.pasien].sort(byId),
            sesi: [...got.sesi].sort(byId),
            jadwal: [...got.jadwal].sort(byId),
          };
          // toStrictEqual: jumlah, id, dan nilai setiap atribut identik (tanpa atribut tambahan).
          expect(sorted).toStrictEqual(want);
        } finally {
          await Dexie.delete(name);
        }
      }),
      { numRuns: 100 },
    );
  }, 120_000);
});
