// Feature: patient-therapy-management, Property 22: Impor mengganti seluruh data dan idempoten
//
// **Validates: Requirements 14.4, 14.9**
//
// Untuk setiap keadaan data awal dan File_Cadangan valid F, mengimpor F
// menghasilkan data tersimpan yang identik dengan isi F, dan mengimpor F sekali
// lagi menghasilkan keadaan yang sama tanpa rekaman ganda.
//
// F dibangun melalui serializeBackup → parseBackup agar benar-benar berupa isi
// File_Cadangan valid. Sebagian F boleh memakai ulang rekaman (id sama, atribut
// berbeda) dari data awal untuk menguji bahwa rekaman lama tertimpa, bukan
// tergabung.

import Dexie from 'dexie';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from '../../domain/cadangan';
import type { AppData } from '../../domain/types';
import { appDataArb, nowArb } from '../../domain/__tests__/arbitraries';
import { openRepository } from '../../infra/repository';
import { DataStore } from '../dataStore';

function urut(d: AppData): AppData {
  const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { pasien: [...d.pasien].sort(byId), sesi: [...d.sesi].sort(byId), jadwal: [...d.jadwal].sort(byId) };
}

/** Memakai id pasien awal untuk sebagian pasien F (beserta relasinya) agar id bertabrakan. */
function bentrokkanId(awal: AppData, f: AppData, n: number): AppData {
  const k = Math.min(n, awal.pasien.length, f.pasien.length);
  if (k === 0) return f;
  const peta = new Map<string, string>();
  for (let i = 0; i < k; i++) peta.set(f.pasien[i]!.id, awal.pasien[i]!.id);
  const ganti = (id: string): string => peta.get(id) ?? id;
  return {
    pasien: f.pasien.map((p) => ({ ...p, id: ganti(p.id) })),
    sesi: f.sesi.map((s) => ({ ...s, pasienId: ganti(s.pasienId) })),
    jadwal: f.jadwal.map((j) => ({ ...j, pasienId: ganti(j.pasienId) })),
  };
}

const skenarioArb = fc
  .record({
    awal: appDataArb({ maxPasien: 4, maxSesi: 6, maxJadwal: 6 }),
    fMentah: appDataArb({ maxPasien: 4, maxSesi: 6, maxJadwal: 6 }),
    bentrok: fc.nat({ max: 4 }),
    waktu: nowArb,
  })
  .map(({ awal, fMentah, bentrok, waktu }) => ({ awal, f: bentrokkanId(awal, fMentah, bentrok), waktu }));

let counter = 0;

describe('Property 22: Impor mengganti seluruh data dan idempoten', () => {
  it('impor F menghasilkan data identik dengan F; impor ulang tidak mengubah keadaan', async () => {
    await fc.assert(
      fc.asyncProperty(skenarioArb, async ({ awal, f, waktu }) => {
        // File_Cadangan valid berisi F.
        const parsed = parseBackup(serializeBackup(f, waktu));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        const isiF = parsed.data;
        const counts = { pasien: isiF.pasien.length, sesi: isiF.sesi.length, jadwal: isiF.jadwal.length };

        const name = `p22-impor-${Date.now()}-${counter++}`;
        const repo = await openRepository(name, { requestPersist: false });
        try {
          // Keadaan awal sembarang di penyimpanan.
          for (const p of awal.pasien) await repo.addPasien(p);
          for (const s of awal.sesi) await repo.addSesi(s);
          for (const j of awal.jadwal) await repo.addJadwal(j);

          const store = new DataStore({ repository: repo, now: () => waktu });
          await store.load();
          expect(store.getState().status).toBe('ready');

          // Impor pertama: seluruh data diganti dengan isi F (Req 14.4).
          expect(await store.importBackup(isiF)).toStrictEqual(counts);
          const dbSetelah1 = urut(await repo.loadAll());
          expect(dbSetelah1).toStrictEqual(urut(isiF));
          expect(urut(store.getState().data)).toStrictEqual(urut(isiF));

          // Impor kedua: keadaan sama, tanpa rekaman ganda (Req 14.9).
          expect(await store.importBackup(isiF)).toStrictEqual(counts);
          const dbSetelah2 = urut(await repo.loadAll());
          expect(dbSetelah2).toStrictEqual(dbSetelah1);
          expect(urut(store.getState().data)).toStrictEqual(dbSetelah1);
          expect(dbSetelah2.pasien).toHaveLength(counts.pasien);
          expect(dbSetelah2.sesi).toHaveLength(counts.sesi);
          expect(dbSetelah2.jadwal).toHaveLength(counts.jadwal);

          // Memuat ulang dari penyimpanan menghasilkan isi F.
          const store2 = new DataStore({ repository: repo, now: () => waktu });
          await store2.load();
          expect(urut(store2.getState().data)).toStrictEqual(urut(isiF));
        } finally {
          repo.close();
          await Dexie.delete(name);
        }
      }),
      { numRuns: 100 },
    );
  }, 180_000);
});
