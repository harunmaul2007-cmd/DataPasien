// Feature: patient-therapy-management, Property 3: Validator jadwal sesuai model aturan
// **Validates: Requirements 8.2, 8.3, 8.12**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { PESAN, validateJadwal } from '../validator';
import type { JadwalField, JadwalInput } from '../types';
import {
  BATAS,
  codePointLength,
  idArb,
  isJamValidModel,
  isTanggalValidModel,
  jadwalInputArb,
  nowArb,
} from './arbitraries';

/** `now` dengan detik/ms acak agar presisi menit benar-benar diuji. */
const nowDenganDetikArb: fc.Arbitrary<Date> = fc
  .tuple(nowArb, fc.integer({ min: 0, max: 59_999 }))
  .map(([d, ms]) => new Date(d.getTime() + ms));

/** Model referensi: nomor hari kalender (y*10000+m*100+d) dari teks tanggal valid atau Date lokal. */
function tanggalModel(t: string | Date): number {
  if (t instanceof Date) return t.getFullYear() * 10000 + (t.getMonth() + 1) * 100 + t.getDate();
  const [y, m, d] = t.split('-').map(Number) as [number, number, number];
  return y * 10000 + m * 100 + d;
}



/** Model referensi kesalahan per field sesuai tabel aturan di design. */
function kesalahanModel(
  input: JadwalInput,
  now: Date,
  pasienIds: ReadonlySet<string>,
  abaikanWaktuLewat: boolean,
): Partial<Record<JadwalField, string>> {
  const e: Partial<Record<JadwalField, string>> = {};
  if (input.pasienId === '' || !pasienIds.has(input.pasienId)) e.pasienId = PESAN.pasienWajib;
  const tOk = isTanggalValidModel(input.tanggal);
  const jOk = isJamValidModel(input.jam);
  if (!tOk) e.tanggal = PESAN.tanggalWajib;
  if (!jOk) e.jam = PESAN.jamWajib;
  if (tOk && jOk && !abaikanWaktuLewat && tanggalModel(input.tanggal) < tanggalModel(now)) {
    e.tanggal = PESAN.jadwalLewat;
  }
  if (codePointLength(input.catatan.trim()) > BATAS.catatan) e.catatan = PESAN.catatanMaks;
  return e;
}

const kasusArb = fc
  .tuple(fc.uniqueArray(idArb, { minLength: 0, maxLength: 3 }), nowDenganDetikArb)
  .chain(([ids, now]) =>
    fc.record({
      ids: fc.constant(ids),
      now: fc.constant(now),
      input: jadwalInputArb(ids, now),
      abaikan: fc.boolean(),
    }),
  );

describe('Property 3: Validator jadwal sesuai model aturan', () => {
  it('menerima iff semua aturan terpenuhi dan melaporkan setiap field yang melanggar', () => {
    fc.assert(
      fc.property(kasusArb, ({ ids, now, input, abaikan }) => {
        const pasienIds = new Set(ids);
        const harapan = kesalahanModel(input, now, pasienIds, abaikan);
        const hasil = validateJadwal(input, now, pasienIds, { abaikanWaktuLewat: abaikan });

        if (Object.keys(harapan).length === 0) {
          expect(hasil).toEqual({
            ok: true,
            value: {
              pasienId: input.pasienId,
              tanggal: input.tanggal,
              jam: input.jam,
              catatan: input.catatan.trim(),
            },
          });
        } else {
          expect(hasil).toEqual({ ok: false, errors: harapan });
        }
      }),
      { numRuns: 300 },
    );
  });

  it('opsi default sama dengan abaikanWaktuLewat=false', () => {
    fc.assert(
      fc.property(kasusArb, ({ ids, now, input }) => {
        const pasienIds = new Set(ids);
        expect(validateJadwal(input, now, pasienIds)).toEqual(
          validateJadwal(input, now, pasienIds, { abaikanWaktuLewat: false }),
        );
      }),
      { numRuns: 100 },
    );
  });

  it('hari ini diterima pada jam berapa pun; kemarin ditolak', () => {
    fc.assert(
      fc.property(idArb, nowDenganDetikArb, fc.constantFrom(0, -1), fc.integer({ min: 0, max: 1439 }), (id, now, hari, menit) => {
        const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + hari);
        const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
        const input: JadwalInput = {
          pasienId: id,
          tanggal: `${pad(t.getFullYear(), 4)}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
          jam: `${pad(Math.floor(menit / 60))}:${pad(menit % 60)}`,
          catatan: '',
        };
        const hasil = validateJadwal(input, now, new Set([id]));
        if (hari === 0) expect(hasil.ok).toBe(true);
        else expect(hasil).toEqual({ ok: false, errors: { tanggal: PESAN.jadwalLewat } });
        // Dengan opsi impor, jadwal lewat tetap diterima.
        expect(validateJadwal(input, now, new Set([id]), { abaikanWaktuLewat: true }).ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
