// Feature: patient-therapy-management, Property 2: Validator sesi terapi sesuai model aturan
//
// **Validates: Requirements 5.3, 5.4, 5.5, 5.6, 5.8, 5.9, 6.2**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PESAN, validateSesi } from '../validator';
import type { SesiField, SesiInput } from '../types';
import {
  BATAS,
  codePointLength,
  isBiayaInputValidModel,
  isTanggalValidModel,
  sesiInputArb,
  sesiInputValidArb,
  whitespaceOnlyArb,
} from './arbitraries';

const NUM_RUNS = 200;

/** Model referensi: kesalahan yang diharapkan per field (independen dari validator). */
function expectedErrors(input: SesiInput): Partial<Record<SesiField, string>> {
  const e: Partial<Record<SesiField, string>> = {};
  const keluhan = input.keluhan.trim();
  const pola = input.polaPenyakit.trim();
  const terapi = input.terapi.trim();
  const hasil = input.hasil.trim();
  const biaya = input.biaya.trim();

  if (!isTanggalValidModel(input.tanggal)) e.tanggal = PESAN.tanggalTerapiWajib;

  if (keluhan.length === 0) e.keluhan = PESAN.keluhanWajib;
  else if (codePointLength(keluhan) > BATAS.teksSesi) e.keluhan = PESAN.keluhanMaks;

  if (codePointLength(pola) > BATAS.teksSesi) e.polaPenyakit = PESAN.polaPenyakitMaks;

  if (terapi.length === 0) e.terapi = PESAN.terapiWajib;
  else if (codePointLength(terapi) > BATAS.teksSesi) e.terapi = PESAN.terapiMaks;

  if (codePointLength(hasil) > BATAS.teksSesi) e.hasil = PESAN.hasilMaks;

  if (!isBiayaInputValidModel(biaya)) e.biaya = PESAN.biayaTidakValid;

  return e;
}

describe('Property 2: Validator sesi terapi sesuai model aturan', () => {
  it('menerima iff semua aturan terpenuhi; bila ditolak, seluruh field pelanggar dilaporkan dengan pesan tetap', () => {
    fc.assert(
      fc.property(sesiInputArb, (input) => {
        const expected = expectedErrors(input);
        const r = validateSesi(input);
        if (Object.keys(expected).length === 0) {
          expect(r.ok).toBe(true);
          if (r.ok) {
            expect(r.value).toEqual({
              tanggal: input.tanggal,
              keluhan: input.keluhan.trim(),
              polaPenyakit: input.polaPenyakit.trim(),
              terapi: input.terapi.trim(),
              hasil: input.hasil.trim(),
              biaya: Number(input.biaya.trim()),
            });
          }
        } else {
          expect(r.ok).toBe(false);
          if (!r.ok) expect(r.errors).toEqual(expected);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('input valid selalu diterima, dinormalisasi (trim), dan biaya menjadi bilangan bulat 0–999.999.999', () => {
    fc.assert(
      fc.property(sesiInputValidArb, (input) => {
        const r = validateSesi(input);
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.value.keluhan).toBe(input.keluhan.trim());
          expect(r.value.terapi).toBe(input.terapi.trim());
          expect(r.value.polaPenyakit).toBe(input.polaPenyakit.trim());
          expect(r.value.hasil).toBe(input.hasil.trim());
          expect(Number.isInteger(r.value.biaya)).toBe(true);
          expect(r.value.biaya).toBeGreaterThanOrEqual(0);
          expect(r.value.biaya).toBeLessThanOrEqual(BATAS.biayaMaks);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('pola penyakit dan hasil kosong / whitespace saja tidak pernah menghasilkan kesalahan', () => {
    const kosongArb = fc.oneof(fc.constant(''), whitespaceOnlyArb);
    fc.assert(
      fc.property(sesiInputArb, kosongArb, kosongArb, (base, pola, hasil) => {
        const r = validateSesi({ ...base, polaPenyakit: pola, hasil });
        if (!r.ok) {
          expect(r.errors.polaPenyakit).toBeUndefined();
          expect(r.errors.hasil).toBeUndefined();
        } else {
          expect(r.value.polaPenyakit).toBe('');
          expect(r.value.hasil).toBe('');
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
