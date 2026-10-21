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

/** Model referensi: epoch ms lokal dari tanggal+jam yang sudah valid. */
function waktuLokalModel(tanggal: string, jam: string): number {
  const [y, m, d] = tanggal.split('-').map(Number) as [number, number, number];
  const [h, mi] = jam.split(':').map(Number) as [number, number];
  return new Date(y, m - 1, d, h, mi, 0, 0).getTime();
}

function menitNow(now: Date): number {
  const d = new Date(now.getTime());
  d.setSeconds(0, 0);
  return d.getTime();
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
  if (tOk && jOk && !abaikanWaktuLewat && waktuLokalModel(input.tanggal, input.jam) < menitNow(now)) {
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

  it('waktu pada menit yang sama dengan now diterima; satu menit sebelumnya ditolak', () => {
    fc.assert(
      fc.property(idArb, nowDenganDetikArb, fc.constantFrom(0, -1), (id, now, offset) => {
        const t = new Date(menitNow(now) + offset * 60_000);
        const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
        const input: JadwalInput = {
          pasienId: id,
          tanggal: `${pad(t.getFullYear(), 4)}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`,
          jam: `${pad(t.getHours())}:${pad(t.getMinutes())}`,
          catatan: '',
        };
        const hasil = validateJadwal(input, now, new Set([id]));
        if (offset === 0) expect(hasil.ok).toBe(true);
        else expect(hasil).toEqual({ ok: false, errors: { tanggal: PESAN.jadwalLewat } });
        // Dengan opsi impor, jadwal lewat tetap diterima.
        expect(validateJadwal(input, now, new Set([id]), { abaikanWaktuLewat: true }).ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
