// Feature: patient-therapy-management, Property 13: Tampilan jadwal per tanggal dan per pasien
//
// **Validates: Requirements 8.4, 8.11**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { jadwalPadaTanggal, jadwalTerjadwalPasien } from '../jadwal';
import type { JadwalKunjungan } from '../types';
import { appDataArb, idArb, jadwalArb, jamValidArb, statusJadwalArb, tanggalValidArb } from './arbitraries';

const NUM_RUNS = 200;

/**
 * Kumpulan jadwal dengan banyak tabrakan: tanggal, jam, dan pasien diambil dari
 * pool kecil sehingga beberapa jadwal sering jatuh pada tanggal/jam/pasien yang
 * sama. id dijamin unik.
 */
const skenarioArb = fc
  .record({
    tanggalPool: fc.uniqueArray(tanggalValidArb({ minYear: 2000, maxYear: 2100 }), { minLength: 1, maxLength: 3 }),
    jamPool: fc.uniqueArray(jamValidArb, { minLength: 1, maxLength: 4 }),
    pasienPool: fc.uniqueArray(idArb, { minLength: 1, maxLength: 3 }),
  })
  .chain(({ tanggalPool, jamPool, pasienPool }) =>
    fc
      .uniqueArray(
        fc
          .tuple(
            jadwalArb(fc.constantFrom(...pasienPool), statusJadwalArb),
            fc.constantFrom(...tanggalPool),
            fc.constantFrom(...jamPool),
          )
          .map(([j, tanggal, jam]): JadwalKunjungan => ({ ...j, tanggal, jam })),
        { maxLength: 15, selector: (j) => j.id },
      )
      .map((jadwal) => ({ jadwal, tanggalPool, pasienPool })),
  );

/** Skenario dari AppData penuh (relasi konsisten), sebagai variasi tambahan. */
const skenarioAppDataArb = appDataArb({ maxJadwal: 15 }).map((d) => ({
  jadwal: d.jadwal,
  tanggalPool: d.jadwal.map((j) => j.tanggal),
  pasienPool: d.pasien.map((p) => p.id),
}));

const semuaSkenario = fc.oneof(
  { arbitrary: skenarioArb, weight: 4 },
  { arbitrary: skenarioAppDataArb, weight: 1 },
);

/** Pilih tanggal kueri: sebagian besar dari tanggal yang ada, kadang tanggal acak. */
function tanggalKueriArb(pool: string[]): fc.Arbitrary<string> {
  const acak = tanggalValidArb({ minYear: 2000, maxYear: 2100 });
  return pool.length > 0 ? fc.oneof({ arbitrary: fc.constantFrom(...pool), weight: 4 }, { arbitrary: acak, weight: 1 }) : acak;
}

function pasienKueriArb(pool: string[]): fc.Arbitrary<string> {
  return pool.length > 0 ? fc.oneof({ arbitrary: fc.constantFrom(...pool), weight: 4 }, { arbitrary: idArb, weight: 1 }) : idArb;
}

function ids(list: JadwalKunjungan[]): string[] {
  return list.map((j) => j.id).sort();
}

/** Tie-break oracle: createdAt menaik, lalu id menaik (perbandingan biner). */
function tieBreakOk(a: JadwalKunjungan, b: JadwalKunjungan): boolean {
  return a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id <= b.id);
}

describe('Property 13: Tampilan jadwal per tanggal dan per pasien', () => {
  it('jadwalPadaTanggal: seluruh dan hanya jadwal bertanggal d (semua status), urut jam menaik', () => {
    fc.assert(
      fc.property(
        semuaSkenario.chain((s) => fc.tuple(fc.constant(s.jadwal), tanggalKueriArb(s.tanggalPool))),
        ([jadwal, d]) => {
          const snapshot = JSON.parse(JSON.stringify(jadwal)) as JadwalKunjungan[];
          const hasil = jadwalPadaTanggal(d, jadwal);

          // Seluruh dan hanya jadwal bertanggal d.
          expect(hasil.every((j) => j.tanggal === d)).toBe(true);
          expect(ids(hasil)).toEqual(ids(jadwal.filter((j) => j.tanggal === d)));

          // Urut jam menaik, tie-break createdAt lalu id.
          for (let i = 1; i < hasil.length; i++) {
            const a = hasil[i - 1] as JadwalKunjungan;
            const b = hasil[i] as JadwalKunjungan;
            expect(a.jam <= b.jam).toBe(true);
            if (a.jam === b.jam) expect(tieBreakOk(a, b)).toBe(true);
          }

          // Rekaman dikembalikan apa adanya dan input tidak dimutasi.
          const byId = new Map(jadwal.map((j) => [j.id, j]));
          for (const j of hasil) expect(j).toEqual(byId.get(j.id));
          expect(jadwal).toEqual(snapshot);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('jadwalTerjadwalPasien: seluruh dan hanya jadwal Terjadwal milik p, urut tanggal lalu jam menaik', () => {
    fc.assert(
      fc.property(
        semuaSkenario.chain((s) => fc.tuple(fc.constant(s.jadwal), pasienKueriArb(s.pasienPool))),
        ([jadwal, p]) => {
          const snapshot = JSON.parse(JSON.stringify(jadwal)) as JadwalKunjungan[];
          const hasil = jadwalTerjadwalPasien(p, jadwal);

          expect(hasil.every((j) => j.pasienId === p && j.status === 'Terjadwal')).toBe(true);
          expect(ids(hasil)).toEqual(ids(jadwal.filter((j) => j.pasienId === p && j.status === 'Terjadwal')));

          for (let i = 1; i < hasil.length; i++) {
            const a = hasil[i - 1] as JadwalKunjungan;
            const b = hasil[i] as JadwalKunjungan;
            const ka = `${a.tanggal} ${a.jam}`;
            const kb = `${b.tanggal} ${b.jam}`;
            expect(ka <= kb).toBe(true);
            if (ka === kb) expect(tieBreakOk(a, b)).toBe(true);
          }

          const byId = new Map(jadwal.map((j) => [j.id, j]));
          for (const j of hasil) expect(j).toEqual(byId.get(j.id));
          expect(jadwal).toEqual(snapshot);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
