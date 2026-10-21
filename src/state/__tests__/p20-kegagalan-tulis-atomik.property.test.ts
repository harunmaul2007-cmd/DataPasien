// Feature: patient-therapy-management, Property 20: Kegagalan tulis bersifat atomik
//
// **Validates: Requirements 3.6, 10.5, 14.7**
//
// Untuk setiap keadaan data dan operasi tulis (tambah, ubah, ubah status, hapus,
// hapus berantai, atau replaceAll) yang dipaksa gagal di tengah transaksi,
// keadaan basis data dan DataStore setelah kegagalan identik dengan keadaan
// sebelum operasi dimulai.
//
// Kegagalan disuntikkan dengan membungkus tabel Dexie (`db.pasien`, `db.sesi`,
// `db.jadwal`) dengan Proxy sehingga pemanggilan metode tabel ke-k selama
// operasi melempar galat. Untuk operasi multi-langkah (hapus berantai,
// replaceAll, ubah = get+put) k > 1 berarti sebagian perubahan sudah ditulis
// di dalam transaksi sebelum galat terjadi, sehingga rollback benar-benar diuji.

import Dexie from 'dexie';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { AppData, JadwalInput, PasienInput, SesiInput } from '../../domain/types';
import {
  appDataArb,
  BATAS,
  nowArb,
  pasienInputValidArb,
  sesiInputValidArb,
  toHHmmLocal,
  toISODateLocal,
  trimmedText,
  withPadding,
} from '../../domain/__tests__/arbitraries';
import { TABLE_NAMES, type DataPasienDb } from '../../infra/db';
import { SaveError } from '../../infra/errors';
import { openRepository } from '../../infra/repository';
import { DataStore } from '../dataStore';

// ---------------------------------------------------------------------------
// Penyuntik kegagalan
// ---------------------------------------------------------------------------

class Penyuntik {
  /** 0 = tidak aktif. */
  failAt = 0;
  calls = 0;
  fired = false;

  arm(k: number): void {
    this.failAt = k;
    this.calls = 0;
    this.fired = false;
  }

  disarm(): void {
    this.failAt = 0;
  }
}

/** Membungkus tiga tabel Dexie; mengembalikan fungsi untuk memulihkan tabel asli. */
function bungkusTabel(db: DataPasienDb, inj: Penyuntik): () => void {
  const asli = new Map<string, unknown>();
  for (const name of TABLE_NAMES) {
    const table = db[name] as unknown as object;
    asli.set(name, table);
    const proxy = new Proxy(table, {
      get(target, prop) {
        const v = Reflect.get(target, prop, target) as unknown;
        if (typeof v !== 'function') return v;
        const fn = v as (...a: unknown[]) => unknown;
        return (...args: unknown[]) => {
          if (inj.failAt > 0) {
            inj.calls++;
            if (inj.calls === inj.failAt) {
              inj.fired = true;
              throw new Error(`Kegagalan disuntikkan pada operasi tabel ke-${inj.failAt} (${name}.${String(prop)})`);
            }
          }
          return fn.apply(target, args);
        };
      },
    });
    Object.defineProperty(db, name, { value: proxy, writable: true, configurable: true, enumerable: true });
  }
  return () => {
    for (const [name, table] of asli) {
      Object.defineProperty(db, name, { value: table, writable: true, configurable: true, enumerable: true });
    }
  };
}

// ---------------------------------------------------------------------------
// Operasi tulis
// ---------------------------------------------------------------------------

type JenisOperasi =
  | 'addPasien'
  | 'updatePasien'
  | 'deletePasien'
  | 'addSesi'
  | 'updateSesi'
  | 'deleteSesi'
  | 'addJadwal'
  | 'updateJadwal'
  | 'tandaiSelesai'
  | 'tandaiDibatalkan'
  | 'deleteJadwal'
  | 'replaceAll';

/**
 * Banyaknya pemanggilan metode tabel di dalam transaksi tiap operasi Repository
 * (lihat repository.ts). k dipilih dalam [1, n] sehingga kegagalan selalu terjadi.
 */
const JUMLAH_OPERASI_TABEL: Record<JenisOperasi, number> = {
  addPasien: 1,
  updatePasien: 2, // get + put
  deletePasien: 3, // sesi.where…delete, jadwal.where…delete, pasien.delete
  addSesi: 1,
  updateSesi: 2,
  deleteSesi: 1,
  addJadwal: 1,
  updateJadwal: 2,
  tandaiSelesai: 2,
  tandaiDibatalkan: 2,
  deleteJadwal: 1,
  replaceAll: 6, // 3× clear + 3× bulkAdd
};

interface Operasi {
  jenis: JenisOperasi;
  /** Indeks pemilihan rekaman/pasien target (modulo jumlah). */
  idx: number;
  kRaw: number;
  pasienInput: PasienInput;
  sesiInput: SesiInput;
  offsetMenit: number;
  catatan: string;
  dataBaru: AppData;
}

const operasiArb: fc.Arbitrary<Operasi> = fc.record({
  jenis: fc.constantFrom<JenisOperasi>(
    'addPasien',
    'updatePasien',
    'deletePasien',
    'addSesi',
    'updateSesi',
    'deleteSesi',
    'addJadwal',
    'updateJadwal',
    'tandaiSelesai',
    'tandaiDibatalkan',
    'deleteJadwal',
    'replaceAll',
  ),
  idx: fc.nat(),
  kRaw: fc.nat(),
  pasienInput: pasienInputValidArb,
  sesiInput: sesiInputValidArb,
  offsetMenit: fc.oneof(fc.constantFrom(0, 1), fc.integer({ min: 0, max: 400 * 24 * 60 })),
  catatan: fc.oneof(fc.constant(''), withPadding(trimmedText(0, BATAS.catatan))),
  dataBaru: appDataArb({ maxPasien: 3, maxSesi: 4, maxJadwal: 4 }),
});

const skenarioArb = fc.record({
  awal: appDataArb({ maxPasien: 4, maxSesi: 6, maxJadwal: 6 }),
  now: nowArb,
  operasi: fc.array(operasiArb, { minLength: 1, maxLength: 5 }),
});

/** Mengganti jenis operasi yang targetnya tidak ada dengan operasi yang selalu berlaku. */
function jenisBerlaku(jenis: JenisOperasi, d: AppData): JenisOperasi {
  const adaPasien = d.pasien.length > 0;
  const adaTerjadwal = d.jadwal.some((j) => j.status === 'Terjadwal');
  switch (jenis) {
    case 'updatePasien':
    case 'deletePasien':
    case 'addSesi':
    case 'addJadwal':
      return adaPasien ? jenis : 'addPasien';
    case 'updateSesi':
    case 'deleteSesi':
      return d.sesi.length > 0 ? jenis : 'addPasien';
    case 'updateJadwal':
    case 'tandaiSelesai':
    case 'tandaiDibatalkan':
      return adaTerjadwal ? jenis : 'replaceAll';
    case 'deleteJadwal':
      return d.jadwal.length > 0 ? jenis : 'replaceAll';
    default:
      return jenis;
  }
}

function pilih<T>(xs: readonly T[], idx: number): T {
  return xs[idx % xs.length] as T;
}

function urut(d: AppData): AppData {
  const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { pasien: [...d.pasien].sort(byId), sesi: [...d.sesi].sort(byId), jadwal: [...d.jadwal].sort(byId) };
}

let counter = 0;

describe('Property 20: Kegagalan tulis bersifat atomik', () => {
  it('operasi tulis yang gagal di tengah transaksi tidak mengubah basis data maupun DataStore', async () => {
    await fc.assert(
      fc.asyncProperty(skenarioArb, async ({ awal, now, operasi }) => {
        const name = `p20-atomik-${Date.now()}-${counter++}`;
        const repo = await openRepository(name, { requestPersist: false });
        const inj = new Penyuntik();
        const pulihkan = bungkusTabel(repo.db, inj);
        try {
          for (const p of awal.pasien) await repo.addPasien(p);
          for (const s of awal.sesi) await repo.addSesi(s);
          for (const j of awal.jadwal) await repo.addJadwal(j);

          const store = new DataStore({ repository: repo, now: () => now });
          await store.load();
          expect(store.getState().status).toBe('ready');

          const dbSebelum = urut(await repo.loadAll());
          const memoriSebelum = structuredClone(store.getState().data);
          expect(urut(memoriSebelum)).toStrictEqual(dbSebelum);

          for (const op of operasi) {
            const d = store.getState().data;
            const jenis = jenisBerlaku(op.jenis, d);
            const k = 1 + (op.kRaw % JUMLAH_OPERASI_TABEL[jenis]);
            const terjadwal = d.jadwal.filter((j) => j.status === 'Terjadwal');

            let jalankan: () => Promise<unknown>;
            switch (jenis) {
              case 'addPasien':
                jalankan = () => store.addPasien(op.pasienInput);
                break;
              case 'updatePasien':
                jalankan = () => store.updatePasien(pilih(d.pasien, op.idx).id, op.pasienInput);
                break;
              case 'deletePasien':
                jalankan = () => store.deletePasien(pilih(d.pasien, op.idx).id);
                break;
              case 'addSesi':
                jalankan = () => store.addSesi(pilih(d.pasien, op.idx).id, op.sesiInput);
                break;
              case 'updateSesi':
                jalankan = () => store.updateSesi(pilih(d.sesi, op.idx).id, op.sesiInput);
                break;
              case 'deleteSesi':
                jalankan = () => store.deleteSesi(pilih(d.sesi, op.idx).id);
                break;
              case 'addJadwal':
              case 'updateJadwal': {
                const waktu = new Date(now.getTime() + op.offsetMenit * 60_000);
                const input: JadwalInput = {
                  pasienId: pilih(d.pasien, op.idx).id,
                  tanggal: toISODateLocal(waktu),
                  jam: toHHmmLocal(waktu),
                  catatan: op.catatan,
                };
                jalankan =
                  jenis === 'addJadwal'
                    ? () => store.addJadwal(input)
                    : () => store.updateJadwal(pilih(terjadwal, op.idx).id, input);
                break;
              }
              case 'tandaiSelesai':
                jalankan = () => store.tandaiSelesai(pilih(terjadwal, op.idx).id);
                break;
              case 'tandaiDibatalkan':
                jalankan = () => store.tandaiDibatalkan(pilih(terjadwal, op.idx).id);
                break;
              case 'deleteJadwal':
                jalankan = () => store.deleteJadwal(pilih(d.jadwal, op.idx).id);
                break;
              case 'replaceAll':
                // Melalui DataStore (importBackup → Repository.replaceAll) agar
                // atomisitas memori DataStore ikut diuji (Req 14.7).
                jalankan = () => store.importBackup(op.dataBaru);
                break;
            }

            inj.arm(k);
            let galat: unknown = undefined;
            let berhasil = false;
            try {
              await jalankan();
              berhasil = true;
            } catch (e) {
              galat = e;
            } finally {
              inj.disarm();
            }

            // Kegagalan benar-benar terjadi pada operasi tabel ke-k.
            expect(inj.fired, `${jenis}: kegagalan pada operasi tabel ke-${k} tidak terpicu`).toBe(true);
            expect(berhasil, `${jenis}: operasi seharusnya gagal`).toBe(false);
            // ImportError (replaceAll) juga turunan SaveError.
            expect(galat).toBeInstanceOf(SaveError);

            // DataStore tidak berubah.
            expect(store.getState().status).toBe('ready');
            expect(store.getState().data).toStrictEqual(memoriSebelum);

            // Basis data tidak berubah (tanpa perubahan sebagian).
            expect(urut(await repo.loadAll())).toStrictEqual(dbSebelum);
          }

          // Memuat ulang dari basis data menghasilkan keadaan semula.
          const store2 = new DataStore({ repository: repo, now: () => now });
          await store2.load();
          expect(urut(store2.getState().data)).toStrictEqual(dbSebelum);
        } finally {
          pulihkan();
          repo.close();
          await Dexie.delete(name);
        }
      }),
      { numRuns: 100 },
    );
  }, 180_000);
});
