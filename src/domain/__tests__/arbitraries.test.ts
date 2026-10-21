import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { isUuidV4 } from '../ids';
import { STATUS_JADWAL } from '../types';
import {
  BATAS,
  appDataArb,
  biayaArb,
  biayaInputTidakValidArb,
  biayaInputValidArb,
  cadanganRusakArb,
  codePointLength,
  dataDanCadanganRusakArb,
  formTextAround,
  isBiayaInputValidModel,
  isJamValidModel,
  isNomorHpValidModel,
  isTanggalValidModel,
  jadwalArb,
  jadwalInputArb,
  jamTidakValidArb,
  jamValidArb,
  noHpHampirValidArb,
  noHpValidArb,
  nowArb,
  pasienArb,
  pasienInputValidArb,
  sesiArb,
  sesiInputValidArb,
  tanggalJamSekitar,
  tanggalTidakValidArb,
  tanggalValidArb,
  textOfLength,
  buildBackupText,
} from './arbitraries';

const RUNS = { numRuns: 100 };
const len = codePointLength;
const isTrimmed = (s: string): boolean => s === s.trim();

describe('arbitraries: teks', () => {
  it('textOfLength menghasilkan teks ter-trim dengan panjang code point tepat', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 300 }).chain((n) => textOfLength(n).map((s) => [n, s] as const)),
        ([n, s]) => {
          expect(len(s)).toBe(n);
          expect(isTrimmed(s)).toBe(true);
        },
      ),
      RUNS,
    );
  });

  it('teks dapat memuat emoji (lebih dari satu code unit per karakter)', () => {
    const samples = fc.sample(textOfLength(50), 200);
    expect(samples.some((s) => s.length > len(s))).toBe(true);
  });

  it('formTextAround mencakup kosong, tepat di batas, dan melebihi batas setelah trim', () => {
    const lens = fc.sample(formTextAround(BATAS.nama), 2000).map((s) => len(s.trim()));
    expect(lens).toContain(0);
    expect(lens).toContain(BATAS.nama);
    expect(lens).toContain(BATAS.nama + 1);
  });
});

describe('arbitraries: nomor HP, tanggal, jam, biaya', () => {
  it('noHpValidArb selalu valid; noHpHampirValidArb selalu tidak valid setelah trim', () => {
    fc.assert(fc.property(noHpValidArb, (s) => isNomorHpValidModel(s)), RUNS);
    fc.assert(fc.property(noHpHampirValidArb, (s) => !isNomorHpValidModel(s.trim())), RUNS);
  });

  it('noHpValidArb mencakup batas 10 dan 15 digit', () => {
    const digits = fc.sample(noHpValidArb, 500).map((s) => s.replace('+', '').length);
    expect(digits).toContain(10);
    expect(digits).toContain(15);
  });

  it('tanggal valid/tidak valid sesuai model kalender', () => {
    fc.assert(fc.property(tanggalValidArb(), (s) => isTanggalValidModel(s)), RUNS);
    fc.assert(fc.property(tanggalTidakValidArb, (s) => !isTanggalValidModel(s)), RUNS);
  });

  it('model kalender: kabisat dan non-kabisat', () => {
    expect(isTanggalValidModel('2024-02-29')).toBe(true);
    expect(isTanggalValidModel('2000-02-29')).toBe(true);
    expect(isTanggalValidModel('1900-02-29')).toBe(false);
    expect(isTanggalValidModel('2023-02-29')).toBe(false);
    expect(isTanggalValidModel('2025-04-31')).toBe(false);
  });

  it('tanggalValidArb mencakup 29 Februari', () => {
    expect(fc.sample(tanggalValidArb(), 500).some((s) => s.endsWith('-02-29'))).toBe(true);
  });

  it('jam valid/tidak valid sesuai model', () => {
    fc.assert(fc.property(jamValidArb, (s) => isJamValidModel(s)), RUNS);
    fc.assert(fc.property(jamTidakValidArb, (s) => !isJamValidModel(s)), RUNS);
  });

  it('biaya valid/tidak valid sesuai model', () => {
    fc.assert(fc.property(biayaArb, (n) => Number.isInteger(n) && n >= 0 && n <= BATAS.biayaMaks), RUNS);
    fc.assert(fc.property(biayaInputValidArb, (s) => isBiayaInputValidModel(s.trim())), RUNS);
    fc.assert(fc.property(biayaInputTidakValidArb, (s) => !isBiayaInputValidModel(s.trim())), RUNS);
  });

  it('tanggalJamSekitar menghasilkan tanggal & jam valid dengan offset benar', () => {
    fc.assert(
      fc.property(
        nowArb.chain((now) => tanggalJamSekitar(now).map((t) => ({ now, ...t }))),
        ({ now, tanggal, jam, offsetMenit }) => {
          expect(isTanggalValidModel(tanggal)).toBe(true);
          expect(isJamValidModel(jam)).toBe(true);
          const [y, m, d] = tanggal.split('-').map(Number) as [number, number, number];
          const [hh, mm] = jam.split(':').map(Number) as [number, number];
          const t = new Date(y, m - 1, d, hh, mm).getTime();
          expect(t).toBe(now.getTime() + offsetMenit * 60_000);
        },
      ),
      RUNS,
    );
  });
});

describe('arbitraries: rekaman dan input valid', () => {
  it('pasienArb memenuhi batas model', () => {
    fc.assert(
      fc.property(pasienArb, (p) => {
        expect(isUuidV4(p.id)).toBe(true);
        expect(isTrimmed(p.nama) && len(p.nama) >= 1 && len(p.nama) <= BATAS.nama).toBe(true);
        expect(isTrimmed(p.alamat) && len(p.alamat) <= BATAS.alamat).toBe(true);
        expect(isNomorHpValidModel(p.noHp)).toBe(true);
        expect(p.updatedAt).toBeGreaterThanOrEqual(p.createdAt);
      }),
      RUNS,
    );
  });

  it('pasienArb mencakup panjang nama tepat 100 code point', () => {
    expect(fc.sample(pasienArb, 300).some((p) => len(p.nama) === BATAS.nama)).toBe(true);
  });

  it('sesiArb dan jadwalArb memenuhi batas model', () => {
    fc.assert(
      fc.property(sesiArb('pid-1'), jadwalArb('pid-1'), (s, j) => {
        expect(s.pasienId).toBe('pid-1');
        expect(isTanggalValidModel(s.tanggal)).toBe(true);
        expect(len(s.keluhan)).toBeGreaterThanOrEqual(1);
        expect(len(s.terapi)).toBeGreaterThanOrEqual(1);
        for (const t of [s.keluhan, s.polaPenyakit, s.terapi, s.hasil]) {
          expect(isTrimmed(t) && len(t) <= BATAS.teksSesi).toBe(true);
        }
        expect(Number.isInteger(s.biaya) && s.biaya >= 0 && s.biaya <= BATAS.biayaMaks).toBe(true);
        expect(j.pasienId).toBe('pid-1');
        expect(isTanggalValidModel(j.tanggal) && isJamValidModel(j.jam)).toBe(true);
        expect(isTrimmed(j.catatan) && len(j.catatan) <= BATAS.catatan).toBe(true);
        expect(STATUS_JADWAL).toContain(j.status);
      }),
      { numRuns: 50 },
    );
  });

  it('input formulir valid tetap valid setelah trim', () => {
    fc.assert(
      fc.property(pasienInputValidArb, sesiInputValidArb, (p, s) => {
        const nama = p.nama.trim();
        expect(len(nama) >= 1 && len(nama) <= BATAS.nama).toBe(true);
        expect(len(p.alamat.trim())).toBeLessThanOrEqual(BATAS.alamat);
        expect(isNomorHpValidModel(p.noHp.trim())).toBe(true);
        expect(isTanggalValidModel(s.tanggal)).toBe(true);
        expect(len(s.keluhan.trim())).toBeGreaterThanOrEqual(1);
        expect(len(s.terapi.trim())).toBeGreaterThanOrEqual(1);
        expect(isBiayaInputValidModel(s.biaya.trim())).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it('jadwalInputArb memakai pasienId terdaftar, tidak terdaftar, dan kosong', () => {
    const ids = ['a', 'b'];
    const pids = fc.sample(jadwalInputArb(ids, new Date(2025, 0, 5, 9, 30)), 300).map((j) => j.pasienId);
    expect(pids.some((p) => ids.includes(p))).toBe(true);
    expect(pids).toContain('');
    expect(pids.some((p) => p !== '' && !ids.includes(p))).toBe(true);
  });
});

describe('arbitraries: AppData dan File_Cadangan', () => {
  it('appDataArb: id unik global dan relasi konsisten', () => {
    fc.assert(
      fc.property(appDataArb(), (data) => {
        const all = [...data.pasien, ...data.sesi, ...data.jadwal].map((r) => r.id);
        expect(new Set(all).size).toBe(all.length);
        const pids = new Set(data.pasien.map((p) => p.id));
        for (const r of [...data.sesi, ...data.jadwal]) expect(pids.has(r.pasienId)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it('cadanganRusakArb selalu menghasilkan teks yang berbeda dari cadangan valid', () => {
    fc.assert(
      fc.property(dataDanCadanganRusakArb({ maxPasien: 3, maxSesi: 4, maxJadwal: 4 }), ({ data, text }) => {
        expect(text).not.toBe(buildBackupText(data));
      }),
      { numRuns: 100 },
    );
  });

  it('cadanganRusakArb mencakup semua jenis kerusakan, termasuk untuk data kosong', () => {
    const empty = { pasien: [], sesi: [], jadwal: [] };
    const jenis = new Set(fc.sample(cadanganRusakArb(empty), 1000).map((r) => r.jenis));
    for (const j of [
      'kosong', 'jsonTerpotong', 'bukanJson', 'strukturSalah', 'fieldHilang',
      'versiLain', 'rekamanTidakValid', 'idGanda', 'pasienIdTidakAda',
    ]) {
      expect(jenis.has(j as never)).toBe(true);
    }
  });

  it('jsonTerpotong dan bukanJson memang bukan JSON valid; idGanda memuat id ganda', () => {
    fc.assert(
      fc.property(dataDanCadanganRusakArb({ maxPasien: 3, maxSesi: 3, maxJadwal: 3 }), ({ jenis, text }) => {
        if (jenis === 'jsonTerpotong' || jenis === 'bukanJson') {
          expect(() => JSON.parse(text)).toThrow();
        }
        if (jenis === 'idGanda') {
          const d = (JSON.parse(text) as { data: Record<string, Array<{ id: string }>> }).data;
          const adaGanda = Object.values(d).some((list) => new Set(list.map((r) => r.id)).size < list.length);
          expect(adaGanda).toBe(true);
        }
        if (jenis === 'pasienIdTidakAda') {
          const d = (JSON.parse(text) as { data: { pasien: Array<{ id: string }>; sesi: Array<{ pasienId: string }>; jadwal: Array<{ pasienId: string }> } }).data;
          const pids = new Set(d.pasien.map((p) => p.id));
          expect([...d.sesi, ...d.jadwal].some((r) => !pids.has(r.pasienId))).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });
});
