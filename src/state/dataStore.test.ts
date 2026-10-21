// Unit test pemuatan DataStore (Req 2.4, 10.6, 10.7).
import { afterEach, describe, expect, it } from 'vitest';
import type { AppData, Pasien } from '../domain/types';
import { NotFoundError } from '../infra/errors';
import { DexieRepository, openRepository, type Repository } from '../infra/repository';
import { DataStore, StoreNotReadyError } from './dataStore';

let counter = 0;
const opened: DexieRepository[] = [];

async function freshRepo(): Promise<DexieRepository> {
  const repo = await openRepository(`test-store-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  return repo;
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

const WRITE_METHODS = [
  'addPasien',
  'updatePasien',
  'deletePasienCascade',
  'addSesi',
  'updateSesi',
  'deleteSesi',
  'addJadwal',
  'updateJadwal',
  'deleteJadwal',
  'replaceAll',
] as const;

/**
 * Membungkus Repository nyata: mencatat setiap pemanggilan metode tulis dan
 * (opsional) membuat loadAll gagal.
 */
function recording(inner: Repository, opts: { failLoad?: boolean } = {}): Repository & { writes: string[] } {
  const writes: string[] = [];
  const wrapper = {
    ...inner,
    writes,
    loadAll: () => (opts.failLoad ? Promise.reject(new Error('IndexedDB rusak')) : inner.loadAll()),
    loadAllFoto: () => (opts.failLoad ? Promise.reject(new Error('IndexedDB rusak')) : inner.loadAllFoto()),
    loadPengaturan: () => (opts.failLoad ? Promise.reject(new Error('IndexedDB rusak')) : inner.loadPengaturan()),
  } as Repository & { writes: string[] };
  for (const m of WRITE_METHODS) {
    (wrapper as unknown as Record<string, (...a: unknown[]) => Promise<void>>)[m] = (...args: unknown[]) => {
      writes.push(m);
      return (inner[m] as (...a: unknown[]) => Promise<void>)(...args);
    };
  }
  return wrapper;
}

const input = { nama: 'Ani', alamat: 'Jl. Melati', noHp: '081298765432' };

describe('DataStore.load', () => {
  it('basis data kosong → status ready dengan daftar kosong tanpa error (Req 10.7)', async () => {
    const store = new DataStore({ repository: await freshRepo() });
    expect(store.getState().status).toBe('loading');
    await store.load();
    const state = store.getState();
    expect(state.status).toBe('ready');
    expect(state.error).toBeUndefined();
    expect(state.data).toEqual({ pasien: [], sesi: [], jadwal: [] });
    expect(store.selectPasienList()).toEqual([]);
  });

  it('memuat data tersimpan ke memori', async () => {
    const repo = await freshRepo();
    const data: AppData = { pasien: [pasien('p1')], sesi: [], jadwal: [] };
    await repo.replaceAll(data);
    const store = new DataStore({ repository: repo });
    await store.load();
    expect(store.getState().status).toBe('ready');
    expect(store.getState().data).toEqual(data);
  });

  it('gagal memuat → status error, data kosong, tanpa penulisan apa pun (Req 10.6)', async () => {
    const inner = await freshRepo();
    await inner.addPasien(pasien('p1'));
    const repo = recording(inner, { failLoad: true });
    const store = new DataStore({ repository: repo });

    await expect(store.load()).resolves.toBeUndefined();
    const state = store.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBeInstanceOf(Error);
    expect(state.data).toEqual({ pasien: [], sesi: [], jadwal: [] });

    // Operasi tulis saat status error ditolak dan tidak menyentuh Repository.
    await expect(store.addPasien(input)).rejects.toBeInstanceOf(StoreNotReadyError);
    await expect(store.deletePasien('p1')).rejects.toBeInstanceOf(StoreNotReadyError);
    expect(repo.writes).toEqual([]);
    expect(await inner.loadAll()).toEqual({ pasien: [pasien('p1')], sesi: [], jadwal: [] });
  });

  it('fabrik Repository yang gagal → status error dan dapat dicoba lagi', async () => {
    const inner = await freshRepo();
    let attempts = 0;
    const store = new DataStore({
      repository: async () => {
        attempts++;
        if (attempts === 1) throw new Error('tidak dapat membuka basis data');
        return inner;
      },
    });
    await store.load();
    expect(store.getState().status).toBe('error');
    await store.load();
    expect(store.getState().status).toBe('ready');
    expect(attempts).toBe(2);
  });

  it('memberi tahu pelanggan saat status berubah', async () => {
    const store = new DataStore({ repository: await freshRepo() });
    const seen: string[] = [];
    const unsub = store.subscribe(() => seen.push(store.getState().status));
    await store.load();
    unsub();
    expect(seen).toEqual(['loading', 'ready']);
  });
});

describe('DataStore.updatePasien pada pasien yang sudah tidak ada (Req 2.4)', () => {
  it('melempar NotFoundError tanpa penulisan dan tanpa mengubah memori', async () => {
    const inner = await freshRepo();
    await inner.addPasien(pasien('p1'));
    const repo = recording(inner);
    const store = new DataStore({ repository: repo });
    await store.load();
    const before = store.getState().data;

    await expect(store.updatePasien('hilang', input)).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.writes).toEqual([]);
    expect(store.getState().data).toBe(before);
  });

  it('pasien dihapus di penyimpanan setelah dimuat → NotFoundError dari Repository, memori tidak berubah', async () => {
    const inner = await freshRepo();
    await inner.addPasien(pasien('p1'));
    const store = new DataStore({ repository: inner });
    await store.load();
    const before = store.getState().data;

    // Dihapus langsung di penyimpanan (mis. oleh tab lain) sehingga memori basi.
    await inner.deletePasienCascade('p1');
    await expect(store.updatePasien('p1', input)).rejects.toBeInstanceOf(NotFoundError);
    expect(store.getState().data).toBe(before);
    expect((await inner.loadAll()).pasien).toEqual([]);
  });
});
