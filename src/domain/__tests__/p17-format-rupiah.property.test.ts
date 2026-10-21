// Feature: patient-therapy-management, Property 17: Format Rupiah benar dan dapat dibalik
// **Validates: Requirements 12.1, 12.3, 9.6**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatRupiah, parseRupiah } from '../format';
import { biayaArb } from './arbitraries';

const POLA_RUPIAH = /^Rp (0|[1-9]\d{0,2}(\.\d{3})*)$/;

describe('Property 17: Format Rupiah benar dan dapat dibalik', () => {
  it('formatRupiah(n) cocok pola dan dapat dibaca kembali menjadi n', () => {
    fc.assert(
      fc.property(biayaArb, (n) => {
        const teks = formatRupiah(n);
        expect(teks).toMatch(POLA_RUPIAH);
        // Hapus "Rp", spasi, dan titik lalu baca sebagai bilangan bulat.
        const digit = teks.replace(/^Rp/, '').replace(/[ .]/g, '');
        expect(Number.parseInt(digit, 10)).toBe(n);
        expect(parseRupiah(teks)).toBe(n);
      }),
      { numRuns: 200 },
    );
  });
});
