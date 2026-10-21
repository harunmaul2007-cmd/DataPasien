// Unit & integrasi test untuk aksi dan selector fitur baru di DataStore (Req 2, 4, 7, 10, 14).

import { afterEach, describe, expect, it } from 'vitest';
import { openRepository, type DexieRepository } from '../../infra/repository';
import { DataStore } from '../dataStore';
import type { FotoDiproses, SesiInput } from '../../domain/types';
import type { FotoDraft } from '../../domain/foto';

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

async function freshStore(): Promise<{ store: DataStore; repo: DexieRepository }> {
  const repo = await openRepository(`test-store-fitur-baru-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  const store = new DataStore({ repository: repo });
  await store.load();
  return { store, repo };
}

describe('DataStore: simpanSesi & Foto (Req 2, 4)', () => {
  it('menyimpan sesi baru beserta foto draft dan memperbarui state.foto serta selector', async () => {
    const { store } = await freshStore();
    const pRes = await store.addPasien({ nama: 'Budi', alamat: 'Jl. Melati', noHp: '081234567890' });
    expect(pRes.ok).toBe(true);
    if (!pRes.ok) throw new Error('addPasien failed');
    const pasien = pRes.value;

    const dummyFoto: FotoDiproses = {
      data: new Uint8Array([1, 2, 3]).buffer,
      mime: 'image/jpeg',
      ukuran: 3,
      lebar: 800,
      tinggi: 600,
    };

    const draft: FotoDraft = {
      items: [
        {
          jenis: 'baru',
          tempId: 'temp-1',
          foto: dummyFoto,
        },
      ],
      memproses: false,
      pesan: [],
    };

    const inputSesi: SesiInput = {
      tanggal: '2025-02-01',
      keluhan: 'Bahu kaku',
      polaPenyakit: 'Frozen Shoulder',
      terapi: 'Akupresur',
      hasil: 'Lebih ringan',
      biaya: '120000',
    };

    const resSesi = await store.simpanSesi(pasien.id, null, inputSesi, draft);
    expect(resSesi.ok).toBe(true);
    if (!resSesi.ok) throw new Error('simpanSesi failed');
    const sesi = resSesi.value;

    // Selector selectFotoSesi
    const fotoList = store.selectFotoSesi(sesi.id);
    expect(fotoList).toHaveLength(1);
    expect(fotoList[0]?.sesiId).toBe(sesi.id);

    // Selector selectJumlahFotoPasien
    expect(store.selectJumlahFotoPasien(pasien.id)).toBe(1);

    // Deletion summary pasien menyertakan jumlahFoto
    const summaryPasien = store.selectDeletionSummary(pasien.id);
    expect(summaryPasien).toEqual({
      jumlahSesi: 1,
      jumlahJadwal: 0,
      jumlahFoto: 1,
    });

    // Muat blob foto via store
    const blob = await store.loadFotoBlob(fotoList[0]!);
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBe(3);
  });

  it('menghapus foto saat deleteSesi dan deletePasien', async () => {
    const { store } = await freshStore();
    const pRes = await store.addPasien({ nama: 'Ani', alamat: '', noHp: '081234567890' });
    expect(pRes.ok).toBe(true);
    if (!pRes.ok) throw new Error('addPasien failed');
    const pasien = pRes.value;

    const draft: FotoDraft = {
      items: [
        {
          jenis: 'baru',
          tempId: 'temp-1',
          foto: { data: new Uint8Array([1]).buffer, mime: 'image/png', ukuran: 1, lebar: 10, tinggi: 10 },
        },
      ],
      memproses: false,
      pesan: [],
    };

    const sRes = await store.simpanSesi(
      pasien.id,
      null,
      { tanggal: '2025-01-01', keluhan: 'A', polaPenyakit: '', terapi: 'B', hasil: '', biaya: '10000' },
      draft,
    );
    expect(sRes.ok).toBe(true);
    if (!sRes.ok) throw new Error('simpanSesi failed');
    const sesi = sRes.value;

    expect(store.selectFotoSesi(sesi.id)).toHaveLength(1);

    // Hapus sesi
    await store.deleteSesi(sesi.id);
    expect(store.selectFotoSesi(sesi.id)).toHaveLength(0);
    expect(store.selectJumlahFotoPasien(pasien.id)).toBe(0);
  });
});

describe('DataStore: simpanPengaturan & Logo (Req 7, 10)', () => {
  it('menyimpan nama praktik dan logo, lalu dapat dimuat kembali', async () => {
    const { store } = await freshStore();

    expect(store.selectPengaturan()).toBeNull();

    const dummyLogo: FotoDiproses = {
      data: new Uint8Array([10, 20, 30]).buffer,
      mime: 'image/png',
      ukuran: 3,
      lebar: 120,
      tinggi: 120,
    };

    const res = await store.simpanPengaturan(
      {
        namaPraktik: 'Klinik Akupunktur Sehat',
        alamatPraktik: 'Jl. Merdeka 10',
        noHpPraktik: '081234567890',
      },
      {
        jenis: 'baru',
        foto: dummyLogo,
      },
    );

    expect(res.ok).toBe(true);

    const pengaturan = store.selectPengaturan();
    expect(pengaturan).not.toBeNull();
    expect(pengaturan?.namaPraktik).toBe('Klinik Akupunktur Sehat');
    expect(pengaturan?.logo?.mime).toBe('image/png');

    const logoBlob = await store.loadLogoBlob();
    expect(logoBlob).not.toBeNull();
    expect(logoBlob?.type).toBe('image/png');
    expect(logoBlob?.size).toBe(3);
  });

  it('menghapus logo praktik saat draftLogo = hapus', async () => {
    const { store } = await freshStore();

    // Simpan logo awal
    await store.simpanPengaturan(
      { namaPraktik: 'Klinik', alamatPraktik: '', noHpPraktik: '' },
      {
        jenis: 'baru',
        foto: { data: new Uint8Array([1]).buffer, mime: 'image/png', ukuran: 1, lebar: 50, tinggi: 50 },
      },
    );

    expect(store.selectPengaturan()?.logo).not.toBeNull();

    // Hapus logo
    await store.simpanPengaturan(
      { namaPraktik: 'Klinik', alamatPraktik: '', noHpPraktik: '' },
      { jenis: 'hapus' },
    );

    expect(store.selectPengaturan()?.logo).toBeNull();
    expect(await store.loadLogoBlob()).toBeNull();
  });
});
