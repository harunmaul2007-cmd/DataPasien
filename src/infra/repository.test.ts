import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppData, JadwalKunjungan, Pasien, SesiTerapi } from '../domain/types';
import { requestPersistentStorage, resetPersistRequestForTest } from './db';
import { NotFoundError } from './errors';
import { DexieRepository, openRepository } from './repository';

let counter = 0;
const opened: DexieRepository[] = [];

async function freshRepo(): Promise<{ repo: DexieRepository; name: string }> {
  const name = `test-repo-${Date.now()}-${counter++}`;
  const repo = await openRepository(name, { requestPersist: false });
  opened.push(repo);
  return { repo, name };
}

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

const pasien = (id: string, nama = 'Budi'): Pasien => ({
  id,
  nama,
  alamat: 'Jl. Mawar',
  noHp: '081234567890',
  createdAt: 1,
  updatedAt: 1,
});

const sesi = (id: string, pasienId: string): SesiTerapi => ({
  id,
  pasienId,
  tanggal: '2025-01-05',
  keluhan: 'Pegal',
  polaPenyakit: '',
  terapi: 'Pijat',
  hasil: '',
  biaya: 150000,
  createdAt: 1,
  updatedAt: 1,
});

const jadwal = (id: string, pasienId: string): JadwalKunjungan => ({
  id,
  pasienId,
  tanggal: '2025-01-10',
  jam: '09:30',
  catatan: '',
  status: 'Terjadwal',
  createdAt: 1,
  updatedAt: 1,
});

describe('DexieRepository', () => {
  it('basis data kosong menghasilkan AppData kosong', async () => {
    const { repo } = await freshRepo();
    expect(await repo.loadAll()).toEqual({ pasien: [], sesi: [], jadwal: [] });
  });

  it('data bertahan saat dibuka ulang dengan instance baru (round-trip)', async () => {
    const { repo, name } = await freshRepo();
    await repo.addPasien(pasien('p1', 'Sri Wahyuni ✨'));
    await repo.addSesi(sesi('s1', 'p1'));
    await repo.addJadwal(jadwal('j1', 'p1'));
    repo.close();

    const repo2 = await openRepository(name, { requestPersist: false });
    opened.push(repo2);
    expect(await repo2.loadAll()).toEqual({
      pasien: [pasien('p1', 'Sri Wahyuni ✨')],
      sesi: [sesi('s1', 'p1')],
      jadwal: [jadwal('j1', 'p1')],
    });
  });

  it('tidak memutasi objek pemanggil dan hasil loadAll terurut id', async () => {
    const { repo } = await freshRepo();
    const b = pasien('b');
    const a = pasien('a');
    await repo.addPasien(b);
    await repo.addPasien(a);
    const data = await repo.loadAll();
    expect(data.pasien.map((p) => p.id)).toEqual(['a', 'b']);
    data.pasien[0]!.nama = 'diubah';
    expect(a.nama).toBe('Budi');
    expect((await repo.loadAll()).pasien[0]!.nama).toBe('Budi');
  });

  it('update mengganti rekaman yang ada', async () => {
    const { repo } = await freshRepo();
    await repo.addPasien(pasien('p1'));
    await repo.addSesi(sesi('s1', 'p1'));
    await repo.addJadwal(jadwal('j1', 'p1'));
    await repo.updatePasien({ ...pasien('p1'), nama: 'Ani', updatedAt: 2 });
    await repo.updateSesi({ ...sesi('s1', 'p1'), biaya: 0 });
    await repo.updateJadwal({ ...jadwal('j1', 'p1'), status: 'Selesai' });
    const data = await repo.loadAll();
    expect(data.pasien[0]!.nama).toBe('Ani');
    expect(data.sesi[0]!.biaya).toBe(0);
    expect(data.jadwal[0]!.status).toBe('Selesai');
  });

  it('update dengan id tidak ada melempar NotFoundError tanpa menulis', async () => {
    const { repo } = await freshRepo();
    await expect(repo.updatePasien(pasien('x'))).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.updateSesi(sesi('x', 'p'))).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.updateJadwal(jadwal('x', 'p'))).rejects.toBeInstanceOf(NotFoundError);
    expect(await repo.loadAll()).toEqual({ pasien: [], sesi: [], jadwal: [] });
  });

  it('add dengan id ganda ditolak', async () => {
    const { repo } = await freshRepo();
    await repo.addPasien(pasien('p1'));
    await expect(repo.addPasien(pasien('p1', 'Lain'))).rejects.toThrow();
    expect((await repo.loadAll()).pasien).toEqual([pasien('p1')]);
  });

  it('deletePasienCascade hanya menghapus pasien beserta sesi & jadwal miliknya', async () => {
    const { repo } = await freshRepo();
    await repo.replaceAll({
      pasien: [pasien('p1'), pasien('p2')],
      sesi: [sesi('s1', 'p1'), sesi('s2', 'p1'), sesi('s3', 'p2')],
      jadwal: [jadwal('j1', 'p1'), { ...jadwal('j2', 'p1'), status: 'Dibatalkan' }, jadwal('j3', 'p2')],
    });
    await repo.deletePasienCascade('p1');
    expect(await repo.loadAll()).toEqual({
      pasien: [pasien('p2')],
      sesi: [sesi('s3', 'p2')],
      jadwal: [jadwal('j3', 'p2')],
    });
  });

  it('deleteSesi dan deleteJadwal menghapus satu rekaman', async () => {
    const { repo } = await freshRepo();
    await repo.addPasien(pasien('p1'));
    await repo.addSesi(sesi('s1', 'p1'));
    await repo.addSesi(sesi('s2', 'p1'));
    await repo.addJadwal(jadwal('j1', 'p1'));
    await repo.deleteSesi('s1');
    await repo.deleteJadwal('j1');
    const data = await repo.loadAll();
    expect(data.sesi.map((s) => s.id)).toEqual(['s2']);
    expect(data.jadwal).toEqual([]);
    expect(data.pasien).toHaveLength(1);
  });

  it('replaceAll mengganti seluruh isi; gagal di tengah membatalkan semuanya', async () => {
    const { repo } = await freshRepo();
    await repo.addPasien(pasien('lama'));
    const baru: AppData = { pasien: [pasien('p1')], sesi: [sesi('s1', 'p1')], jadwal: [] };
    await repo.replaceAll(baru);
    expect(await repo.loadAll()).toEqual(baru);

    // id sesi ganda → bulkAdd gagal setelah clear; seluruh transaksi harus batal.
    await expect(
      repo.replaceAll({ pasien: [pasien('p9')], sesi: [sesi('dup', 'p9'), sesi('dup', 'p9')], jadwal: [] }),
    ).rejects.toThrow();
    expect(await repo.loadAll()).toEqual(baru);
  });
});

describe('requestPersistentStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetPersistRequestForTest();
  });

  it('memanggil navigator.storage.persist sekali jika tersedia', async () => {
    resetPersistRequestForTest();
    const persist = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('navigator', { storage: { persist } });
    expect(await requestPersistentStorage()).toBe(true);
    await requestPersistentStorage();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('tidak melempar jika API tidak tersedia', async () => {
    resetPersistRequestForTest();
    vi.stubGlobal('navigator', {});
    expect(await requestPersistentStorage()).toBe(false);
  });
});
