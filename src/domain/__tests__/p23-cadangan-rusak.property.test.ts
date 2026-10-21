// Feature: patient-therapy-management, Property 23: File cadangan rusak ditolak
//
// Untuk setiap File_Cadangan valid yang dimutasi menjadi tidak valid (teks
// kosong, JSON terpotong, field hilang, versi format lain, rekaman melanggar
// Validator, id ganda dalam satu jenis, atau sesi/jadwal dengan pasienId yang
// tidak ada), parseBackup mengembalikan ok: false dengan alasan tidak kosong,
// dan data tersimpan tidak berubah.
//
// **Validates: Requirements 14.6**

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ALASAN, parseBackup } from '../cadangan';
import type { JenisKerusakan } from './arbitraries';
import { dataDanCadanganRusakArb } from './arbitraries';

/** Prefiks alasan yang diharapkan untuk setiap jenis kerusakan. */
const ALASAN_PER_JENIS: Record<JenisKerusakan, readonly string[]> = {
  kosong: [ALASAN.kosong],
  jsonTerpotong: [ALASAN.bukanJson],
  bukanJson: [ALASAN.bukanJson],
  strukturSalah: [ALASAN.strukturSalah],
  versiLain: [ALASAN.versiTidakDidukung],
  fieldHilang: [ALASAN.pasienTidakValid, ALASAN.sesiTidakValid, ALASAN.jadwalTidakValid],
  rekamanTidakValid: [ALASAN.pasienTidakValid, ALASAN.sesiTidakValid, ALASAN.jadwalTidakValid],
  idGanda: [ALASAN.idGanda],
  pasienIdTidakAda: [ALASAN.sesiTanpaPasien, ALASAN.jadwalTanpaPasien],
};

describe('Property 23: File cadangan rusak ditolak', () => {
  it('parseBackup menolak setiap file rusak dengan alasan tidak kosong tanpa mengubah data', () => {
    fc.assert(
      fc.property(dataDanCadanganRusakArb(), ({ data, jenis, text }) => {
        // "Data tersimpan" direpresentasikan oleh AppData asal; parseBackup murni.
        const sebelum = structuredClone(data);

        const result = parseBackup(text);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.reason.trim().length).toBeGreaterThan(0);
        expect(ALASAN_PER_JENIS[jenis].some((a) => result.reason.startsWith(a))).toBe(true);

        expect(data).toStrictEqual(sebelum);
      }),
      { numRuns: 300 },
    );
  });
});
