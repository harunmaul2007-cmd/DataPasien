import { afterEach, describe, expect, it } from 'vitest';
import { parseBackup } from '../domain/cadangan';
import type { AppData } from '../domain/types';
import type { FileGateway } from '../infra/fileGateway';
import { DexieRepository, openRepository } from '../infra/repository';
import { DataStore, ExportError, ImportError } from './dataStore';

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

class MemoryGateway implements FileGateway {
  saved: { fileName: string; content: string }[] = [];
  savedBinary: { fileName: string; data: Uint8Array; mime: string }[] = [];
  next: string | null = null;
  fail = false;
  async saveText(fileName: string, content: string): Promise<{ location: string }> {
    if (this.fail) throw new Error('disk penuh');
    this.saved.push({ fileName, content });
    return { location: '/Documents' };
  }
  async saveBinary(fileName: string, data: Uint8Array, mime: string): Promise<{ fileName: string; location: string }> {
    if (this.fail) throw new Error('disk penuh');
    this.savedBinary.push({ fileName, data, mime });
    return { fileName, location: '/Documents' };
  }
  async pickTextFile(): Promise<string | null> {
    return this.next;
  }
}

const NOW = new Date(2025, 0, 5, 9, 30, 0);

async function setup(): Promise<{ store: DataStore; repo: DexieRepository; gw: MemoryGateway }> {
  const repo = await openRepository(`test-cadangan-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  const gw = new MemoryGateway();
  const store = new DataStore({ repository: repo, now: () => NOW, fileGateway: gw });
  await store.load();
  return { store, repo, gw };
}

const fileData: AppData = {
  pasien: [{ id: 'p1', nama: 'Budi', alamat: 'Jl. Mawar', noHp: '081234567890', umur: null, jenisKelamin: null, createdAt: 1, updatedAt: 2 }],
  sesi: [
    {
      id: 's1', pasienId: 'p1', tanggal: '2024-02-29', keluhan: 'Pegal', polaPenyakit: '',
      terapi: 'Pijat', hasil: '', biaya: 150000, createdAt: 3, updatedAt: 3,
    },
  ],
  jadwal: [
    {
      id: 'j1', pasienId: 'p1', tanggal: '2024-03-01', jam: '09:30', catatan: '',
      status: 'Selesai', createdAt: 4, updatedAt: 4,
    },
  ],
};

describe('DataStore ekspor/impor', () => {
  it('ekspor data kosong menghasilkan file valid dengan jumlah 0', async () => {
    const { store, gw } = await setup();
    const res = await store.exportBackup();
    expect(res).toEqual({
      fileName: 'datapasien-cadangan-20250105-0930.json',
      location: '/Documents',
      counts: { pasien: 0, sesi: 0, jadwal: 0 },
    });
    expect(gw.saved).toHaveLength(1);
    const parsed = parseBackup(gw.saved[0]!.content);
    expect(parsed.ok && parsed.counts).toEqual({ pasien: 0, sesi: 0, jadwal: 0 });
  });

  it('ekspor gagal melempar ExportError tanpa mengubah data', async () => {
    const { store, gw } = await setup();
    await store.addPasien({ nama: 'Ani', alamat: 'Jl. A', noHp: '081234567890' });
    const before = store.getState().data;
    gw.fail = true;
    await expect(store.exportBackup()).rejects.toBeInstanceOf(ExportError);
    expect(store.getState().data).toBe(before);
  });

  it('impor mengganti seluruh data di memori dan penyimpanan, idempoten', async () => {
    const { store, repo } = await setup();
    await store.addPasien({ nama: 'Lama', alamat: 'Jl. B', noHp: '081234567890' });
    expect(await store.importBackup(fileData)).toEqual({ pasien: 1, sesi: 1, jadwal: 1 });
    expect(await store.importBackup(fileData)).toEqual({ pasien: 1, sesi: 1, jadwal: 1 });
    expect(store.getState().data).toEqual(fileData);
    expect(await repo.loadAll()).toEqual(fileData);
  });

  it('ekspor lalu impor kembali menghasilkan data identik', async () => {
    const { store, gw } = await setup();
    await store.importBackup(fileData);
    await store.exportBackup();
    gw.next = gw.saved[0]!.content;
    const picked = await store.pickBackupFile();
    expect(picked?.ok).toBe(true);
    if (picked?.ok) expect(picked.data).toEqual(fileData);
  });

  it('impor gagal melempar ImportError; memori dan penyimpanan tidak berubah', async () => {
    const { store, repo } = await setup();
    await store.addPasien({ nama: 'Lama', alamat: 'Jl. B', noHp: '081234567890' });
    const before = store.getState().data;
    const stored = await repo.loadAll();
    // Sesi dengan id ganda membuat bulkAdd gagal di tengah transaksi.
    const bad: AppData = { ...fileData, sesi: [fileData.sesi[0]!, fileData.sesi[0]!] };
    await expect(store.importBackup(bad)).rejects.toBeInstanceOf(ImportError);
    expect(store.getState().data).toBe(before);
    expect(await repo.loadAll()).toEqual(stored);
  });

  it('pemilihan file dibatalkan → null', async () => {
    const { store, gw } = await setup();
    gw.next = null;
    expect(await store.pickBackupFile()).toBeNull();
  });
});
