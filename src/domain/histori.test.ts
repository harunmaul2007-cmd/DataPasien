import { describe, expect, it } from 'vitest';
import { buildHistori } from './histori';
import type { SesiTerapi } from './types';

function sesi(over: Partial<SesiTerapi> & Pick<SesiTerapi, 'id'>): SesiTerapi {
  return {
    pasienId: 'p1',
    tanggal: '2025-01-05',
    keluhan: 'Pegal',
    polaPenyakit: '',
    terapi: 'Pijat',
    hasil: '',
    biaya: 100000,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe('buildHistori', () => {
  it('hanya memuat sesi milik pasien, urut tanggal menurun lalu createdAt menurun', () => {
    const data = [
      sesi({ id: 'a', tanggal: '2025-01-05', createdAt: 1 }),
      sesi({ id: 'b', tanggal: '2025-02-01', createdAt: 2 }),
      sesi({ id: 'c', tanggal: '2025-01-05', createdAt: 3 }),
      sesi({ id: 'x', pasienId: 'p2', tanggal: '2025-03-01' }),
    ];
    const h = buildHistori('p1', data);
    expect(h.items.map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(h.jumlah).toBe(3);
    expect(h.totalBiaya).toBe(300000);
  });

  it('menghitung totalBiaya termasuk biaya 0', () => {
    const h = buildHistori('p1', [
      sesi({ id: 'a', biaya: 0 }),
      sesi({ id: 'b', biaya: 150000, tanggal: '2024-12-31' }),
    ]);
    expect(h.totalBiaya).toBe(150000);
    expect(h.jumlah).toBe(2);
  });

  it('pasien tanpa sesi menghasilkan histori kosong', () => {
    const h = buildHistori('p1', [sesi({ id: 'x', pasienId: 'p2' })]);
    expect(h).toEqual({ items: [], jumlah: 0, totalBiaya: 0 });
  });

  it('memakai id sebagai tie-break akhir dan tidak mengubah input', () => {
    const data = [
      sesi({ id: 'z', createdAt: 5 }),
      sesi({ id: 'm', createdAt: 5 }),
    ];
    const salinan = structuredClone(data);
    const h = buildHistori('p1', data);
    expect(h.items.map((s) => s.id)).toEqual(['m', 'z']);
    expect(data).toEqual(salinan);
    expect(data.map((s) => s.id)).toEqual(['z', 'm']);
  });
});
