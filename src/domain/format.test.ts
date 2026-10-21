import { describe, expect, it } from 'vitest';
import { formatJam, formatRupiah, formatTanggal, parseRupiah } from './format';

describe('formatRupiah', () => {
  it('sesuai contoh Requirement 12.1', () => {
    expect(formatRupiah(0)).toBe('Rp 0');
    expect(formatRupiah(500)).toBe('Rp 500');
    expect(formatRupiah(1000)).toBe('Rp 1.000');
    expect(formatRupiah(150000)).toBe('Rp 150.000');
    expect(formatRupiah(1234567)).toBe('Rp 1.234.567');
    expect(formatRupiah(999999999)).toBe('Rp 999.999.999');
  });

  it('memakai tepat satu spasi biasa (bukan U+00A0)', () => {
    const s = formatRupiah(150000);
    expect(s.charCodeAt(2)).toBe(0x20);
    expect(s).not.toContain('\u00a0');
  });

  it('nilai tidak tersedia → "-"', () => {
    expect(formatRupiah(null)).toBe('-');
    expect(formatRupiah(undefined)).toBe('-');
    expect(formatRupiah(Number.NaN)).toBe('-');
  });
});

describe('parseRupiah', () => {
  it('membalik formatRupiah', () => {
    for (const n of [0, 7, 999, 1000, 150000, 999999999]) {
      expect(parseRupiah(formatRupiah(n))).toBe(n);
    }
  });

  it('teks yang tidak dapat dibaca → NaN', () => {
    expect(parseRupiah('-')).toBeNaN();
    expect(parseRupiah('Rp abc')).toBeNaN();
  });
});

describe('formatTanggal', () => {
  it('sesuai contoh Requirement 12.2', () => {
    expect(formatTanggal('2025-01-05')).toBe('05 Januari 2025');
    expect(formatTanggal('2024-12-31')).toBe('31 Desember 2024');
    expect(formatTanggal('2024-02-29')).toBe('29 Februari 2024');
    expect(formatTanggal('2025-05-10')).toBe('10 Mei 2025');
  });

  it('kosong atau tidak valid → "-"', () => {
    expect(formatTanggal('')).toBe('-');
    expect(formatTanggal(null)).toBe('-');
    expect(formatTanggal(undefined)).toBe('-');
    expect(formatTanggal('2025-02-31')).toBe('-');
    expect(formatTanggal('2025-02-29')).toBe('-');
    expect(formatTanggal('bukan tanggal')).toBe('-');
  });
});

describe('formatJam', () => {
  it('menampilkan JJ:MM', () => {
    expect(formatJam('09:30')).toBe('09:30');
    expect(formatJam('9:05')).toBe('09:05');
    expect(formatJam('23:59')).toBe('23:59');
    expect(formatJam('00:00')).toBe('00:00');
  });

  it('kosong atau tidak valid → "-"', () => {
    expect(formatJam('')).toBe('-');
    expect(formatJam('24:00')).toBe('-');
    expect(formatJam('12:60')).toBe('-');
    expect(formatJam(null)).toBe('-');
  });
});
