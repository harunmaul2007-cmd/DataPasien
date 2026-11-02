import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { catatRiwayat, lokasiRiwayat, normalisasiEmail } from './lisensi.mjs';

const tmpDirs = [];
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('riwayat lisensi', () => {
  it('lokasi riwayat di folder yang sama dengan kunci privat', () => {
    expect(lokasiRiwayat(path.join('x', 'kunci.pem'))).toBe(path.join('x', 'lisensi-terbit.csv'));
  });

  it('membuat header sekali lalu menambah baris per kode', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'lisensi-'));
    tmpDirs.push(dir);
    const file = path.join(dir, 'sub', 'lisensi-terbit.csv');
    catatRiwayat(file, 'a@b.id', 'DP1.x.y', new Date('2026-10-28T01:02:03Z'));
    catatRiwayat(file, 'c,d@e.id', 'DP1.p.q', new Date('2026-10-29T00:00:00Z'));
    expect(readFileSync(file, 'utf8')).toBe(
      'waktu,email,kode\n2026-10-28T01:02:03.000Z,a@b.id,DP1.x.y\n2026-10-29T00:00:00.000Z,"c,d@e.id",DP1.p.q\n',
    );
  });

  it('normalisasi email', () => {
    expect(normalisasiEmail('  A@B.ID ')).toBe('a@b.id');
    expect(() => normalisasiEmail('bukan-email')).toThrow();
  });
});
