// Feature: patient-therapy-management, Property 24: Nama file cadangan
//
// **Validates: Requirements 14.2**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { backupFileName } from '../cadangan';

const NUM_RUNS = 200;
const POLA = /^datapasien-cadangan-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\.json$/;

// Tahun 4 digit agar komponen YYYY selalu tepat 4 karakter.
const tanggalWaktuArb = fc.date({
  min: new Date(1000, 0, 1, 0, 0, 0),
  max: new Date(9999, 11, 31, 23, 59, 59),
  noInvalidDate: true,
});

describe('Property 24: Nama file cadangan', () => {
  it('cocok dengan pola dan komponennya sama dengan komponen waktu lokal', () => {
    fc.assert(
      fc.property(tanggalWaktuArb, (d) => {
        const nama = backupFileName(d);
        expect(nama).toMatch(/^datapasien-cadangan-\d{8}-\d{4}\.json$/);

        const m = POLA.exec(nama);
        expect(m).not.toBeNull();
        const [, yyyy, mm, dd, hh, mi] = m!.map(Number);

        expect(yyyy).toBe(d.getFullYear());
        expect(mm).toBe(d.getMonth() + 1);
        expect(dd).toBe(d.getDate());
        expect(hh).toBe(d.getHours());
        expect(mi).toBe(d.getMinutes());
        expect(hh).toBeGreaterThanOrEqual(0);
        expect(hh).toBeLessThanOrEqual(23);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('contoh: 5 Januari 2025 09:07 lokal', () => {
    expect(backupFileName(new Date(2025, 0, 5, 9, 7))).toBe(
      'datapasien-cadangan-20250105-0907.json',
    );
  });
});
