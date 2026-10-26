import { describe, expect, it } from 'vitest';
import { aksiTersedia, jadwalPadaTanggal, jadwalTerjadwalPasien, semuaJadwal, transisiStatus } from './jadwal';
import type { JadwalKunjungan } from './types';

function mk(over: Partial<JadwalKunjungan>): JadwalKunjungan {
  return {
    id: 'id',
    pasienId: 'p1',
    tanggal: '2025-01-10',
    jam: '09:00',
    catatan: '',
    status: 'Terjadwal',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

describe('jadwalPadaTanggal', () => {
  it('mengembalikan semua status pada tanggal itu, urut jam menaik', () => {
    const list = [
      mk({ id: 'a', jam: '14:00', status: 'Selesai' }),
      mk({ id: 'b', jam: '08:30', status: 'Dibatalkan' }),
      mk({ id: 'c', jam: '10:00', tanggal: '2025-01-11' }),
      mk({ id: 'd', jam: '09:15' }),
    ];
    expect(jadwalPadaTanggal('2025-01-10', list).map((j) => j.id)).toEqual(['b', 'd', 'a']);
  });

  it('tie-break deterministik: createdAt lalu id', () => {
    const list = [
      mk({ id: 'z', createdAt: 2 }),
      mk({ id: 'y', createdAt: 1 }),
      mk({ id: 'x', createdAt: 2 }),
    ];
    expect(jadwalPadaTanggal('2025-01-10', list).map((j) => j.id)).toEqual(['y', 'x', 'z']);
  });

  it('kosong jika tidak ada jadwal dan tidak memutasi input', () => {
    const list = [mk({ id: 'b', jam: '10:00' }), mk({ id: 'a', jam: '08:00' })];
    const snapshot = structuredClone(list);
    expect(jadwalPadaTanggal('2030-01-01', list)).toEqual([]);
    jadwalPadaTanggal('2025-01-10', list);
    expect(list).toEqual(snapshot);
  });
});

describe('jadwalTerjadwalPasien', () => {
  it('hanya Terjadwal milik pasien, urut tanggal lalu jam', () => {
    const list = [
      mk({ id: 'a', tanggal: '2025-02-01', jam: '08:00' }),
      mk({ id: 'b', tanggal: '2025-01-15', jam: '13:00' }),
      mk({ id: 'c', tanggal: '2025-01-15', jam: '09:00' }),
      mk({ id: 'd', status: 'Selesai' }),
      mk({ id: 'e', status: 'Dibatalkan' }),
      mk({ id: 'f', pasienId: 'p2' }),
    ];
    expect(jadwalTerjadwalPasien('p1', list).map((j) => j.id)).toEqual(['c', 'b', 'a']);
    expect(jadwalTerjadwalPasien('p3', list)).toEqual([]);
  });
});

describe('semuaJadwal', () => {
  it('mengembalikan seluruh jadwal terurut berdasarkan tanggal lalu jam menaik', () => {
    const list = [
      mk({ id: 'a', tanggal: '2025-03-15', jam: '14:00' }),
      mk({ id: 'b', tanggal: '2025-02-10', jam: '11:00' }),
      mk({ id: 'c', tanggal: '2025-02-10', jam: '09:00' }),
      mk({ id: 'd', tanggal: '2025-04-01', jam: '08:00' }),
    ];
    expect(semuaJadwal(list).map((j) => j.id)).toEqual(['c', 'b', 'a', 'd']);
  });
});

describe('transisiStatus', () => {
  it('Terjadwal → Selesai/Dibatalkan, field lain tetap jika now tidak diberikan', () => {
    const j = mk({ id: 'a', catatan: 'kontrol', updatedAt: 5 });
    expect(transisiStatus(j, 'Selesai')).toEqual({ ...j, status: 'Selesai' });
    expect(transisiStatus(j, 'Dibatalkan')).toEqual({ ...j, status: 'Dibatalkan' });
    expect(j.status).toBe('Terjadwal');
  });

  it('memperbarui updatedAt jika now diberikan', () => {
    const j = mk({ updatedAt: 5 });
    expect(transisiStatus(j, 'Selesai', 99)).toEqual({ ...j, status: 'Selesai', updatedAt: 99 });
  });

  it('null jika status bukan Terjadwal', () => {
    expect(transisiStatus(mk({ status: 'Selesai' }), 'Dibatalkan')).toBeNull();
    expect(transisiStatus(mk({ status: 'Dibatalkan' }), 'Selesai')).toBeNull();
  });
});

describe('aksiTersedia', () => {
  it('semua aksi untuk Terjadwal', () => {
    expect(aksiTersedia(mk({}))).toEqual({ ubah: true, selesai: true, batal: true, hapus: true });
  });

  it('hanya hapus untuk Selesai dan Dibatalkan', () => {
    const hanyaHapus = { ubah: false, selesai: false, batal: false, hapus: true };
    expect(aksiTersedia(mk({ status: 'Selesai' }))).toEqual(hanyaHapus);
    expect(aksiTersedia(mk({ status: 'Dibatalkan' }))).toEqual(hanyaHapus);
  });
});
