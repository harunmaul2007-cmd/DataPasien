import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { appDataArb, buildBackupText, cadanganRusakArb } from './__tests__/arbitraries';
import {
  ALASAN,
  backupFileName,
  FORMAT_VERSION,
  parseBackup,
  serializeBackup,
  toLocalISOString,
} from './cadangan';
import type { AppData } from './types';

const PASIEN_ID = '11111111-1111-4111-8111-111111111111';

function contohData(): AppData {
  return {
    pasien: [
      {
        id: PASIEN_ID,
        nama: 'Siti Aminah 🌸',
        alamat: 'Jl. Merdeka No. 1, Bandung',
        noHp: '081234567890',
        umur: null,
        jenisKelamin: null,
        createdAt: 1_736_000_000_000,
        updatedAt: 1_736_000_000_500,
      },
    ],
    sesi: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        pasienId: PASIEN_ID,
        tanggal: '2024-02-29',
        keluhan: 'Nyeri punggung',
        polaPenyakit: '',
        terapi: 'Bekam',
        hasil: 'Membaik',
        biaya: 150000,
        createdAt: 1_736_000_001_000,
        updatedAt: 1_736_000_001_000,
      },
    ],
    jadwal: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        pasienId: PASIEN_ID,
        tanggal: '2020-01-05',
        jam: '09:30',
        catatan: 'Kontrol',
        status: 'Selesai',
        createdAt: 1_736_000_002_000,
        updatedAt: 1_736_000_002_000,
      },
    ],
  };
}

function ubah(data: AppData, fn: (root: Record<string, any>) => void): string {
  const root = JSON.parse(buildBackupText(data));
  fn(root);
  return JSON.stringify(root);
}

describe('backupFileName', () => {
  it('memakai waktu lokal dengan nol di depan', () => {
    expect(backupFileName(new Date(2025, 0, 5, 9, 30))).toBe('datapasien-cadangan-20250105-0930.json');
    expect(backupFileName(new Date(2024, 11, 31, 23, 59))).toBe('datapasien-cadangan-20241231-2359.json');
    expect(backupFileName(new Date(2024, 0, 1, 0, 0))).toBe('datapasien-cadangan-20240101-0000.json');
  });
});

describe('toLocalISOString', () => {
  it('menghasilkan ISO 8601 dengan offset lokal yang menunjuk instan yang sama', () => {
    const d = new Date(2025, 0, 5, 9, 30, 15);
    const s = toLocalISOString(d);
    expect(s).toMatch(/^2025-01-05T09:30:15[+-]\d{2}:\d{2}$/);
    expect(new Date(s).getTime()).toBe(d.getTime());
  });
});

describe('serializeBackup', () => {
  it('berisi app, versi, waktu ekspor, data, dan berindentasi 2', () => {
    const t = new Date(2025, 0, 5, 9, 30);
    const text = serializeBackup(contohData(), t);
    const root = JSON.parse(text);
    expect(root.app).toBe('datapasien');
    expect(root.formatVersion).toBe(FORMAT_VERSION);
    expect(root.exportedAt).toBe(toLocalISOString(t));
    expect(root.data).toEqual(contohData());
    expect(text).toBe(JSON.stringify(root, null, 2));
  });

  it('data kosong tetap menghasilkan file valid dengan jumlah 0 (Req 14.10)', () => {
    const r = parseBackup(serializeBackup({ pasien: [], sesi: [], jadwal: [] }, new Date()));
    expect(r).toEqual({ ok: true, data: { pasien: [], sesi: [], jadwal: [] }, counts: { pasien: 0, sesi: 0, jadwal: 0 } });
  });
});

describe('parseBackup', () => {
  it('round-trip contoh data, termasuk jadwal lampau dan teks non-ASCII', () => {
    const r = parseBackup(serializeBackup(contohData(), new Date()));
    expect(r).toEqual({ ok: true, data: contohData(), counts: { pasien: 1, sesi: 1, jadwal: 1 } });
  });

  it('membuang field yang tidak dikenal', () => {
    const text = ubah(contohData(), (root) => {
      root.data.pasien[0].ekstra = 'x';
      root.data.sesi[0].lain = 1;
    });
    const r = parseBackup(text);
    expect(r.ok && r.data).toEqual(contohData());
  });

  it.each([
    ['file kosong', '  \n', ALASAN.kosong],
    ['JSON tidak valid', '{"app":', ALASAN.bukanJson],
    ['bukan objek', '[]', ALASAN.strukturSalah],
    ['app lain', JSON.stringify({ app: 'lain', formatVersion: 1, exportedAt: 'x', data: { pasien: [], sesi: [], jadwal: [] } }), ALASAN.strukturSalah],
  ])('menolak %s', (_n, text, reason) => {
    expect(parseBackup(text)).toEqual({ ok: false, reason });
  });

  it('menolak struktur tanpa formatVersion atau tabel', () => {
    expect(parseBackup(ubah(contohData(), (r) => delete r.formatVersion))).toEqual({ ok: false, reason: ALASAN.strukturSalah });
    expect(parseBackup(ubah(contohData(), (r) => (r.data.sesi = {})))).toEqual({ ok: false, reason: ALASAN.strukturSalah });
  });

  it('menolak versi format lain', () => {
    expect(parseBackup(ubah(contohData(), (r) => (r.formatVersion = 2)))).toEqual({ ok: false, reason: ALASAN.versiTidakDidukung });
  });

  it('menolak rekaman yang melanggar Validator dengan nomor urut dan pesan', () => {
    const r = parseBackup(ubah(contohData(), (root) => (root.data.pasien[0].noHp = '0812')));
    expect(r).toEqual({ ok: false, reason: 'Data pasien ke-1 tidak valid: Nomor HP tidak valid' });
  });

  it('menolak biaya pecahan, negatif, dan melebihi batas', () => {
    for (const biaya of [1.5, -1, 1_000_000_000, '150000']) {
      const r = parseBackup(ubah(contohData(), (root) => (root.data.sesi[0].biaya = biaya)));
      expect(r.ok).toBe(false);
      expect(!r.ok && r.reason).toMatch(/^Data sesi terapi ke-1 tidak valid: /);
    }
  });

  it('menolak teks yang belum ter-trim dan status tidak dikenal', () => {
    expect(parseBackup(ubah(contohData(), (r) => (r.data.pasien[0].nama = ' Siti '))).ok).toBe(false);
    const r = parseBackup(ubah(contohData(), (root) => (root.data.jadwal[0].status = 'Ditunda')));
    expect(!r.ok && r.reason).toMatch(/^Data jadwal kunjungan ke-1 tidak valid: /);
  });

  it('menolak identitas ganda', () => {
    const r = parseBackup(ubah(contohData(), (root) => root.data.sesi.push({ ...root.data.sesi[0] })));
    expect(r).toEqual({ ok: false, reason: `${ALASAN.idGanda} pada data sesi terapi` });
  });

  it('menolak sesi/jadwal yang merujuk pasien tidak ada', () => {
    const lain = '44444444-4444-4444-8444-444444444444';
    expect(parseBackup(ubah(contohData(), (r) => (r.data.sesi[0].pasienId = lain)))).toEqual({ ok: false, reason: ALASAN.sesiTanpaPasien });
    expect(parseBackup(ubah(contohData(), (r) => (r.data.jadwal[0].pasienId = lain)))).toEqual({ ok: false, reason: ALASAN.jadwalTanpaPasien });
  });

  it('sanity: menerima data valid acak dan menolak seluruh jenis kerusakan', () => {
    fc.assert(
      fc.property(
        appDataArb({ maxPasien: 3, maxSesi: 4, maxJadwal: 4 }).chain((data) =>
          cadanganRusakArb(data).map((rusak) => ({ data, rusak })),
        ),
        ({ data, rusak }) => {
          const ok = parseBackup(serializeBackup(data, new Date()));
          expect(ok.ok && ok.data).toEqual(data);
          const r = parseBackup(rusak.text);
          expect(r.ok).toBe(false);
          expect(!r.ok && r.reason.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
