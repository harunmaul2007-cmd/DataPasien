import { describe, expect, it } from 'vitest';
import { buildGrafikBulanan, jumlahHari, skalaSumbuY } from './grafik';
import type { Pasien, SesiTerapi } from './types';

const p = (id: string): Pasien => ({ id, nama: id, alamat: '', noHp: '', createdAt: 1, updatedAt: 1 }) as Pasien;
let n = 0;
const s = (pasienId: string, tanggal: string): SesiTerapi =>
  ({
    id: `s${n++}`,
    pasienId,
    tanggal,
    keluhan: 'k',
    polaPenyakit: '',
    terapi: 't',
    hasil: '',
    biaya: 0,
    createdAt: 1,
    updatedAt: 1,
  }) as SesiTerapi;

describe('buildGrafikBulanan', () => {
  it('menghitung pasien berbeda per hari, total pasien, total sesi, dan puncak', () => {
    const g = buildGrafikBulanan(
      2,
      2024,
      [
        s('a', '2024-02-01'),
        s('a', '2024-02-01'), // pasien sama di hari sama → 1
        s('b', '2024-02-01'),
        s('b', '2024-02-29'),
        s('c', '2024-03-01'), // bulan lain
        s('x', '2024-02-10'), // pasien sudah dihapus
      ],
      [p('a'), p('b'), p('c')],
    );
    expect(g.titik).toHaveLength(29); // kabisat
    expect(g.titik[0]).toEqual({ hari: 1, jumlahPasien: 2 });
    expect(g.titik[9]).toEqual({ hari: 10, jumlahPasien: 0 });
    expect(g.titik[28]).toEqual({ hari: 29, jumlahPasien: 1 });
    expect(g.totalPasien).toBe(2);
    expect(g.totalSesi).toBe(4);
    expect(g.puncak).toBe(2);
  });

  it('bulan tanpa sesi: semua titik 0', () => {
    const g = buildGrafikBulanan(4, 2025, [], [p('a')]);
    expect(g.titik).toHaveLength(30);
    expect(g.titik.every((t) => t.jumlahPasien === 0)).toBe(true);
    expect(g).toMatchObject({ totalPasien: 0, totalSesi: 0, puncak: 0 });
  });
});

describe('jumlahHari & skalaSumbuY', () => {
  it('jumlah hari per bulan', () => {
    expect(jumlahHari(2, 2023)).toBe(28);
    expect(jumlahHari(2, 2024)).toBe(29);
    expect(jumlahHari(12, 2025)).toBe(31);
  });

  it('skala sumbu Y bilangan bulat dan mencakup puncak', () => {
    expect(skalaSumbuY(0)).toEqual({ maks: 1, langkah: 1 });
    expect(skalaSumbuY(3)).toEqual({ maks: 3, langkah: 1 });
    expect(skalaSumbuY(7)).toEqual({ maks: 8, langkah: 2 });
    expect(skalaSumbuY(23)).toEqual({ maks: 25, langkah: 5 });
  });
});
