// Feature: patient-therapy-management, Property 11: Histori terapi sesuai model
//
// **Validates: Requirements 7.1, 7.2, 7.3, 7.5, 7.6**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildHistori } from '../histori';
import type { SesiTerapi } from '../types';
import { appDataArb, idArb, sesiFieldsArb, tanggalValidArb } from './arbitraries';

const NUM_RUNS = 200;

/**
 * Kumpulan sesi campuran milik beberapa pasien dengan kolisi yang disengaja:
 * tanggal dan createdAt diambil dari kumpulan kecil sehingga sering ada sesi
 * bertanggal sama (menguji tie-break createdAt) dan bahkan createdAt sama.
 * Sebagian pasien di `pasienIds` tidak memiliki sesi sama sekali.
 */
const skenarioArb = fc
  .record({
    pasienIds: fc.uniqueArray(idArb, { minLength: 1, maxLength: 5 }),
    tanggalPool: fc.uniqueArray(tanggalValidArb({ minYear: 2000, maxYear: 2100 }), { minLength: 1, maxLength: 3 }),
    createdPool: fc.uniqueArray(fc.integer({ min: 946_684_800_000, max: 4_102_444_800_000 }), {
      minLength: 1,
      maxLength: 3,
    }),
  })
  .chain(({ pasienIds, tanggalPool, createdPool }) => {
    const ownerArb = fc.constantFrom(...pasienIds);
    const sesiListArb = fc
      .array(
        fc.record({
          pasienId: ownerArb,
          tanggal: fc.constantFrom(...tanggalPool),
          createdAt: fc.constantFrom(...createdPool),
          fields: sesiFieldsArb,
        }),
        { maxLength: 15 },
      )
      .chain((raw) =>
        fc.uniqueArray(idArb, { minLength: raw.length, maxLength: raw.length }).map((ids) =>
          raw.map(
            ({ pasienId, tanggal, createdAt, fields }, i): SesiTerapi => ({
              ...fields,
              id: ids[i] as string,
              pasienId,
              tanggal,
              createdAt,
              updatedAt: createdAt + (fields.updatedAt - fields.createdAt),
            }),
          ),
        ),
      );
    // Target: salah satu pasien terdaftar, atau id yang tidak punya sesi sama sekali.
    const targetArb = fc.oneof(
      { arbitrary: ownerArb, weight: 4 },
      { arbitrary: idArb.filter((id) => !pasienIds.includes(id)), weight: 1 },
    );
    return fc.record({ sesi: sesiListArb, target: targetArb });
  });

/** Model urutan: true bila `a` boleh berada sebelum `b` (tanggal ↓, lalu createdAt ↓). */
function urutBenar(a: SesiTerapi, b: SesiTerapi): boolean {
  if (a.tanggal !== b.tanggal) return a.tanggal > b.tanggal;
  return a.createdAt >= b.createdAt;
}

function periksaHistori(target: string, sesi: readonly SesiTerapi[]): void {
  const snapshot = JSON.stringify(sesi);
  const h = buildHistori(target, sesi);

  // Input tidak diubah (termasuk urutan array).
  expect(JSON.stringify(sesi)).toBe(snapshot);

  // 7.1/7.6: seluruh dan hanya sesi milik pasien (sebagai multiset id, objek identik).
  const diharapkan = sesi.filter((s) => s.pasienId === target);
  expect(h.items.every((s) => s.pasienId === target)).toBe(true);
  expect([...h.items].map((s) => s.id).sort()).toEqual(diharapkan.map((s) => s.id).sort());
  for (const item of h.items) {
    expect(item).toEqual(sesi.find((s) => s.id === item.id));
  }

  // 7.2: urutan tanggal menurun lalu createdAt menurun.
  for (let i = 0; i + 1 < h.items.length; i++) {
    expect(urutBenar(h.items[i] as SesiTerapi, h.items[i + 1] as SesiTerapi)).toBe(true);
  }

  // 7.3/7.5: jumlah dan total biaya.
  expect(h.jumlah).toBe(h.items.length);
  expect(h.jumlah).toBe(diharapkan.length);
  expect(h.totalBiaya).toBe(diharapkan.reduce((t, s) => t + s.biaya, 0));
}

describe('Property 11: Histori terapi sesuai model', () => {
  it('sesi campuran dengan tanggal/createdAt bertabrakan: filter, urutan, jumlah, total', () => {
    fc.assert(
      fc.property(skenarioArb, ({ sesi, target }) => {
        periksaHistori(target, sesi);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('AppData valid: histori setiap pasien (termasuk tanpa sesi) sesuai model', () => {
    fc.assert(
      fc.property(appDataArb(), (data) => {
        for (const p of data.pasien) periksaHistori(p.id, data.sesi);
        // Total seluruh histori = total seluruh sesi (setiap sesi milik tepat satu pasien).
        const totalJumlah = data.pasien.reduce((t, p) => t + buildHistori(p.id, data.sesi).jumlah, 0);
        expect(totalJumlah).toBe(data.sesi.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('pasien tanpa sesi: histori kosong, jumlah 0, total 0', () => {
    fc.assert(
      fc.property(skenarioArb, idArb, ({ sesi }, lain) => {
        fc.pre(!sesi.some((s) => s.pasienId === lain));
        const h = buildHistori(lain, sesi);
        expect(h.items).toEqual([]);
        expect(h.jumlah).toBe(0);
        expect(h.totalBiaya).toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
