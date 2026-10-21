// Feature: patient-therapy-management, Property 14: Transisi status jadwal hanya dari Terjadwal
//
// **Validates: Requirements 8.9, 8.10, 8.14**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { aksiTersedia, transisiStatus } from '../jadwal';
import type { JadwalKunjungan } from '../types';
import { jadwalArb, statusJadwalArb } from './arbitraries';

const NUM_RUNS = 200;

const targetArb = fc.constantFrom<'Selesai' | 'Dibatalkan'>('Selesai', 'Dibatalkan');
const nowArb = fc.integer({ min: Date.UTC(2000, 0, 1), max: Date.UTC(2100, 0, 1) });

describe('Property 14: Transisi status jadwal hanya dari Terjadwal', () => {
  it('Terjadwal → target: status berubah, field lain identik (tanpa now)', () => {
    fc.assert(
      fc.property(jadwalArb(undefined, fc.constant('Terjadwal')), targetArb, (j, target) => {
        const snapshot = structuredClone(j);
        const out = transisiStatus(j, target);
        expect(out).not.toBeNull();
        expect(out).toEqual({ ...snapshot, status: target });
        // Input tidak dimutasi.
        expect(j).toEqual(snapshot);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('Terjadwal → target dengan now: hanya status dan updatedAt yang berubah', () => {
    fc.assert(
      fc.property(jadwalArb(undefined, fc.constant('Terjadwal')), targetArb, nowArb, (j, target, now) => {
        const snapshot = structuredClone(j);
        const out = transisiStatus(j, target, now);
        expect(out).toEqual({ ...snapshot, status: target, updatedAt: now });
        expect(j).toEqual(snapshot);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('status awal Selesai/Dibatalkan → null dan input tidak berubah', () => {
    const nonAktif = fc.constantFrom<JadwalKunjungan['status']>('Selesai', 'Dibatalkan');
    fc.assert(
      fc.property(jadwalArb(undefined, nonAktif), targetArb, fc.option(nowArb, { nil: undefined }), (j, target, now) => {
        const snapshot = structuredClone(j);
        expect(transisiStatus(j, target, now)).toBeNull();
        expect(j).toEqual(snapshot);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('aksiTersedia: ubah/selesai/batal ⇔ status Terjadwal; hapus selalu tersedia', () => {
    fc.assert(
      fc.property(jadwalArb(undefined, statusJadwalArb), (j) => {
        const aktif = j.status === 'Terjadwal';
        expect(aksiTersedia(j)).toEqual({ ubah: aktif, selesai: aktif, batal: aktif, hapus: true });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('hasil transisi tidak dapat ditransisikan lagi dan tidak punya aksi ubah/selesai/batal', () => {
    fc.assert(
      fc.property(jadwalArb(undefined, fc.constant('Terjadwal')), targetArb, targetArb, (j, t1, t2) => {
        const out = transisiStatus(j, t1) as JadwalKunjungan;
        expect(transisiStatus(out, t2)).toBeNull();
        expect(aksiTersedia(out)).toEqual({ ubah: false, selesai: false, batal: false, hapus: true });
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
