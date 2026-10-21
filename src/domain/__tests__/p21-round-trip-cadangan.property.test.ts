// Feature: patient-therapy-management, Property 21: Round-trip cadangan
//
// Untuk setiap kumpulan data valid (termasuk kosong dan teks non-ASCII) dan
// waktu ekspor, parseBackup(serializeBackup(data, t)) berhasil dengan data
// identik (jumlah, id, pasienId, dan nilai setiap atribut) serta counts sama
// dengan jumlah rekaman per jenis.
//
// **Validates: Requirements 14.1, 14.8, 14.10**

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { APP_ID, FORMAT_VERSION, parseBackup, serializeBackup, toLocalISOString } from '../cadangan';
import { appDataArb, nowArb } from './arbitraries';

describe('Property 21: Round-trip cadangan', () => {
  it('parseBackup(serializeBackup(data, t)) mengembalikan data identik dan counts yang benar', () => {
    fc.assert(
      fc.property(appDataArb(), nowArb, (data, t) => {
        const text = serializeBackup(data, t);

        // Format file (Req 14.1): metadata aplikasi, versi, dan waktu ekspor.
        const root = JSON.parse(text) as Record<string, unknown>;
        expect(root['app']).toBe(APP_ID);
        expect(root['formatVersion']).toBe(FORMAT_VERSION);
        expect(root['exportedAt']).toBe(toLocalISOString(t));

        const result = parseBackup(text);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Data identik: urutan, id, pasienId, dan setiap atribut (Req 14.8).
        expect(result.data).toStrictEqual(data);

        // Ringkasan jumlah rekaman per jenis (Req 14.10).
        expect(result.counts).toStrictEqual({
          pasien: data.pasien.length,
          sesi: data.sesi.length,
          jadwal: data.jadwal.length,
        });
      }),
      { numRuns: 200 },
    );
  });
});
