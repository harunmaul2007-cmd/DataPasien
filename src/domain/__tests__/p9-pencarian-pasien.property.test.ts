// Feature: patient-therapy-management, Property 9: Pencarian dan pengurutan daftar pasien
// **Validates: Requirements 4.2, 4.3, 4.4**

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { searchPasien, sortPasien } from '../pasienQuery';
import type { Pasien } from '../types';
import { nonSpaceCharArb, paddingArb, pasienArb, whitespaceOnlyArb } from './arbitraries';

const collator = new Intl.Collator('id', { sensitivity: 'base' });

/** Membalik huruf besar/kecil untuk huruf ASCII saja (aman terhadap pemetaan kasus non-ASCII). */
function toggleAsciiCase(s: string, mask: readonly boolean[]): string {
  return [...s]
    .map((ch, i) => {
      if (!mask[i % Math.max(1, mask.length)] || !/[A-Za-z]/.test(ch)) return ch;
      return ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
    })
    .join('');
}

/**
 * Daftar pasien dengan id unik; sebagian nama disalin dari pasien lain dengan
 * variasi huruf besar/kecil agar tie-break dan perbandingan case-insensitive teruji.
 */
const daftarPasienArb: fc.Arbitrary<Pasien[]> = fc
  .uniqueArray(pasienArb, { maxLength: 10, selector: (p) => p.id })
  .chain((list) =>
    fc
      .array(fc.tuple(fc.boolean(), fc.nat(), fc.array(fc.boolean(), { minLength: 1, maxLength: 8 })), {
        minLength: list.length,
        maxLength: list.length,
      })
      .map((ops) =>
        list.map((p, i) => {
          const [salin, src, mask] = ops[i] as [boolean, number, boolean[]];
          if (!salin || list.length < 2) return p;
          const sumber = list[src % list.length] as Pasien;
          return { ...p, nama: toggleAsciiCase(sumber.nama, mask) };
        }),
      ),
  );

/** Substring (per code point) dari teks. */
function substringArb(s: string): fc.Arbitrary<string> {
  const cps = [...s];
  return fc
    .tuple(fc.nat({ max: cps.length }), fc.nat({ max: cps.length }))
    .map(([a, b]) => cps.slice(Math.min(a, b), Math.max(a, b)).join(''));
}

/** Kata kunci (≤ 100 karakter setelah trim): diturunkan dari nama/noHp yang ada, acak, atau kosong. */
function kataKunciArb(list: readonly Pasien[]): fc.Arbitrary<{ keyword: string; turunan: boolean }> {
  const acak = fc
    .tuple(paddingArb, fc.array(nonSpaceCharArb, { minLength: 1, maxLength: 5 }), paddingArb)
    .map(([l, cs, r]) => ({ keyword: l + cs.join('') + r, turunan: false }));
  const kosong = fc.oneof(fc.constant(''), whitespaceOnlyArb).map((k) => ({ keyword: k, turunan: false }));
  if (list.length === 0) return fc.oneof(acak, kosong);
  const turunan = fc
    .constantFrom(...list)
    .chain((p) => fc.constantFrom(p.nama, p.noHp))
    .chain((s) => substringArb(s))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && [...s].length <= 100)
    .chain((s) =>
      fc
        .tuple(paddingArb, fc.array(fc.boolean(), { minLength: 1, maxLength: 8 }), paddingArb)
        .map(([l, mask, r]) => ({ keyword: l + toggleAsciiCase(s, mask) + r, turunan: true })),
    );
  return fc.oneof({ arbitrary: turunan, weight: 4 }, { arbitrary: acak, weight: 2 }, { arbitrary: kosong, weight: 1 });
}

function cocok(p: Pasien, q: string): boolean {
  return p.nama.toLowerCase().includes(q) || p.noHp.toLowerCase().includes(q);
}

function expectTerurut(hasil: readonly Pasien[]): void {
  for (let i = 1; i < hasil.length; i++) {
    const a = hasil[i - 1] as Pasien;
    const b = hasil[i] as Pasien;
    const c = collator.compare(a.nama, b.nama);
    expect(c).toBeLessThanOrEqual(0);
    if (c === 0) expect(a.id < b.id).toBe(true);
  }
}

const ids = (l: readonly Pasien[]): string[] => l.map((p) => p.id).sort();

describe('Property 9: Pencarian dan pengurutan daftar pasien', () => {
  it('searchPasien mengembalikan tepat pasien yang cocok, terurut nama (case-insensitive)', () => {
    fc.assert(
      fc.property(
        daftarPasienArb.chain((list) => fc.tuple(fc.constant(list), kataKunciArb(list))),
        ([list, { keyword, turunan }]) => {
          const snapshot = JSON.stringify(list);
          const hasil = searchPasien(list, keyword);
          const q = keyword.trim().toLowerCase();
          const diharapkan = q === '' ? list : list.filter((p) => cocok(p, q));

          // Tepat himpunan pasien yang cocok (tanpa duplikat, tanpa yang hilang).
          expect(ids(hasil)).toEqual(ids(diharapkan));
          // Kata kunci turunan dari data selalu menemukan minimal satu pasien.
          if (turunan) expect(hasil.length).toBeGreaterThan(0);
          // Terurut menaik berdasarkan nama tanpa membedakan huruf besar/kecil.
          expectTerurut(hasil);
          // Input tidak dimutasi.
          expect(JSON.stringify(list)).toBe(snapshot);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('sortPasien adalah permutasi terurut dan sama dengan pencarian kata kunci kosong', () => {
    fc.assert(
      fc.property(daftarPasienArb, whitespaceOnlyArb, (list, ws) => {
        const urut = sortPasien(list);
        expect(ids(urut)).toEqual(ids(list));
        expectTerurut(urut);
        expect(searchPasien(list, ws)).toEqual(urut);
        expect(searchPasien(list, '')).toEqual(urut);
      }),
      { numRuns: 200 },
    );
  });
});
