import { describe, expect, it } from 'vitest';
import { buildLaporan, pilihanTahun } from './laporan';
import type { Pasien, SesiTerapi } from './types';

function pasien(id: string, nama: string): Pasien {
  return { id, nama, alamat: '', noHp: '081234567890', createdAt: 0, updatedAt: 0 };
}

function sesi(id: string, pasienId: string, tanggal: string, biaya: number): SesiTerapi {
  return {
    id,
    pasienId,
    tanggal,
    keluhan: 'Pegal',
    polaPenyakit: '',
    terapi: `Terapi ${id}`,
    hasil: '',
    biaya,
    createdAt: 0,
    updatedAt: 0,
  };
}

const daftarPasien = [pasien('p1', 'budi'), pasien('p2', 'Ani'), pasien('p3', 'Citra')];

describe('buildLaporan', () => {
  it('hanya menyertakan sesi pada bulan & tahun terpilih, termasuk batas bulan dan biaya 0', () => {
    const data = [
      sesi('s1', 'p1', '2024-02-01', 100000),
      sesi('s2', 'p2', '2024-02-29', 0),
      sesi('s3', 'p1', '2024-01-31', 50000),
      sesi('s4', 'p3', '2024-03-01', 70000),
      sesi('s5', 'p1', '2023-02-15', 20000),
      sesi('s6', 'p1', '2024-02-10', 25000),
    ];
    const r = buildLaporan(2, 2024, data, daftarPasien);
    expect(r.rincian.map((x) => x.id)).toEqual(['s1', 's6', 's2']);
    expect(r.total).toBe(125000);
    expect(r.jumlahSesi).toBe(3);
    expect(r.jumlahPasien).toBe(2);
    expect(r.rincian[2]).toEqual({
      id: 's2',
      tanggal: '2024-02-29',
      namaPasien: 'Ani',
      terapi: 'Terapi s2',
      biaya: 0,
    });
  });

  it('mengurutkan tanggal yang sama berdasarkan nama pasien (case-insensitive)', () => {
    const data = [
      sesi('s1', 'p3', '2025-01-05', 1),
      sesi('s2', 'p1', '2025-01-05', 1),
      sesi('s3', 'p2', '2025-01-05', 1),
      sesi('s4', 'p1', '2025-01-03', 1),
    ];
    const r = buildLaporan(1, 2025, data, daftarPasien);
    expect(r.rincian.map((x) => x.namaPasien)).toEqual(['budi', 'Ani', 'budi', 'Citra']);
  });

  it('mengabaikan sesi yang pasiennya tidak ada', () => {
    const data = [sesi('s1', 'hilang', '2025-05-01', 99000), sesi('s2', 'p1', '2025-05-02', 1000)];
    const r = buildLaporan(5, 2025, data, daftarPasien);
    expect(r.rincian.map((x) => x.id)).toEqual(['s2']);
    expect(r.total).toBe(1000);
    expect(r.jumlahPasien).toBe(1);
  });

  it('mengembalikan laporan kosong bila tidak ada sesi', () => {
    expect(buildLaporan(7, 2025, [], daftarPasien)).toEqual({
      total: 0,
      jumlahSesi: 0,
      jumlahPasien: 0,
      rincian: [],
    });
  });

  it('total dua belas bulan sama dengan total tahunan', () => {
    const data = [
      sesi('s1', 'p1', '2024-01-01', 10),
      sesi('s2', 'p2', '2024-06-15', 20),
      sesi('s3', 'p3', '2024-12-31', 30),
      sesi('s4', 'p3', '2025-01-01', 40),
    ];
    let sum = 0;
    for (let b = 1; b <= 12; b++) sum += buildLaporan(b, 2024, data, daftarPasien).total;
    expect(sum).toBe(60);
  });

  it('tidak memutasi input', () => {
    const data = [sesi('s1', 'p1', '2025-01-05', 1), sesi('s2', 'p2', '2025-01-01', 1)];
    const salinan = structuredClone(data);
    buildLaporan(1, 2025, data, daftarPasien);
    expect(data).toEqual(salinan);
  });
});

describe('pilihanTahun', () => {
  it('berisi 2000 sampai tahun berjalan + 1, menaik', () => {
    const t = pilihanTahun(new Date(2025, 5, 1));
    expect(t[0]).toBe(2000);
    expect(t[t.length - 1]).toBe(2026);
    expect(t).toHaveLength(27);
  });
});
