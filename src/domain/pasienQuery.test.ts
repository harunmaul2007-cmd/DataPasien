import { describe, expect, it } from 'vitest';
import { deletionSummary, lastTherapyDate, searchPasien, sortPasien } from './pasienQuery';
import type { FotoMeta, JadwalKunjungan, Pasien, SesiTerapi } from './types';

function pasien(id: string, nama: string, noHp = '081234567890'): Pasien {
  return { id, nama, alamat: '', noHp, createdAt: 0, updatedAt: 0 };
}

function sesi(id: string, pasienId: string, tanggal: string): SesiTerapi {
  return {
    id,
    pasienId,
    tanggal,
    keluhan: 'k',
    polaPenyakit: '',
    terapi: 't',
    hasil: '',
    biaya: 0,
    createdAt: 0,
    updatedAt: 0,
  };
}

function jadwal(id: string, pasienId: string, status: JadwalKunjungan['status']): JadwalKunjungan {
  return {
    id,
    pasienId,
    tanggal: '2025-01-10',
    jam: '09:30',
    catatan: '',
    status,
    createdAt: 0,
    updatedAt: 0,
  };
}

describe('sortPasien', () => {
  it('mengurutkan nama menaik tanpa membedakan huruf besar/kecil, tie-break id', () => {
    const list = [pasien('3', 'budi'), pasien('1', 'Andi'), pasien('2', 'Budi'), pasien('0', 'citra')];
    expect(sortPasien(list).map((p) => p.id)).toEqual(['1', '2', '3', '0']);
  });

  it('tidak memutasi input', () => {
    const list = [pasien('b', 'Zaki'), pasien('a', 'Ani')];
    const snapshot = structuredClone(list);
    sortPasien(list);
    expect(list).toEqual(snapshot);
  });
});

describe('searchPasien', () => {
  const list = [
    pasien('1', 'Siti Aminah', '081111111111'),
    pasien('2', 'Budi Santoso', '6282222222222'),
    pasien('3', 'ahmad', '+6283333333333'),
  ];

  it('kata kunci kosong atau whitespace mengembalikan semua pasien terurut', () => {
    expect(searchPasien(list, '').map((p) => p.id)).toEqual(['3', '2', '1']);
    expect(searchPasien(list, '   ').map((p) => p.id)).toEqual(['3', '2', '1']);
  });

  it('mencocokkan substring nama tanpa membedakan huruf besar/kecil dan men-trim kata kunci', () => {
    expect(searchPasien(list, '  AMI ').map((p) => p.id)).toEqual(['1']);
    expect(searchPasien(list, 'a').map((p) => p.id)).toEqual(['3', '2', '1']);
  });

  it('mencocokkan substring nomor HP', () => {
    expect(searchPasien(list, '8222').map((p) => p.id)).toEqual(['2']);
    expect(searchPasien(list, '+628').map((p) => p.id)).toEqual(['3']);
  });

  it('mengembalikan array kosong jika tidak ada yang cocok', () => {
    expect(searchPasien(list, 'xyz')).toEqual([]);
  });
});

describe('lastTherapyDate', () => {
  it('mengembalikan tanggal maksimum milik pasien', () => {
    const data = [
      sesi('a', 'p1', '2025-01-05'),
      sesi('b', 'p1', '2025-03-01'),
      sesi('c', 'p2', '2025-12-31'),
      sesi('d', 'p1', '2024-12-31'),
    ];
    expect(lastTherapyDate('p1', data)).toBe('2025-03-01');
  });

  it('mengembalikan null jika pasien belum punya sesi', () => {
    expect(lastTherapyDate('p9', [sesi('a', 'p1', '2025-01-05')])).toBeNull();
    expect(lastTherapyDate('p1', [])).toBeNull();
  });
});

describe('deletionSummary', () => {
  it('menghitung sesi dan jadwal semua status milik pasien', () => {
    const s = [sesi('a', 'p1', '2025-01-01'), sesi('b', 'p1', '2025-01-01'), sesi('c', 'p2', '2025-01-01')];
    const j = [
      jadwal('x', 'p1', 'Terjadwal'),
      jadwal('y', 'p1', 'Selesai'),
      jadwal('z', 'p1', 'Dibatalkan'),
      jadwal('w', 'p2', 'Terjadwal'),
    ];
    expect(deletionSummary('p1', s, j)).toEqual({ jumlahSesi: 2, jumlahJadwal: 3, jumlahFoto: 0 });
    expect(deletionSummary('p3', s, j)).toEqual({ jumlahSesi: 0, jumlahJadwal: 0, jumlahFoto: 0 });
  });

  it('menghitung foto sesi yang terkait dengan pasien', () => {
    const s = [sesi('s1', 'p1', '2025-01-01'), sesi('s2', 'p2', '2025-01-01')];
    const j = [jadwal('j1', 'p1', 'Terjadwal')];
    const f: FotoMeta[] = [
      { id: 'f1', sesiId: 's1', urutan: 1, mime: 'image/jpeg', ukuran: 100, lebar: 10, tinggi: 10, ditambahkanPada: 100 },
      { id: 'f2', sesiId: 's1', urutan: 2, mime: 'image/jpeg', ukuran: 100, lebar: 10, tinggi: 10, ditambahkanPada: 100 },
      { id: 'f3', sesiId: 's2', urutan: 1, mime: 'image/jpeg', ukuran: 100, lebar: 10, tinggi: 10, ditambahkanPada: 100 },
    ];
    expect(deletionSummary('p1', s, j, f)).toEqual({ jumlahSesi: 1, jumlahJadwal: 1, jumlahFoto: 2 });
  });
});
