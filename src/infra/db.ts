// Basis data IndexedDB (Dexie) untuk Aplikasi.
// Perubahan skema di masa depan wajib menambah db.version(n).upgrade(...)
// tanpa mengubah versi lama, agar data tetap terjaga saat pembaruan (Req 13.12).

import Dexie, { type Table } from 'dexie';
import type {
  FotoData,
  FotoMeta,
  JadwalKunjungan,
  Pasien,
  PengaturanLaporan,
  SesiTerapi,
} from '../domain/types';

export const DEFAULT_DB_NAME = 'datapasien';

/** Nama tabel, dipakai untuk membuka transaksi lintas tabel berdasarkan nama. */
export const TABLE_NAMES = [
  'pasien',
  'sesi',
  'jadwal',
  'foto',
  'fotoData',
  'pengaturan',
] as const;

export interface PengaturanRecord extends PengaturanLaporan {
  id: string;
}

export class DataPasienDb extends Dexie {
  // `declare` agar field kelas tidak menimpa tabel yang dipasang Dexie.
  declare pasien: Table<Pasien, string>;
  declare sesi: Table<SesiTerapi, string>;
  declare jadwal: Table<JadwalKunjungan, string>;
  declare foto: Table<FotoMeta, string>;
  declare fotoData: Table<FotoData, string>;
  declare pengaturan: Table<PengaturanRecord, string>;

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name);
    this.version(1).stores({
      pasien: 'id, nama',
      sesi: 'id, pasienId, tanggal',
      jadwal: 'id, pasienId, tanggal, status',
    });

    this.version(2)
      .stores({
        pasien: 'id, nama',
        sesi: 'id, pasienId, tanggal',
        jadwal: 'id, pasienId, tanggal, status',
        foto: 'id, sesiId, urutan',
        fotoData: 'id',
        pengaturan: 'id',
      })
      .upgrade(async (tx) => {
        await tx
          .table('pasien')
          .toCollection()
          .modify((p: Pasien) => {
            if (p.umur === undefined) p.umur = null;
            if (p.jenisKelamin === undefined) p.jenisKelamin = null;
          });
      });
  }
}

/** Membuat instance basis data baru. Nama berbeda → basis data terpisah (berguna untuk uji). */
export function createDb(name: string = DEFAULT_DB_NAME): DataPasienDb {
  return new DataPasienDb(name);
}

let persistRequested = false;

/**
 * Meminta penyimpanan persisten (navigator.storage.persist) sekali saja per sesi
 * Aplikasi, jika API tersedia. Tidak pernah melempar; mengembalikan hasilnya
 * atau false jika tidak tersedia/gagal.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (persistRequested) return false;
  persistRequested = true;
  try {
    const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!storage || typeof storage.persist !== 'function') return false;
    return await storage.persist();
  } catch {
    return false;
  }
}

/** Hanya untuk uji: mengizinkan requestPersistentStorage dipanggil ulang. */
export function resetPersistRequestForTest(): void {
  persistRequested = false;
}
