// Feature: patient-therapy-management, Property 15: Laporan bulanan sesuai model
//
// **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.7, 6.4, 3.4**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildLaporan } from '../laporan';
import type { Pasien, SesiTerapi } from '../types';
import {
  BATAS,
  biayaArb,
  daysInMonth,
  idArb,
  pasienFieldsArb,
  sesiFieldsArb,
  trimmedText,
} from './arbitraries';

const NUM_RUNS = 200;
const TAHUN_AKHIR = new Date().getFullYear() + 1;

// Kumpulan tahun/bulan kecil agar filter sering cocok (2000 & 2024 kabisat).
const TAHUN_POOL = [2000, 2023, 2024, TAHUN_AKHIR];
const BULAN_POOL = [1, 2, 12];

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Tanggal terkonsentrasi pada beberapa bulan/tahun, bias ke 1, akhir bulan, dan 29 Feb. */
const tanggalTerkonsentrasiArb: fc.Arbitrary<string> = fc
  .tuple(fc.constantFrom(...TAHUN_POOL), fc.constantFrom(...BULAN_POOL))
  .chain(([y, m]) =>
    fc
      .oneof(
        fc.constant(1),
        fc.constant(daysInMonth(y, m)),
        fc.integer({ min: 1, max: daysInMonth(y, m) }),
      )
      .map((d) => `${y}-${pad2(m)}-${pad2(d)}`),
  );

const tanggalSesiArb = fc.oneof(
  { arbitrary: tanggalTerkonsentrasiArb, weight: 5 },
  { arbitrary: fc.constantFrom('2000-02-29', '2024-02-29'), weight: 1 },
  { arbitrary: sesiFieldsArb.map((f) => f.tanggal), weight: 1 },
);

// Nama dengan duplikat/beda kapitalisasi agar urutan sekunder teruji.
const namaArb = fc.oneof(
  { arbitrary: fc.constantFrom('Budi', 'budi', 'Ani', 'ani', 'Citra', 'Émile', 'Zaki'), weight: 3 },
  { arbitrary: trimmedText(1, BATAS.nama), weight: 1 },
);

const biayaSesiArb = fc.oneof({ arbitrary: fc.constant(0), weight: 1 }, { arbitrary: biayaArb, weight: 3 });

interface Skenario {
  pasien: Pasien[];
  sesi: SesiTerapi[];
  bulan: number;
  tahun: number;
}

const skenarioArb: fc.Arbitrary<Skenario> = fc
  .tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 15 }), fc.integer({ min: 1, max: 3 }))
  .chain(([np, ns, nOrphan]) => {
    const totalIds = np + ns + nOrphan;
    return fc
      .record({
        ids: fc.uniqueArray(idArb, { minLength: totalIds, maxLength: totalIds }),
        pf: fc.array(fc.tuple(pasienFieldsArb, namaArb), { minLength: np, maxLength: np }),
        sf: fc.array(
          fc.record({
            f: sesiFieldsArb,
            tanggal: tanggalSesiArb,
            biaya: biayaSesiArb,
            // Indeks pemilik: < np → pasien ada; selebihnya → sesi yatim (pasienId tidak terdaftar).
            owner: fc.nat({ max: np + nOrphan - 1 }),
          }),
          { minLength: ns, maxLength: ns },
        ),
        bulan: fc.oneof(fc.constantFrom(...BULAN_POOL), fc.integer({ min: 1, max: 12 })),
        tahun: fc.oneof(
          { arbitrary: fc.constantFrom(...TAHUN_POOL), weight: 4 },
          { arbitrary: fc.integer({ min: 2000, max: TAHUN_AKHIR }), weight: 1 },
        ),
      })
      .map(({ ids, pf, sf, bulan, tahun }) => {
        const pasien: Pasien[] = pf.map(([f, nama], i) => ({ id: ids[i] as string, ...f, nama }));
        const orphanIds = ids.slice(np + ns);
        const sesi: SesiTerapi[] = sf.map(({ f, tanggal, biaya, owner }, i) => ({
          ...f,
          id: ids[np + i] as string,
          pasienId: owner < np ? (pasien[owner] as Pasien).id : (orphanIds[owner - np] as string),
          tanggal,
          biaya,
        }));
        return { pasien, sesi, bulan, tahun };
      });
  });

// Oracle independen: tahun & bulan diurai secara numerik dari tanggal.
function lolosFilter(tanggal: string, bulan: number, tahun: number): boolean {
  const [y, m] = tanggal.split('-').map(Number);
  return y === tahun && m === bulan;
}

const collator = new Intl.Collator('id', { sensitivity: 'base' });

describe('Property 15: Laporan bulanan sesuai model', () => {
  it('rincian, urutan, total, jumlahSesi, dan jumlahPasien sesuai model', () => {
    fc.assert(
      fc.property(skenarioArb, ({ pasien, sesi, bulan, tahun }) => {
        const snapshot = JSON.stringify({ pasien, sesi });
        const lap = buildLaporan(bulan, tahun, sesi, pasien);

        const pasienById = new Map(pasien.map((p) => [p.id, p]));
        const expected = sesi.filter(
          (s) => pasienById.has(s.pasienId) && lolosFilter(s.tanggal, bulan, tahun),
        );

        // Tepat sesi yang lolos filter (sesi yatim dikecualikan).
        expect(lap.rincian.map((r) => r.id).sort()).toEqual(expected.map((s) => s.id).sort());

        // Isi setiap rincian sesuai sesi dan nama pasien.
        const sesiById = new Map(sesi.map((s) => [s.id, s]));
        for (const r of lap.rincian) {
          const s = sesiById.get(r.id) as SesiTerapi;
          expect(r).toEqual({
            id: s.id,
            tanggal: s.tanggal,
            namaPasien: (pasienById.get(s.pasienId) as Pasien).nama,
            terapi: s.terapi,
            biaya: s.biaya,
          });
        }

        // Urutan: tanggal menaik, lalu nama pasien menaik (case-insensitive).
        for (let i = 1; i < lap.rincian.length; i++) {
          const a = lap.rincian[i - 1]!;
          const b = lap.rincian[i]!;
          expect(a.tanggal <= b.tanggal).toBe(true);
          if (a.tanggal === b.tanggal) {
            expect(collator.compare(a.namaPasien, b.namaPasien)).toBeLessThanOrEqual(0);
          }
        }

        // Agregat (termasuk biaya 0).
        expect(lap.total).toBe(expected.reduce((acc, s) => acc + s.biaya, 0));
        expect(lap.jumlahSesi).toBe(expected.length);
        expect(lap.jumlahPasien).toBe(new Set(expected.map((s) => s.pasienId)).size);

        // Tanpa sesi lolos → laporan kosong (Req 9.7).
        if (expected.length === 0) {
          expect(lap).toEqual({ total: 0, jumlahSesi: 0, jumlahPasien: 0, rincian: [] });
        }

        // Input tidak dimutasi.
        expect(JSON.stringify({ pasien, sesi })).toBe(snapshot);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('29 Februari tahun kabisat tercakup pada laporan Februari', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(2000, 2024),
        pasienFieldsArb,
        sesiFieldsArb,
        biayaSesiArb,
        (tahun, pf, sf, biaya) => {
          const p: Pasien = { id: 'p1', ...pf };
          const s: SesiTerapi = { ...sf, id: 's1', pasienId: 'p1', tanggal: `${tahun}-02-29`, biaya };
          const lap = buildLaporan(2, tahun, [s], [p]);
          expect(lap.rincian.map((r) => r.id)).toEqual(['s1']);
          expect(lap.total).toBe(biaya);
          expect(lap.jumlahSesi).toBe(1);
          expect(lap.jumlahPasien).toBe(1);
          expect(buildLaporan(3, tahun, [s], [p]).jumlahSesi).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
