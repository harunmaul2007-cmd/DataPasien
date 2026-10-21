import { describe, expect, it } from 'vitest';
import { isTanggalValid, pad2, todayISO } from './tanggal';

describe('pad2', () => {
  it('menambah nol di depan untuk 0–9', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(5)).toBe('05');
    expect(pad2(12)).toBe('12');
  });
});

describe('isTanggalValid', () => {
  it('menerima tanggal kalender nyata', () => {
    expect(isTanggalValid('2025-01-05')).toBe(true);
    expect(isTanggalValid('2024-12-31')).toBe(true);
    expect(isTanggalValid('2024-02-29')).toBe(true); // kabisat
    expect(isTanggalValid('2000-02-29')).toBe(true); // habis dibagi 400
  });

  it('menolak tanggal yang tidak ada', () => {
    expect(isTanggalValid('2025-02-29')).toBe(false);
    expect(isTanggalValid('1900-02-29')).toBe(false); // habis dibagi 100, bukan 400
    expect(isTanggalValid('2025-02-31')).toBe(false);
    expect(isTanggalValid('2025-04-31')).toBe(false);
    expect(isTanggalValid('2025-13-01')).toBe(false);
    expect(isTanggalValid('2025-00-10')).toBe(false);
    expect(isTanggalValid('2025-01-00')).toBe(false);
  });

  it('menolak format selain YYYY-MM-DD', () => {
    expect(isTanggalValid('')).toBe(false);
    expect(isTanggalValid('2025-1-5')).toBe(false);
    expect(isTanggalValid('05-01-2025')).toBe(false);
    expect(isTanggalValid(' 2025-01-05')).toBe(false);
    expect(isTanggalValid('2025-01-05T00:00')).toBe(false);
    expect(isTanggalValid(null)).toBe(false);
    expect(isTanggalValid(undefined)).toBe(false);
  });
});

describe('todayISO', () => {
  it('memakai tanggal lokal perangkat', () => {
    expect(todayISO(new Date(2025, 0, 5, 23, 59))).toBe('2025-01-05');
    expect(todayISO(new Date(2024, 11, 31, 0, 0))).toBe('2024-12-31');
  });

  it('hasilnya selalu tanggal valid', () => {
    expect(isTanggalValid(todayISO())).toBe(true);
  });
});
