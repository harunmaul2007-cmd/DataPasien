// Feature: patient-therapy-management, Property 1: Validator pasien sesuai model aturan
// **Validates: Requirements 1.2, 1.3, 1.4, 1.6, 1.7, 1.8, 2.3**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PESAN, validatePasien } from '../validator';
import type { PasienField, PasienInput } from '../types';
import {
  BATAS,
  codePointLength,
  isNomorHpValidModel,
  pasienInputArb,
  pasienInputValidArb,
} from './arbitraries';

/** Model referensi: trim lalu periksa setiap field secara independen. */
function modelPasien(input: PasienInput): {
  value: { nama: string; alamat: string; noHp: string; umur: number | null; jenisKelamin: 'Laki-laki' | 'Wanita' | null };
  errors: Partial<Record<PasienField, string>>;
} {
  const nama = input.nama.trim();
  const alamat = input.alamat.trim();
  const noHp = input.noHp.trim();
  const errors: Partial<Record<PasienField, string>> = {};
  if (nama.length === 0) errors.nama = PESAN.namaWajib;
  else if (codePointLength(nama) > BATAS.nama) errors.nama = PESAN.namaMaks;
  if (codePointLength(alamat) > BATAS.alamat) errors.alamat = PESAN.alamatMaks;
  if (!isNomorHpValidModel(noHp)) errors.noHp = PESAN.noHpTidakValid;

  let umur: number | null = null;
  const inputUmur = input.umur !== undefined ? input.umur.trim() : '';
  if (inputUmur !== '') {
    if (!/^\d+$/.test(inputUmur)) {
      errors.umur = PESAN.umurTidakValid;
    } else {
      const u = Number(inputUmur);
      if (u < 0 || u > 150) {
        errors.umur = PESAN.umurTidakValid;
      } else {
        umur = u;
      }
    }
  }

  let jenisKelamin: 'Laki-laki' | 'Wanita' | null = null;
  const inputJk = input.jenisKelamin ?? '';
  if (inputJk !== '') {
    if (inputJk !== 'Laki-laki' && inputJk !== 'Wanita') {
      errors.jenisKelamin = PESAN.jenisKelaminTidakValid;
    } else {
      jenisKelamin = inputJk;
    }
  }

  return { value: { nama, alamat, noHp, umur, jenisKelamin }, errors };
}

function cekSesuaiModel(input: PasienInput): void {
  const model = modelPasien(input);
  const hasil = validatePasien(input);
  const modelMenerima = Object.keys(model.errors).length === 0;

  expect(hasil.ok).toBe(modelMenerima);
  if (hasil.ok) {
    expect(hasil.value).toEqual(model.value);
  } else {
    // Himpunan field dan pesannya sama persis dengan model.
    expect(hasil.errors).toEqual(model.errors);
  }
}

/** String acak bebas (unicode penuh) untuk melengkapi generator terarah. */
const stringBebasArb = fc.string({ unit: 'grapheme', maxLength: 30 });

describe('Property 1: Validator pasien sesuai model aturan', () => {
  it('input di sekitar batas: diterima iff model menerima, errors sama dengan model', () => {
    fc.assert(fc.property(pasienInputArb, cekSesuaiModel), { numRuns: 300 });
  });

  it('input valid (ber-padding) selalu diterima dengan nilai hasil trim', () => {
    fc.assert(
      fc.property(pasienInputValidArb, (input) => {
        const hasil = validatePasien(input);
        expect(hasil.ok).toBe(true);
        if (hasil.ok) {
          const model = modelPasien(input);
          expect(hasil.value).toEqual(model.value);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('string acak bebas: perilaku tetap sesuai model', () => {
    fc.assert(
      fc.property(
        fc.record({
          nama: stringBebasArb,
          alamat: stringBebasArb,
          noHp: stringBebasArb,
          umur: fc.option(stringBebasArb, { nil: undefined }),
          jenisKelamin: fc.option(fc.constantFrom('', 'Laki-laki' as const, 'Wanita' as const, 'Lainnya' as any), { nil: undefined }),
        }),
        cekSesuaiModel,
      ),
      { numRuns: 200 },
    );
  });
});
