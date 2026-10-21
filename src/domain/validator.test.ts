import { describe, expect, it } from 'vitest';
import {
  PESAN,
  isNomorHpValid,
  validateJadwal,
  validatePasien,
  validateSesi,
} from './validator';

describe('isNomorHpValid', () => {
  it.each(['0812345678', '6281234567', '+6281234567', '081234567890123'])('menerima %s', (s) => {
    expect(isNomorHpValid(s)).toBe(true);
  });
  it.each(['081234567', '0812345678901234', '0712345678', '+0812345678', '0812-345678', '', '++6281234567'])(
    'menolak %s',
    (s) => {
      expect(isNomorHpValid(s)).toBe(false);
    },
  );
});

describe('validatePasien', () => {
  it('menerima input valid dan melakukan trim', () => {
    expect(validatePasien({ nama: '  Budi ', alamat: ' Jl. Mawar ', noHp: ' 081234567890 ' })).toEqual({
      ok: true,
      value: { nama: 'Budi', alamat: 'Jl. Mawar', noHp: '081234567890', umur: null, jenisKelamin: null },
    });
  });

  it('mengumpulkan seluruh kesalahan sekaligus', () => {
    expect(validatePasien({ nama: '   ', alamat: 'a'.repeat(256), noHp: '123' })).toEqual({
      ok: false,
      errors: { nama: PESAN.namaWajib, alamat: 'Alamat maksimal 255 karakter', noHp: 'Nomor HP tidak valid' },
    });
  });

  it('menghitung panjang per code point', () => {
    const ok = validatePasien({ nama: '😀'.repeat(100), alamat: '', noHp: '081234567890' });
    expect(ok.ok).toBe(true);
    const ng = validatePasien({ nama: '😀'.repeat(101), alamat: '', noHp: '081234567890' });
    expect(ng).toEqual({ ok: false, errors: { nama: 'Nama maksimal 100 karakter' } });
  });
});

const sesiValid = {
  tanggal: '2024-02-29',
  keluhan: ' Pusing ',
  polaPenyakit: '',
  terapi: ' Bekam ',
  hasil: '',
  biaya: ' 150000 ',
};

describe('validateSesi', () => {
  it('menerima input valid, opsional kosong, dan mengonversi biaya', () => {
    expect(validateSesi(sesiValid)).toEqual({
      ok: true,
      value: { tanggal: '2024-02-29', keluhan: 'Pusing', polaPenyakit: '', terapi: 'Bekam', hasil: '', biaya: 150000 },
    });
  });

  it('menerima biaya 0 dan 999999999', () => {
    expect(validateSesi({ ...sesiValid, biaya: '0' }).ok).toBe(true);
    expect(validateSesi({ ...sesiValid, biaya: '999999999' }).ok).toBe(true);
  });

  it.each(['', '-1', '1.5', '1000000000', 'abc', '1e3'])('menolak biaya %j', (biaya) => {
    expect(validateSesi({ ...sesiValid, biaya })).toEqual({
      ok: false,
      errors: { biaya: 'Biaya harus berupa angka 0 atau lebih' },
    });
  });

  it('mengumpulkan seluruh kesalahan sekaligus', () => {
    const panjang = 'x'.repeat(1001);
    expect(
      validateSesi({ tanggal: '2023-02-29', keluhan: ' ', polaPenyakit: panjang, terapi: '', hasil: panjang, biaya: '' }),
    ).toEqual({
      ok: false,
      errors: {
        tanggal: 'Tanggal terapi wajib diisi',
        keluhan: 'Keluhan wajib diisi',
        polaPenyakit: 'Diagnosa melebihi batas 1000 karakter',
        terapi: 'Terapi yang diberikan wajib diisi',
        hasil: 'Hasil terapi melebihi batas 1000 karakter',
        biaya: 'Biaya harus berupa angka 0 atau lebih',
      },
    });
  });

  it('melaporkan keluhan dan terapi yang melebihi batas', () => {
    const panjang = 'x'.repeat(1001);
    expect(validateSesi({ ...sesiValid, keluhan: panjang, terapi: panjang })).toEqual({
      ok: false,
      errors: {
        keluhan: 'Keluhan melebihi batas 1000 karakter',
        terapi: 'Terapi yang diberikan melebihi batas 1000 karakter',
      },
    });
  });
});

describe('validateJadwal', () => {
  const now = new Date(2025, 0, 5, 9, 30, 45); // 05 Jan 2025 09:30:45 lokal
  const ids = new Set(['p1']);
  const valid = { pasienId: 'p1', tanggal: '2025-01-05', jam: '09:30', catatan: ' Bawa hasil lab ' };

  it('menerima jadwal pada menit yang sama dengan now dan melakukan trim catatan', () => {
    expect(validateJadwal(valid, now, ids)).toEqual({
      ok: true,
      value: { pasienId: 'p1', tanggal: '2025-01-05', jam: '09:30', catatan: 'Bawa hasil lab' },
    });
  });

  it('menolak jadwal satu menit sebelum now', () => {
    expect(validateJadwal({ ...valid, jam: '09:29' }, now, ids)).toEqual({
      ok: false,
      errors: { tanggal: 'Jadwal tidak boleh di waktu yang sudah lewat' },
    });
  });

  it('dapat melewati aturan jadwal lewat (impor cadangan)', () => {
    const r = validateJadwal({ ...valid, tanggal: '2020-01-01' }, now, ids, { abaikanWaktuLewat: true });
    expect(r.ok).toBe(true);
  });

  it('mengumpulkan seluruh kesalahan sekaligus', () => {
    expect(validateJadwal({ pasienId: '', tanggal: '', jam: '', catatan: 'c'.repeat(501) }, now, ids)).toEqual({
      ok: false,
      errors: {
        pasienId: 'Pasien wajib diisi',
        tanggal: 'Tanggal wajib diisi',
        jam: 'Jam wajib diisi',
        catatan: 'Catatan maksimal 500 karakter',
      },
    });
  });

  it('menolak pasien yang tidak terdaftar dan jam tidak valid', () => {
    expect(validateJadwal({ ...valid, pasienId: 'p2', jam: '24:00' }, now, ids)).toEqual({
      ok: false,
      errors: { pasienId: 'Pasien wajib diisi', jam: 'Jam wajib diisi' },
    });
  });
});
