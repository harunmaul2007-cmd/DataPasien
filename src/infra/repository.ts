// Repository: satu-satunya pintu tulis/baca ke IndexedDB (Dexie).
//
// Prinsip:
// - Setiap operasi tulis berjalan di dalam transaksi `rw` dan baru resolve
//   setelah transaksi selesai (commit), sehingga pesan berhasil di UI hanya
//   muncul setelah data benar-benar tersimpan (Req 10.1).
// - Operasi multi-rekaman (hapus berantai, replaceAll) memakai satu transaksi
//   atas tiga tabel; kegagalan apa pun membatalkan seluruh perubahan
//   (Req 3.6, 10.5, 14.7).
// - Tabel selalu diakses melalui `this.db.<tabel>` pada saat operasi berjalan,
//   dan transaksi dibuka berdasarkan nama tabel, sehingga uji dapat
//   membungkus/mengganti tabel untuk menyuntikkan kegagalan.

import { newId } from '../domain/ids';
import type {
  AppData,
  FotoDiproses,
  FotoMeta,
  JadwalKunjungan,
  Pasien,
  PengaturanLaporan,
  SesiTerapi,
} from '../domain/types';
import {
  DEFAULT_DB_NAME,
  TABLE_NAMES,
  createDb,
  requestPersistentStorage,
  type DataPasienDb,
} from './db';
import { NotFoundError } from './errors';

export interface Repository {
  loadAll(): Promise<AppData>;
  loadAllFoto(): Promise<FotoMeta[]>;
  loadPengaturan(): Promise<PengaturanLaporan | null>;
  addPasien(p: Pasien): Promise<void>;
  /** Gagal dengan NotFoundError jika id tidak ada. */
  updatePasien(p: Pasien): Promise<void>;
  /** Satu transaksi: pasien + seluruh sesi + seluruh jadwal + seluruh foto miliknya. */
  deletePasienCascade(id: string): Promise<void>;
  addSesi(s: SesiTerapi): Promise<void>;
  /** Gagal dengan NotFoundError jika id tidak ada. */
  updateSesi(s: SesiTerapi): Promise<void>;
  /** Satu transaksi: sesi + seluruh foto miliknya. */
  deleteSesi(id: string): Promise<void>;
  addJadwal(j: JadwalKunjungan): Promise<void>;
  /** Gagal dengan NotFoundError jika id tidak ada. */
  updateJadwal(j: JadwalKunjungan): Promise<void>;
  deleteJadwal(id: string): Promise<void>;
  /** Satu transaksi: kosongkan pasien/sesi/jadwal, hapus foto yatim. */
  replaceAll(data: AppData): Promise<void>;

  /** Satu transaksi rw [pasien, sesi, foto, fotoData]; NotFoundError('pasien') bila pasien tidak ada. */
  saveSesiDenganFoto(
    sesi: SesiTerapi,
    mode: 'tambah' | 'ubah',
    perubahan: { tambah: FotoDiproses[]; hapusIds: string[] },
  ): Promise<FotoMeta[]>;
  loadFotoData(fotoId: string): Promise<ArrayBuffer>;
  savePengaturan(p: PengaturanLaporan, logoData?: ArrayBuffer | null): Promise<void>;
  loadLogoData(): Promise<ArrayBuffer | null>;
}

const ALL_TABLES = [...TABLE_NAMES];

/** Salinan dangkal agar objek milik pemanggil tidak pernah ikut tersimpan/dimutasi. */
function copy<T extends object>(o: T): T {
  return { ...o };
}

function byId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export class DexieRepository implements Repository {
  constructor(readonly db: DataPasienDb) {}

  async loadAll(): Promise<AppData> {
    return this.db.transaction('r', ['pasien', 'sesi', 'jadwal'], async () => {
      const [pasien, sesi, jadwal] = await Promise.all([
        this.db.pasien.toArray(),
        this.db.sesi.toArray(),
        this.db.jadwal.toArray(),
      ]);
      return {
        pasien: pasien.map(copy).sort(byId),
        sesi: sesi.map(copy).sort(byId),
        jadwal: jadwal.map(copy).sort(byId),
      };
    });
  }

  async loadAllFoto(): Promise<FotoMeta[]> {
    return this.db.transaction('r', ['foto'], async () => {
      const foto = await this.db.foto.toArray();
      return foto.map(copy).sort(byId);
    });
  }

  async loadPengaturan(): Promise<PengaturanLaporan | null> {
    return this.db.transaction('r', ['pengaturan'], async () => {
      const pengRec = await this.db.pengaturan.get('pengaturan');
      return pengRec
        ? {
            namaPraktik: pengRec.namaPraktik,
            alamatPraktik: pengRec.alamatPraktik,
            noHpPraktik: pengRec.noHpPraktik,
            logo: pengRec.logo ? copy(pengRec.logo) : null,
          }
        : null;
    });
  }

  async addPasien(p: Pasien): Promise<void> {
    await this.db.transaction('rw', ['pasien'], async () => {
      await this.db.pasien.add(copy(p));
    });
  }

  async updatePasien(p: Pasien): Promise<void> {
    await this.updateExisting('pasien', p);
  }

  /**
   * Ubah rekaman yang sudah ada. Catatan: Dexie memetakan ulang error yang
   * `name`-nya sama dengan nama DOMException IndexedDB (termasuk
   * "NotFoundError") menjadi DexieError, sehingga NotFoundError dilempar di luar
   * callback transaksi (setelah transaksi tanpa tulis selesai).
   */
  private async updateExisting<K extends 'pasien' | 'sesi' | 'jadwal'>(
    table: K,
    record: K extends 'pasien' ? Pasien : K extends 'sesi' ? SesiTerapi : JadwalKunjungan,
  ): Promise<void> {
    const found = await this.db.transaction('rw', [table], async () => {
      // Akses tabel saat operasi berjalan agar dapat dibungkus oleh uji.
      const t = this.db[table] as unknown as {
        get(id: string): Promise<unknown>;
        put(r: unknown): Promise<unknown>;
      };
      const existing = await t.get(record.id);
      if (!existing) return false;
      await t.put(copy(record));
      return true;
    });
    if (!found) throw new NotFoundError(table, record.id);
  }

  async deletePasienCascade(id: string): Promise<void> {
    await this.db.transaction('rw', ALL_TABLES, async () => {
      const sesiList = await this.db.sesi.where('pasienId').equals(id).toArray();
      const sesiIds = sesiList.map((s) => s.id);

      if (sesiIds.length > 0) {
        const fotoList = await this.db.foto.where('sesiId').anyOf(sesiIds).toArray();
        const fotoIds = fotoList.map((f) => f.id);
        if (fotoIds.length > 0) {
          await this.db.foto.bulkDelete(fotoIds);
          await this.db.fotoData.bulkDelete(fotoIds);
        }
      }

      await this.db.sesi.where('pasienId').equals(id).delete();
      await this.db.jadwal.where('pasienId').equals(id).delete();
      await this.db.pasien.delete(id);
    });
  }

  async addSesi(s: SesiTerapi): Promise<void> {
    await this.db.transaction('rw', ['sesi'], async () => {
      await this.db.sesi.add(copy(s));
    });
  }

  async updateSesi(s: SesiTerapi): Promise<void> {
    await this.updateExisting('sesi', s);
  }

  async deleteSesi(id: string): Promise<void> {
    await this.db.transaction('rw', ['sesi', 'foto', 'fotoData'], async () => {
      const fotoList = await this.db.foto.where('sesiId').equals(id).toArray();
      const fotoIds = fotoList.map((f) => f.id);
      if (fotoIds.length > 0) {
        await this.db.foto.bulkDelete(fotoIds);
        await this.db.fotoData.bulkDelete(fotoIds);
      }
      await this.db.sesi.delete(id);
    });
  }

  async saveSesiDenganFoto(
    sesi: SesiTerapi,
    mode: 'tambah' | 'ubah',
    perubahan: { tambah: FotoDiproses[]; hapusIds: string[] },
  ): Promise<FotoMeta[]> {
    return await this.db.transaction(
      'rw',
      ['pasien', 'sesi', 'foto', 'fotoData'],
      async () => {
        const pasienAda = await this.db.pasien.get(sesi.pasienId);
        if (!pasienAda) {
          throw new NotFoundError('pasien', sesi.pasienId);
        }

        if (mode === 'tambah') {
          await this.db.sesi.add(copy(sesi));
        } else {
          const sesiAda = await this.db.sesi.get(sesi.id);
          if (!sesiAda) {
            throw new NotFoundError('sesi', sesi.id);
          }
          await this.db.sesi.put(copy(sesi));
        }

        // Hapus foto yang dibuang
        if (perubahan.hapusIds.length > 0) {
          const fotoMilikSesi = await this.db.foto
            .where('sesiId')
            .equals(sesi.id)
            .toArray();
          const validHapusIds = fotoMilikSesi
            .filter((f) => perubahan.hapusIds.includes(f.id))
            .map((f) => f.id);
          if (validHapusIds.length > 0) {
            await this.db.foto.bulkDelete(validHapusIds);
            await this.db.fotoData.bulkDelete(validHapusIds);
          }
        }

        // Tambah foto baru
        if (perubahan.tambah.length > 0) {
          const sisaFoto = await this.db.foto
            .where('sesiId')
            .equals(sesi.id)
            .toArray();
          const maksUrutan = sisaFoto.reduce((m, f) => Math.max(m, f.urutan), 0);
          const now = Date.now();

          const baruMetaList: FotoMeta[] = [];
          const baruDataList: Array<{ id: string; data: ArrayBuffer }> = [];

          perubahan.tambah.forEach((foto, i) => {
            const id = newId();
            const meta: FotoMeta = {
              id,
              sesiId: sesi.id,
              urutan: maksUrutan + 1 + i,
              mime: foto.mime,
              ukuran: foto.ukuran,
              lebar: foto.lebar,
              tinggi: foto.tinggi,
              ditambahkanPada: now,
            };
            baruMetaList.push(meta);
            baruDataList.push({ id, data: foto.data });
          });

          await this.db.foto.bulkAdd(baruMetaList);
          await this.db.fotoData.bulkAdd(baruDataList);
        }

        const hasilFoto = await this.db.foto
          .where('sesiId')
          .equals(sesi.id)
          .toArray();
        return hasilFoto.sort((a, b) => a.urutan - b.urutan);
      },
    );
  }

  async loadFotoData(fotoId: string): Promise<ArrayBuffer> {
    const rec = await this.db.fotoData.get(fotoId);
    if (!rec) throw new NotFoundError('foto', fotoId);
    return rec.data;
  }

  async savePengaturan(p: PengaturanLaporan, logoData?: ArrayBuffer | null): Promise<void> {
    await this.db.transaction('rw', ['pengaturan', 'fotoData'], async () => {
      await this.db.pengaturan.put({ id: 'pengaturan', ...copy(p) });
      if (logoData !== undefined) {
        if (logoData !== null) {
          await this.db.fotoData.put({ id: 'logo-praktik', data: logoData });
        } else {
          await this.db.fotoData.delete('logo-praktik');
        }
      }
    });
  }

  async loadLogoData(): Promise<ArrayBuffer | null> {
    const rec = await this.db.fotoData.get('logo-praktik');
    return rec ? rec.data : null;
  }

  async addJadwal(j: JadwalKunjungan): Promise<void> {
    await this.db.transaction('rw', ['jadwal'], async () => {
      await this.db.jadwal.add(copy(j));
    });
  }

  async updateJadwal(j: JadwalKunjungan): Promise<void> {
    await this.updateExisting('jadwal', j);
  }

  async deleteJadwal(id: string): Promise<void> {
    await this.db.transaction('rw', ['jadwal'], async () => {
      await this.db.jadwal.delete(id);
    });
  }

  async replaceAll(data: AppData): Promise<void> {
    await this.db.transaction('rw', ['pasien', 'sesi', 'jadwal', 'foto', 'fotoData'], async () => {
      await this.db.pasien.clear();
      await this.db.sesi.clear();
      await this.db.jadwal.clear();
      await this.db.pasien.bulkAdd(data.pasien.map(copy));
      await this.db.sesi.bulkAdd(data.sesi.map(copy));
      await this.db.jadwal.bulkAdd(data.jadwal.map(copy));

      // Hapus foto yatim yang sesiId-nya tidak ada di data impor
      const sesiIdSet = new Set(data.sesi.map((s) => s.id));
      const allFoto = await this.db.foto.toArray();
      const yatimIds = allFoto.filter((f) => !sesiIdSet.has(f.sesiId)).map((f) => f.id);
      if (yatimIds.length > 0) {
        await this.db.foto.bulkDelete(yatimIds);
        await this.db.fotoData.bulkDelete(yatimIds);
      }
    });
  }

  /** Menutup koneksi basis data. */
  close(): void {
    this.db.close();
  }
}

export interface OpenRepositoryOptions {
  /** Default true: panggil navigator.storage.persist() (sekali per sesi) jika tersedia. */
  requestPersist?: boolean;
}

/**
 * Membuka basis data bernama `name` dan mengembalikan Repository di atasnya.
 * Membuka instance baru pada nama yang sama memberi akses ke data yang sama.
 */
export async function openRepository(
  name: string = DEFAULT_DB_NAME,
  options: OpenRepositoryOptions = {},
): Promise<DexieRepository> {
  if (options.requestPersist !== false) {
    // Tidak memblokir pembukaan bila persist lambat/ditolak.
    void requestPersistentStorage();
  }
  const db = createDb(name);
  await db.open();
  return new DexieRepository(db);
}
