// Test integrasi DexieRepository untuk operasi foto, pengaturan, dan cascade deletion (Req 2, 4, 9, 10).

import { afterEach, describe, expect, it } from 'vitest';
import { openRepository, type DexieRepository } from '../repository';
import type { FotoDiproses, Pasien, SesiTerapi } from '../../domain/types';

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

async function freshRepo(): Promise<DexieRepository> {
  const repo = await openRepository(`test-repo-foto-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  return repo;
}

const dummyPasien: Pasien = {
  id: 'pasien-1',
  nama: 'Budi Santoso',
  alamat: 'Jl. Mawar',
  noHp: '081234567890',
  umur: 30,
  jenisKelamin: 'Laki-laki',
  createdAt: 100,
  updatedAt: 100,
};

const dummySesi: SesiTerapi = {
  id: 'sesi-1',
  pasienId: 'pasien-1',
  tanggal: '2025-01-10',
  keluhan: 'Punggung sakit',
  polaPenyakit: 'Qi Stagnation',
  terapi: 'Bekam',
  hasil: 'Enak',
  biaya: 100000,
  createdAt: 200,
  updatedAt: 200,
};

describe('DexieRepository: saveSesiDenganFoto & Foto Cascade (Req 2, 4)', () => {
  it('menyimpan sesi bersama foto secara atomik dan dapat dimuat kembali', async () => {
    const repo = await freshRepo();
    await repo.addPasien(dummyPasien);

    const foto1: FotoDiproses = {
      data: new Uint8Array([1, 2, 3, 4]).buffer,
      mime: 'image/jpeg',
      ukuran: 4,
      lebar: 800,
      tinggi: 600,
    };
    const foto2: FotoDiproses = {
      data: new Uint8Array([5, 6, 7, 8]).buffer,
      mime: 'image/png',
      ukuran: 4,
      lebar: 400,
      tinggi: 400,
    };

    const savedMetas = await repo.saveSesiDenganFoto(dummySesi, 'tambah', {
      tambah: [foto1, foto2],
      hapusIds: [],
    });

    expect(savedMetas).toHaveLength(2);
    expect(savedMetas[0]?.sesiId).toBe('sesi-1');
    expect(savedMetas[0]?.urutan).toBe(1);
    expect(savedMetas[1]?.urutan).toBe(2);

    // Muat binary data
    const buf1 = await repo.loadFotoData(savedMetas[0]!.id);
    expect(new Uint8Array(buf1)).toEqual(new Uint8Array([1, 2, 3, 4]));

    const allFoto = await repo.loadAllFoto();
    expect(allFoto).toHaveLength(2);
  });

  it('menghapus foto spesifik saat mode ubah', async () => {
    const repo = await freshRepo();
    await repo.addPasien(dummyPasien);

    const f1: FotoDiproses = {
      data: new Uint8Array([1, 1]).buffer,
      mime: 'image/jpeg',
      ukuran: 2,
      lebar: 100,
      tinggi: 100,
    };
    const f2: FotoDiproses = {
      data: new Uint8Array([2, 2]).buffer,
      mime: 'image/jpeg',
      ukuran: 2,
      lebar: 100,
      tinggi: 100,
    };

    const metas = await repo.saveSesiDenganFoto(dummySesi, 'tambah', {
      tambah: [f1, f2],
      hapusIds: [],
    });

    // Ubah sesi: hapus foto pertama
    const idHapus = metas[0]!.id;
    const sisaMetas = await repo.saveSesiDenganFoto(dummySesi, 'ubah', {
      tambah: [],
      hapusIds: [idHapus],
    });

    expect(sisaMetas).toHaveLength(1);
    expect(sisaMetas[0]?.id).toBe(metas[1]!.id);

    // Verifikasi foto terhapus tidak ada di db
    await expect(repo.loadFotoData(idHapus)).rejects.toThrow();
  });

  it('deleteSesi menghapus sesi beserta seluruh foto miliknya (Req 4.1, 4.3)', async () => {
    const repo = await freshRepo();
    await repo.addPasien(dummyPasien);

    const f: FotoDiproses = {
      data: new Uint8Array([9, 9]).buffer,
      mime: 'image/jpeg',
      ukuran: 2,
      lebar: 100,
      tinggi: 100,
    };
    const metas = await repo.saveSesiDenganFoto(dummySesi, 'tambah', {
      tambah: [f],
      hapusIds: [],
    });

    expect(await repo.loadAllFoto()).toHaveLength(1);

    await repo.deleteSesi('sesi-1');

    expect(await repo.loadAllFoto()).toHaveLength(0);
    await expect(repo.loadFotoData(metas[0]!.id)).rejects.toThrow();
  });

  it('deletePasienCascade menghapus pasien, seluruh sesi, dan seluruh foto (Req 4.2, 4.3)', async () => {
    const repo = await freshRepo();
    await repo.addPasien(dummyPasien);

    const f: FotoDiproses = {
      data: new Uint8Array([10, 10]).buffer,
      mime: 'image/jpeg',
      ukuran: 2,
      lebar: 100,
      tinggi: 100,
    };
    const metas = await repo.saveSesiDenganFoto(dummySesi, 'tambah', {
      tambah: [f],
      hapusIds: [],
    });

    await repo.deletePasienCascade('pasien-1');

    const appData = await repo.loadAll();
    expect(appData.pasien).toHaveLength(0);
    expect(appData.sesi).toHaveLength(0);
    expect(await repo.loadAllFoto()).toHaveLength(0);
    await expect(repo.loadFotoData(metas[0]!.id)).rejects.toThrow();
  });

  it('replaceAll membersihkan foto yatim (Req 9.5)', async () => {
    const repo = await freshRepo();
    await repo.addPasien(dummyPasien);

    const f: FotoDiproses = {
      data: new Uint8Array([1, 1]).buffer,
      mime: 'image/jpeg',
      ukuran: 2,
      lebar: 100,
      tinggi: 100,
    };
    await repo.saveSesiDenganFoto(dummySesi, 'tambah', { tambah: [f], hapusIds: [] });

    // Timpa database dengan data cadangan yang TIDAK memuat sesi-1
    await repo.replaceAll({
      pasien: [dummyPasien],
      sesi: [], // sesi-1 tidak ada di impor
      jadwal: [],
    });

    // Foto yatim harus dibersihkan otomatis
    expect(await repo.loadAllFoto()).toHaveLength(0);
  });
});

describe('DexieRepository: Pengaturan & Logo Praktik (Req 10)', () => {
  it('menyimpan dan memuat pengaturan praktik beserta data logo', async () => {
    const repo = await freshRepo();

    const logoBuf = new Uint8Array([100, 101, 102]).buffer;
    await repo.savePengaturan(
      {
        namaPraktik: 'Klinik Terapi Tradisional',
        alamatPraktik: 'Jl. Sudirman 1',
        noHpPraktik: '081234567890',
        logo: {
          mime: 'image/png',
          lebar: 150,
          tinggi: 150,
          ukuran: 3,
          diperbaruiPada: 12345,
        },
      },
      logoBuf,
    );

    const pengaturan = await repo.loadPengaturan();
    expect(pengaturan).not.toBeNull();
    expect(pengaturan?.namaPraktik).toBe('Klinik Terapi Tradisional');
    expect(pengaturan?.logo?.mime).toBe('image/png');

    const loadedLogoData = await repo.loadLogoData();
    expect(loadedLogoData).not.toBeNull();
    expect(new Uint8Array(loadedLogoData!)).toEqual(new Uint8Array([100, 101, 102]));
  });

  it('menghapus logo saat savePengaturan menerima logoData null', async () => {
    const repo = await freshRepo();

    const logoBuf = new Uint8Array([1, 2, 3]).buffer;
    await repo.savePengaturan(
      {
        namaPraktik: 'Klinik Terapi',
        alamatPraktik: '',
        noHpPraktik: '',
        logo: { mime: 'image/png', lebar: 100, tinggi: 100, ukuran: 3, diperbaruiPada: 1 },
      },
      logoBuf,
    );

    // Hapus logo
    await repo.savePengaturan(
      {
        namaPraktik: 'Klinik Terapi',
        alamatPraktik: '',
        noHpPraktik: '',
        logo: null,
      },
      null,
    );

    const pengaturan = await repo.loadPengaturan();
    expect(pengaturan?.logo).toBeNull();
    expect(await repo.loadLogoData()).toBeNull();
  });
});
