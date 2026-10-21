// Feature: patient-therapy-management, Property 18: Validasi dan format tanggal
//
// **Validates: Requirements 5.3, 12.2, 12.4, 12.5**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isTanggalValid } from '../tanggal';
import { formatTanggal } from '../format';
import {
  dateTripleArb,
  isTanggalValidModel,
  tanggalTidakValidArb,
  tanggalValidArb,
  tripleToISO,
} from './arbitraries';

const NUM_RUNS = 200;

// Daftar nama bulan independen dari format.ts sebagai oracle.
const BULAN_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function expectedFormat(y: number, m: number, d: number): string {
  return `${String(d).padStart(2, '0')} ${BULAN_ID[m - 1]} ${String(y).padStart(4, '0')}`;
}

describe('Property 18: Validasi dan format tanggal', () => {
  it('isTanggalValid menerima triple jika dan hanya jika tanggal kalender nyata', () => {
    fc.assert(
      fc.property(dateTripleArb, (t) => {
        const iso = tripleToISO(t);
        expect(isTanggalValid(iso)).toBe(isTanggalValidModel(iso));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('formatTanggal untuk triple: "DD <NamaBulan> YYYY" bila valid, "-" bila tidak', () => {
    fc.assert(
      fc.property(dateTripleArb, (t) => {
        const iso = tripleToISO(t);
        const out = formatTanggal(iso);
        if (isTanggalValidModel(iso)) {
          expect(out).toBe(expectedFormat(t.y, t.m, t.d));
          expect(out).toMatch(/^\d{2} [A-Za-z]+ \d{4}$/);
        } else {
          expect(out).toBe('-');
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('tanggal valid (termasuk 29 Feb kabisat & akhir bulan) diterima dan diformat benar', () => {
    fc.assert(
      fc.property(tanggalValidArb(), (iso) => {
        expect(isTanggalValid(iso)).toBe(true);
        const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
        expect(formatTanggal(iso)).toBe(expectedFormat(y, m, d));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('tanggal tidak valid, kosong, null, atau undefined → ditolak dan "-"', () => {
    const tidakValid = fc.oneof(
      tanggalTidakValidArb.map((s): string | null | undefined => s),
      fc.constantFrom<string | null | undefined>('', null, undefined),
    );
    fc.assert(
      fc.property(tidakValid, (s) => {
        expect(isTanggalValid(s)).toBe(false);
        expect(formatTanggal(s)).toBe('-');
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
