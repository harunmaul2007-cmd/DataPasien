// Feature: patient-therapy-management, Property 10: Tanggal terapi terakhir
//
// **Validates: Requirements 4.1, 4.7**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { lastTherapyDate } from '../pasienQuery';
import { formatTanggal } from '../format';
import type { SesiTerapi } from '../types';
import { appDataArb, idArb, sesiArb } from './arbitraries';

const NUM_RUNS = 200;

/** Oracle: tanggal maksimum sesi milik pasien (urut kronologis via Y/M/D numerik), atau null. */
function modelLastDate(pasienId: string, sesi: readonly SesiTerapi[]): string | null {
  const milik = sesi.filter((s) => s.pasienId === pasienId).map((s) => s.tanggal);
  if (milik.length === 0) return null;
  const key = (t: string): number => {
    const [y, m, d] = t.split('-').map(Number) as [number, number, number];
    return y * 10_000 + m * 100 + d;
  };
  return milik.reduce((a, b) => (key(b) > key(a) ? b : a));
}

describe('Property 10: Tanggal terapi terakhir', () => {
  it('mengembalikan tanggal maksimum sesi milik pasien, atau null bila tidak ada sesi', () => {
    fc.assert(
      fc.property(appDataArb({ maxPasien: 5, maxSesi: 15, maxJadwal: 0 }), (data) => {
        for (const p of data.pasien) {
          const hasil = lastTherapyDate(p.id, data.sesi);
          expect(hasil).toBe(modelLastDate(p.id, data.sesi));
          if (hasil === null) {
            expect(data.sesi.some((s) => s.pasienId === p.id)).toBe(false);
            // Req 4.7: ditampilkan "-"
            expect(formatTanggal(hasil)).toBe('-');
          } else {
            const milik = data.sesi.filter((s) => s.pasienId === p.id);
            expect(milik.some((s) => s.tanggal === hasil)).toBe(true);
            expect(milik.every((s) => s.tanggal <= hasil)).toBe(true);
            expect(formatTanggal(hasil)).not.toBe('-');
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('tidak terpengaruh urutan sesi dan sesi milik pasien lain', () => {
    fc.assert(
      fc.property(
        idArb,
        fc.array(sesiArb(), { maxLength: 10 }),
        fc.array(fc.nat(), { maxLength: 10 }),
        (pid, lainnya, tanggalIdx) => {
          // Sebagian sesi dialihkan ke `pid` untuk mencampur milik dan bukan milik.
          const sesi = lainnya.map((s, i) => (tanggalIdx[i] !== undefined && tanggalIdx[i] % 2 === 0 ? { ...s, pasienId: pid } : s));
          const hasil = lastTherapyDate(pid, sesi);
          expect(hasil).toBe(modelLastDate(pid, sesi));
          expect(lastTherapyDate(pid, [...sesi].reverse())).toBe(hasil);
          const tanpaMilik = sesi.filter((s) => s.pasienId !== pid);
          expect(lastTherapyDate(pid, tanpaMilik)).toBeNull();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
