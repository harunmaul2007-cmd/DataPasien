import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import Dexie from 'dexie';
import version from '../version.json';

// Smoke test perangkat uji: jsdom, fake-indexeddb + Dexie, fast-check, version.json.
describe('toolchain', () => {
  it('berjalan di lingkungan jsdom', () => {
    const el = document.createElement('div');
    el.textContent = 'Data Pasien';
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
  });

  it('IndexedDB (fake-indexeddb) dapat dipakai Dexie', async () => {
    const db = new Dexie('toolchain-smoke');
    db.version(1).stores({ item: 'id' });
    await db.table('item').put({ id: 'a', nama: 'Siti 😊' });
    expect(await db.table('item').get('a')).toEqual({ id: 'a', nama: 'Siti 😊' });
    db.close();
    await Dexie.delete('toolchain-smoke');
  });

  it('fast-check tersedia', () => {
    fc.assert(fc.property(fc.integer(), (n) => n + 0 === n), { numRuns: 100 });
  });

  it('version.json berisi versi awal', () => {
    expect(version).toEqual({ versionName: '1.0.0', versionCode: 1 });
  });
});
