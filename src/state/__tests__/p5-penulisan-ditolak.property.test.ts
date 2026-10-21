// Feature: patient-therapy-management, Property 5: Penulisan yang ditolak tidak mengubah data
//
// **Validates: Requirements 1.2, 1.3, 2.3, 5.10, 6.2, 8.8**
//
// Untuk setiap keadaan data dan input formulir tambah/ubah yang ditolak
// Validator (pasien, sesi, atau jadwal), keadaan data setelah pengiriman
// identik dengan sebelumnya: baik salinan di memori DataStore maupun isi
// basis data (dibaca ulang lewat `loadAll`).

import Dexie from 'dexie';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AppData, JadwalInput, PasienInput, SesiInput } from '../../domain/types';
import { validateJadwal, validatePasien, validateSesi } from '../../domain/validator';
import {
  appDataArb,
  jadwalInputArb,
  nowArb,
  pasienInputArb,
  sesiInputArb,
} from '../../domain/__tests__/arbitraries';
import { openRepository } from '../../infra/repository';
import { DataStore } from '../dataStore';

type Operasi =
  | { jenis: 'addPasien'; input: PasienInput }
  | { jenis: 'updatePasien'; id: string; input: PasienInput }
  | { jenis: 'addSesi'; pasienId: string; input: SesiInput }
  | { jenis: 'updateSesi'; id: string; input: SesiInput }
  | { jenis: 'addJadwal'; input: JadwalInput }
  | { jenis: 'updateJadwal'; id: string; input: JadwalInput };

interface Skenario {
  data: AppData;
  now: Date;
  op: Operasi;
}

const pasienDitolakArb = pasienInputArb.filter((i) => !validatePasien(i).ok);
const sesiDitolakArb = sesiInputArb.filter((i) => !validateSesi(i).ok);

function operasiArb(data: AppData, now: Date): fc.Arbitrary<Operasi> {
  const pasienIds = data.pasien.map((p) => p.id);
  const jadwalDitolakArb = jadwalInputArb(pasienIds, now).filter(
    (i) => !validateJadwal(i, now, new Set(pasienIds)).ok,
  );

  const opsi: Array<fc.Arbitrary<Operasi>> = [
    pasienDitolakArb.map((input): Operasi => ({ jenis: 'addPasien', input })),
    jadwalDitolakArb.map((input): Operasi => ({ jenis: 'addJadwal', input })),
  ];
  if (pasienIds.length > 0) {
    opsi.push(
      fc
        .tuple(fc.constantFrom(...pasienIds), pasienDitolakArb)
        .map(([id, input]): Operasi => ({ jenis: 'updatePasien', id, input })),
      fc
        .tuple(fc.constantFrom(...pasienIds), sesiDitolakArb)
        .map(([pasienId, input]): Operasi => ({ jenis: 'addSesi', pasienId, input })),
    );
  }
  if (data.sesi.length > 0) {
    opsi.push(
      fc
        .tuple(fc.constantFrom(...data.sesi.map((s) => s.id)), sesiDitolakArb)
        .map(([id, input]): Operasi => ({ jenis: 'updateSesi', id, input })),
    );
  }
  if (data.jadwal.length > 0) {
    opsi.push(
      fc
        .tuple(fc.constantFrom(...data.jadwal.map((j) => j.id)), jadwalDitolakArb)
        .map(([id, input]): Operasi => ({ jenis: 'updateJadwal', id, input })),
    );
  }
  return fc.oneof(...opsi);
}

const skenarioArb: fc.Arbitrary<Skenario> = fc
  .tuple(appDataArb({ maxPasien: 4, maxSesi: 5, maxJadwal: 5 }), nowArb)
  .chain(([data, now]) =>
    fc.record({ data: fc.constant(data), now: fc.constant(now), op: operasiArb(data, now) }),
  );

function jalankan(store: DataStore, op: Operasi): Promise<{ ok: boolean }> {
  switch (op.jenis) {
    case 'addPasien':
      return store.addPasien(op.input);
    case 'updatePasien':
      return store.updatePasien(op.id, op.input);
    case 'addSesi':
      return store.addSesi(op.pasienId, op.input);
    case 'updateSesi':
      return store.updateSesi(op.id, op.input);
    case 'addJadwal':
      return store.addJadwal(op.input);
    case 'updateJadwal':
      return store.updateJadwal(op.id, op.input);
  }
}

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

let counter = 0;

describe('Property 5: Penulisan yang ditolak tidak mengubah data', () => {
  it('input yang ditolak Validator tidak mengubah memori DataStore maupun basis data', async () => {
    await fc.assert(
      fc.asyncProperty(skenarioArb, async ({ data, now, op }) => {
        const name = `p5-ditolak-${Date.now()}-${counter++}`;
        try {
          const repo = await openRepository(name, { requestPersist: false });
          try {
            for (const p of data.pasien) await repo.addPasien(p);
            for (const s of data.sesi) await repo.addSesi(s);
            for (const j of data.jadwal) await repo.addJadwal(j);

            const store = new DataStore({ repository: repo, now: () => new Date(now.getTime()) });
            await store.load();
            expect(store.getState().status).toBe('ready');

            const stateSebelum = store.getState();
            const memoriSebelum = structuredClone(stateSebelum.data);
            const dbSebelum = sorted(await repo.loadAll());

            let notified = 0;
            const unsubscribe = store.subscribe(() => notified++);
            const result = await jalankan(store, op);
            unsubscribe();

            expect(result.ok).toBe(false);
            // Memori: tidak ada perubahan state sama sekali.
            expect(store.getState()).toBe(stateSebelum);
            expect(store.getState().data).toStrictEqual(memoriSebelum);
            expect(notified).toBe(0);
            // Basis data: isi identik dengan sebelum pengiriman.
            expect(sorted(await repo.loadAll())).toStrictEqual(dbSebelum);
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
