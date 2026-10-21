// Feature: patient-therapy-management, Property 6: Pengubahan valid mempertahankan identitas dan keterhubungan
//
// **Validates: Requirements 2.2, 6.1, 8.7**
//
// Untuk setiap keadaan data dan pengubahan valid atas sebuah Pasien,
// Sesi_Terapi, atau Jadwal_Kunjungan, setelah pengubahan rekaman tersebut
// memiliki id yang sama, nilai baru sesuai input ternormalisasi, sesi tetap
// terhubung ke pasienId yang sama, jadwal mempertahankan statusnya, jumlah
// rekaman setiap jenis tidak berubah, dan seluruh rekaman lain (termasuk
// Histori_Terapi pasien yang diubah) tidak berubah. Diperiksa pada data di
// memori DataStore maupun data yang dibaca ulang dari IndexedDB.

import Dexie from 'dexie';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AppData, JadwalInput, PasienInput, SesiInput } from '../../domain/types';
import {
  appDataNonEmptyArb,
  BATAS,
  jamValidArb,
  pasienInputValidArb,
  sesiInputValidArb,
  tanggalValidArb,
  trimmedText,
  withPadding,
} from '../../domain/__tests__/arbitraries';
import { openRepository } from '../../infra/repository';
import { DataStore } from '../dataStore';

/** Waktu "sekarang" tetap; seluruh jadwal input bertanggal ≥ 2001 sehingga tidak pernah lewat. */
const NOW = new Date(2000, 0, 1, 0, 0, 0, 0);

type Pengubahan =
  | { jenis: 'pasien'; idx: number; input: PasienInput }
  | { jenis: 'sesi'; idx: number; input: SesiInput }
  | { jenis: 'jadwal'; idx: number; input: JadwalInput };

interface Skenario {
  data: AppData;
  ubah: Pengubahan;
}

function jadwalInputValidArb(pasienIds: readonly string[]): fc.Arbitrary<JadwalInput> {
  return fc.record({
    pasienId: fc.constantFrom(...pasienIds),
    tanggal: tanggalValidArb({ minYear: 2001, maxYear: 2100 }),
    jam: jamValidArb,
    catatan: withPadding(trimmedText(0, BATAS.catatan)),
  });
}

const skenarioArb: fc.Arbitrary<Skenario> = appDataNonEmptyArb({ maxPasien: 4, maxSesi: 6, maxJadwal: 6 }).chain(
  (data) => {
    const opsi: Array<fc.Arbitrary<Pengubahan>> = [
      fc.record({
        jenis: fc.constant('pasien' as const),
        idx: fc.nat({ max: data.pasien.length - 1 }),
        input: pasienInputValidArb,
      }),
    ];
    if (data.sesi.length > 0) {
      opsi.push(
        fc.record({
          jenis: fc.constant('sesi' as const),
          idx: fc.nat({ max: data.sesi.length - 1 }),
          input: sesiInputValidArb,
        }),
      );
    }
    if (data.jadwal.length > 0) {
      opsi.push(
        fc.record({
          jenis: fc.constant('jadwal' as const),
          idx: fc.nat({ max: data.jadwal.length - 1 }),
          input: jadwalInputValidArb(data.pasien.map((p) => p.id)),
        }),
      );
    }
    return fc.record({ data: fc.constant(data), ubah: fc.oneof(...opsi) });
  },
);

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sorted(d: AppData): AppData {
  return {
    pasien: [...d.pasien].sort(byId),
    sesi: [...d.sesi].sort(byId),
    jadwal: [...d.jadwal].sort(byId),
  };
}

/**
 * Model: data yang diharapkan setelah pengubahan (tanpa updatedAt rekaman
 * yang diubah, yang diperiksa terpisah). Normalisasi = trim teks, biaya angka.
 */
function expected({ data, ubah }: Skenario): { data: AppData; targetId: string } {
  const out: AppData = {
    pasien: data.pasien.map((p) => ({ ...p })),
    sesi: data.sesi.map((s) => ({ ...s })),
    jadwal: data.jadwal.map((j) => ({ ...j })),
  };
  if (ubah.jenis === 'pasien') {
    const p = out.pasien[ubah.idx]!;
    const inputUmur = ubah.input.umur !== undefined && ubah.input.umur.trim() !== '' ? Number(ubah.input.umur.trim()) : null;
    const inputJk = ubah.input.jenisKelamin === 'Laki-laki' || ubah.input.jenisKelamin === 'Wanita' ? ubah.input.jenisKelamin : null;
    out.pasien[ubah.idx] = {
      ...p,
      nama: ubah.input.nama.trim(),
      alamat: ubah.input.alamat.trim(),
      noHp: ubah.input.noHp.trim(),
      umur: inputUmur,
      jenisKelamin: inputJk,
    };
    return { data: out, targetId: p.id };
  }
  if (ubah.jenis === 'sesi') {
    const s = out.sesi[ubah.idx]!;
    out.sesi[ubah.idx] = {
      ...s,
      tanggal: ubah.input.tanggal,
      keluhan: ubah.input.keluhan.trim(),
      polaPenyakit: ubah.input.polaPenyakit.trim(),
      terapi: ubah.input.terapi.trim(),
      hasil: ubah.input.hasil.trim(),
      biaya: Number(ubah.input.biaya.trim()),
    };
    return { data: out, targetId: s.id };
  }
  const j = out.jadwal[ubah.idx]!;
  out.jadwal[ubah.idx] = {
    ...j,
    pasienId: ubah.input.pasienId,
    tanggal: ubah.input.tanggal,
    jam: ubah.input.jam,
    catatan: ubah.input.catatan.trim(),
  };
  return { data: out, targetId: j.id };
}

/** Samakan updatedAt rekaman target dengan yang diharapkan agar dapat dibandingkan utuh. */
function withTargetUpdatedAt(d: AppData, targetId: string, updatedAt: number): AppData {
  const fix = <T extends { id: string; updatedAt: number }>(r: T): T =>
    r.id === targetId ? { ...r, updatedAt } : r;
  return { pasien: d.pasien.map(fix), sesi: d.sesi.map(fix), jadwal: d.jadwal.map(fix) };
}

let counter = 0;

describe('Property 6: Pengubahan valid mempertahankan identitas dan keterhubungan', () => {
  it('rekaman yang diubah mempertahankan id/relasi/status dan rekaman lain tidak berubah', async () => {
    await fc.assert(
      fc.asyncProperty(skenarioArb, async (sk) => {
        const name = `p6-pengubahan-valid-${Date.now()}-${counter++}`;
        try {
          const seed = await openRepository(name, { requestPersist: false });
          try {
            for (const p of sk.data.pasien) await seed.addPasien(p);
            for (const s of sk.data.sesi) await seed.addSesi(s);
            for (const j of sk.data.jadwal) await seed.addJadwal(j);
          } finally {
            seed.close();
          }

          const repo = await openRepository(name, { requestPersist: false });
          let memori: AppData;
          let hasilUbah: { id: string; updatedAt: number; createdAt: number };
          try {
            const store = new DataStore({ repository: repo, now: () => NOW });
            await store.load();
            expect(store.getState().status).toBe('ready');

            const { ubah } = sk;
            if (ubah.jenis === 'pasien') {
              const asal = sk.data.pasien[ubah.idx]!;
              const r = await store.updatePasien(asal.id, ubah.input);
              expect(r.ok).toBe(true);
              if (!r.ok) return;
              hasilUbah = r.value;
              expect(r.value.createdAt).toBe(asal.createdAt);
            } else if (ubah.jenis === 'sesi') {
              const asal = sk.data.sesi[ubah.idx]!;
              const r = await store.updateSesi(asal.id, ubah.input);
              expect(r.ok).toBe(true);
              if (!r.ok) return;
              hasilUbah = r.value;
              // Sesi tetap terhubung ke pasien yang sama (Req 6.1).
              expect(r.value.pasienId).toBe(asal.pasienId);
            } else {
              const asal = sk.data.jadwal[ubah.idx]!;
              const r = await store.updateJadwal(asal.id, ubah.input);
              expect(r.ok).toBe(true);
              if (!r.ok) return;
              hasilUbah = r.value;
              // Status jadwal dipertahankan (Req 8.7).
              expect(r.value.status).toBe(asal.status);
            }
            memori = store.getState().data;
          } finally {
            repo.close();
          }

          const { data: want, targetId } = expected(sk);
          expect(hasilUbah.id).toBe(targetId);
          expect(typeof hasilUbah.updatedAt).toBe('number');

          const wantFull = sorted(withTargetUpdatedAt(want, targetId, hasilUbah.updatedAt));

          // Data di memori: jumlah tiap jenis sama, target sesuai input ternormalisasi,
          // seluruh rekaman lain (termasuk sesi = Histori_Terapi) identik.
          expect(sorted(memori)).toStrictEqual(wantFull);

          // Data tersimpan (dibaca dari instance Repository baru) identik.
          const reread = await openRepository(name, { requestPersist: false });
          try {
            expect(sorted(await reread.loadAll())).toStrictEqual(wantFull);
          } finally {
            reread.close();
          }
        } finally {
          await Dexie.delete(name);
        }
      }),
      { numRuns: 100 },
    );
  }, 180_000);
});
