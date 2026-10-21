// Feature: patient-therapy-management, Property 4: Penambahan valid menambah tepat satu rekaman dengan identitas unik
//
// **Validates: Requirements 1.1, 1.5, 5.1, 5.2, 8.1**
//
// Untuk setiap keadaan data awal dan urutan penambahan Pasien, Sesi_Terapi,
// atau Jadwal_Kunjungan yang valid, setiap penambahan meningkatkan jumlah
// rekaman jenis tersebut tepat satu, rekaman baru memiliki id yang berbeda
// dari semua id yang sudah ada, nilainya sama dengan nilai ternormalisasi dari
// Validator, jadwal baru berstatus Terjadwal, dan seluruh rekaman lain tidak
// berubah (termasuk beberapa sesi pada tanggal yang sama).

import Dexie from 'dexie';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AppData, JadwalInput, PasienInput, SesiInput } from '../../domain/types';
import { validateJadwal, validatePasien, validateSesi } from '../../domain/validator';
import {
  appDataArb,
  BATAS,
  nowArb,
  pasienInputValidArb,
  sesiInputValidArb,
  toHHmmLocal,
  toISODateLocal,
  trimmedText,
  withPadding,
} from '../../domain/__tests__/arbitraries';
import { openRepository } from '../../infra/repository';
import { DataStore } from '../dataStore';

/** Tanggal tetap agar beberapa sesi sering jatuh pada tanggal yang sama. */
const TANGGAL_SAMA = '2024-02-29';

type Operasi =
  | { jenis: 'pasien'; input: PasienInput }
  | { jenis: 'sesi'; pemilik: number; input: SesiInput }
  | { jenis: 'jadwal'; pemilik: number; offsetMenit: number; catatan: string };

const sesiInputArb: fc.Arbitrary<SesiInput> = fc.oneof(
  sesiInputValidArb,
  sesiInputValidArb.map((s) => ({ ...s, tanggal: TANGGAL_SAMA })),
);

const operasiArb: fc.Arbitrary<Operasi> = fc.oneof(
  pasienInputValidArb.map((input): Operasi => ({ jenis: 'pasien', input })),
  fc.record({ pemilik: fc.nat(), input: sesiInputArb }).map((r): Operasi => ({ jenis: 'sesi', ...r })),
  fc
    .record({
      pemilik: fc.nat(),
      // Waktu jadwal = now + offset (≥ 0 menit) → tidak pernah lewat.
      offsetMenit: fc.oneof(fc.constantFrom(0, 1), fc.integer({ min: 0, max: 400 * 24 * 60 })),
      catatan: fc.oneof(fc.constant(''), withPadding(trimmedText(0, BATAS.catatan))),
    })
    .map((r): Operasi => ({ jenis: 'jadwal', ...r })),
);

const skenarioArb = fc.record({
  awal: appDataArb({ maxPasien: 4, maxSesi: 6, maxJadwal: 6 }),
  now: nowArb,
  operasi: fc.array(operasiArb, { minLength: 1, maxLength: 8 }),
});

function allIds(d: AppData): string[] {
  return [...d.pasien, ...d.sesi, ...d.jadwal].map((r) => r.id);
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

let counter = 0;

describe('Property 4: Penambahan valid menambah tepat satu rekaman dengan identitas unik', () => {
  it('setiap penambahan valid menambah tepat satu rekaman ternormalisasi ber-id unik tanpa mengubah rekaman lain', async () => {
    await fc.assert(
      fc.asyncProperty(skenarioArb, async ({ awal, now, operasi }) => {
        const name = `p4-penambahan-${Date.now()}-${counter++}`;
        const repo = await openRepository(name, { requestPersist: false });
        try {
          for (const p of awal.pasien) await repo.addPasien(p);
          for (const s of awal.sesi) await repo.addSesi(s);
          for (const j of awal.jadwal) await repo.addJadwal(j);

          const store = new DataStore({ repository: repo, now: () => now });
          await store.load();
          expect(store.getState().status).toBe('ready');

          for (const op of operasi) {
            const before = store.getState().data;
            const idsBefore = new Set(allIds(before));

            if (op.jenis === 'pasien') {
              const v = validatePasien(op.input);
              if (!v.ok) throw new Error('generator menghasilkan input pasien tidak valid');
              const res = await store.addPasien(op.input);
              expect(res.ok).toBe(true);
              if (!res.ok) return;
              const after = store.getState().data;
              expect(after.pasien).toHaveLength(before.pasien.length + 1);
              expect({
                nama: res.value.nama,
                alamat: res.value.alamat,
                noHp: res.value.noHp,
                umur: res.value.umur,
                jenisKelamin: res.value.jenisKelamin,
              }).toStrictEqual(v.value);
              expect(after.pasien.filter((p) => p.id !== res.value.id)).toStrictEqual(before.pasien);
              expect(after.pasien).toContainEqual(res.value);
              expect(after.sesi).toStrictEqual(before.sesi);
              expect(after.jadwal).toStrictEqual(before.jadwal);
            } else if (op.jenis === 'sesi') {
              if (before.pasien.length === 0) continue;
              const pasienId = before.pasien[op.pemilik % before.pasien.length]!.id;
              const v = validateSesi(op.input);
              if (!v.ok) throw new Error('generator menghasilkan input sesi tidak valid');
              const res = await store.addSesi(pasienId, op.input);
              expect(res.ok).toBe(true);
              if (!res.ok) return;
              const after = store.getState().data;
              expect(after.sesi).toHaveLength(before.sesi.length + 1);
              expect(idsBefore.has(res.value.id)).toBe(false);
              const { id: _id, pasienId: pid, createdAt: _c, updatedAt: _u, ...fields } = res.value;
              expect(pid).toBe(pasienId);
              expect(fields).toStrictEqual(v.value);
              expect(after.sesi.filter((s) => s.id !== res.value.id)).toStrictEqual(before.sesi);
              expect(after.sesi).toContainEqual(res.value);
              expect(after.pasien).toStrictEqual(before.pasien);
              expect(after.jadwal).toStrictEqual(before.jadwal);
            } else {
              if (before.pasien.length === 0) continue;
              const pasienId = before.pasien[op.pemilik % before.pasien.length]!.id;
              const waktu = new Date(now.getTime() + op.offsetMenit * 60_000);
              const input: JadwalInput = {
                pasienId,
                tanggal: toISODateLocal(waktu),
                jam: toHHmmLocal(waktu),
                catatan: op.catatan,
              };
              const v = validateJadwal(input, now, new Set(before.pasien.map((p) => p.id)));
              if (!v.ok) throw new Error(`generator menghasilkan input jadwal tidak valid: ${JSON.stringify(v.errors)}`);
              const res = await store.addJadwal(input);
              expect(res.ok).toBe(true);
              if (!res.ok) return;
              const after = store.getState().data;
              expect(after.jadwal).toHaveLength(before.jadwal.length + 1);
              expect(idsBefore.has(res.value.id)).toBe(false);
              expect(res.value.status).toBe('Terjadwal');
              const { id: _id, status: _s, createdAt: _c, updatedAt: _u, ...fields } = res.value;
              expect(fields).toStrictEqual(v.value);
              expect(after.jadwal.filter((j) => j.id !== res.value.id)).toStrictEqual(before.jadwal);
              expect(after.jadwal).toContainEqual(res.value);
              expect(after.pasien).toStrictEqual(before.pasien);
              expect(after.sesi).toStrictEqual(before.sesi);
            }
          }

          // Seluruh id tetap unik dan data tersimpan identik dengan memori.
          const final = store.getState().data;
          expect(new Set(allIds(final)).size).toBe(allIds(final).length);
          const persisted = await repo.loadAll();
          expect({
            pasien: [...persisted.pasien].sort(byId),
            sesi: [...persisted.sesi].sort(byId),
            jadwal: [...persisted.jadwal].sort(byId),
          }).toStrictEqual({
            pasien: [...final.pasien].sort(byId),
            sesi: [...final.sesi].sort(byId),
            jadwal: [...final.jadwal].sort(byId),
          });
        } finally {
          repo.close();
          await Dexie.delete(name);
        }
      }),
      { numRuns: 100 },
    );
  }, 180_000);
});
