// Generator (arbitrary) fast-check bersama untuk property-based test.
//
// Modul ini sengaja mandiri: tidak mengimpor validator/tanggal/format agar
// generator tidak "mewarisi" bug dari kode yang diuji. Model referensi kecil
// (mis. `isNomorHpValidModel`, `isTanggalValidModel`) disediakan di sini untuk
// dipakai sebagai oracle oleh test properti.
//
// Panjang teks selalu dihitung per code point (`[...s].length`).

import fc from 'fast-check';
import type {
  AppData,
  JadwalInput,
  JadwalKunjungan,
  Pasien,
  PasienInput,
  SesiInput,
  SesiTerapi,
  StatusJadwal,
} from '../types';
import { STATUS_JADWAL } from '../types';

// ---------------------------------------------------------------------------
// Batas aturan (sesuai tabel Validator di design)
// ---------------------------------------------------------------------------

export const BATAS = {
  nama: 100,
  alamat: 255,
  teksSesi: 1000,
  catatan: 500,
  biayaMaks: 999_999_999,
  hpDigitMin: 10,
  hpDigitMaks: 15,
} as const;

/** Rentang epoch ms untuk createdAt/updatedAt (2000-01-01 s.d. 2100-01-01 UTC). */
const EPOCH_MIN = Date.UTC(2000, 0, 1);
const EPOCH_MAX = Date.UTC(2100, 0, 1);

// ---------------------------------------------------------------------------
// Utilitas lokal
// ---------------------------------------------------------------------------

/** Panjang string dalam code point. */
export function codePointLength(s: string): number {
  return [...s].length;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  if (m === 2) return isLeapYear(y) ? 29 : 28;
  return [4, 6, 9, 11].includes(m) ? 30 : 31;
}

/** Model referensi: "YYYY-MM-DD" dan tanggal kalender nyata (tahun 0001–9999). */
export function isTanggalValidModel(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1 || mo < 1 || mo > 12) return false;
  return d >= 1 && d <= daysInMonth(y, mo);
}

/** Model referensi jam "HH:mm" 24 jam. */
export function isJamValidModel(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Model referensi Nomor_HP_Valid (input diasumsikan sudah di-trim). */
export function isNomorHpValidModel(s: string): boolean {
  if (!/^\+?\d+$/.test(s)) return false;
  if (!/^(08|628|\+628)/.test(s)) return false;
  const digits = s.replace('+', '').length;
  return digits >= BATAS.hpDigitMin && digits <= BATAS.hpDigitMaks;
}

/** Model referensi biaya (input diasumsikan sudah di-trim). */
export function isBiayaInputValidModel(s: string): boolean {
  return /^\d+$/.test(s) && Number(s) <= BATAS.biayaMaks;
}

/** Tanggal lokal "YYYY-MM-DD" dari objek Date. */
export function toISODateLocal(d: Date): string {
  return `${pad4(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Jam lokal "HH:mm" dari objek Date. */
export function toHHmmLocal(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ---------------------------------------------------------------------------
// Teks
// ---------------------------------------------------------------------------

const ASCII_CHARS = [
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  ...".,-'/()&",
];

/** Satu code point non-whitespace (ASCII, Latin beraksen, CJK, emoji astral). */
export const nonSpaceCharArb: fc.Arbitrary<string> = fc.oneof(
  { arbitrary: fc.constantFrom(...ASCII_CHARS), weight: 6 },
  // Latin-1 Supplement + Latin Extended-A (é, ñ, ü, ...); tanpa whitespace.
  { arbitrary: fc.integer({ min: 0xc0, max: 0x17f }).map((c) => String.fromCodePoint(c)), weight: 2 },
  // CJK Unified Ideographs.
  { arbitrary: fc.integer({ min: 0x4e00, max: 0x9fff }).map((c) => String.fromCodePoint(c)), weight: 1 },
  // Emoji (di luar BMP: 2 code unit UTF-16, 1 code point).
  { arbitrary: fc.integer({ min: 0x1f300, max: 0x1faff }).map((c) => String.fromCodePoint(c)), weight: 2 },
);

/** Satu code point teks: non-whitespace atau spasi biasa (spasi di tengah teks). */
const textCharArb: fc.Arbitrary<string> = fc.oneof(
  { arbitrary: nonSpaceCharArb, weight: 8 },
  { arbitrary: fc.constant(' '), weight: 1 },
);

/** Karakter whitespace yang dihapus oleh `String.prototype.trim`. */
export const WHITESPACE_CHARS = [' ', '\t', '\n', '\r', '\u00a0', '\u3000'] as const;

/** Rangkaian whitespace (0–4 karakter). */
export const paddingArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...WHITESPACE_CHARS), { maxLength: 4 })
  .map((a) => a.join(''));

/** String berisi whitespace saja (1–5 karakter). */
export const whitespaceOnlyArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(...WHITESPACE_CHARS), { minLength: 1, maxLength: 5 })
  .map((a) => a.join(''));

/**
 * Teks yang sudah ter-trim dengan panjang tepat `len` code point.
 * Spasi hanya muncul di tengah; karakter tepi selalu non-whitespace.
 */
export function textOfLength(len: number): fc.Arbitrary<string> {
  if (len <= 0) return fc.constant('');
  if (len === 1) return nonSpaceCharArb;
  return fc
    .tuple(
      nonSpaceCharArb,
      fc.array(textCharArb, { minLength: len - 2, maxLength: len - 2 }),
      nonSpaceCharArb,
    )
    .map(([a, mid, b]) => a + mid.join('') + b);
}

/** Panjang dalam [min, max] dengan bias ke nilai batas. */
export function lengthNearBounds(min: number, max: number): fc.Arbitrary<number> {
  const small = Math.min(max, min + 10);
  return fc.oneof(
    fc.constant(min),
    fc.constant(max),
    fc.integer({ min, max: small }),
    fc.integer({ min, max }),
  );
}

/** Teks ter-trim valid dengan panjang code point dalam [min, max], bias ke batas. */
export function trimmedText(min: number, max: number): fc.Arbitrary<string> {
  return lengthNearBounds(min, max).chain((len) => textOfLength(len));
}

/**
 * Input teks formulir mentah di sekitar batas `limit`: whitespace saja, kosong,
 * atau teks dengan panjang inti (setelah trim) 0, 1, limit-1, limit, limit+1,
 * atau acak, diberi padding whitespace opsional di kedua sisi.
 */
export function formTextAround(limit: number): fc.Arbitrary<string> {
  const coreLen = fc.oneof(
    fc.constantFrom(0, 1, Math.max(0, limit - 1), limit, limit + 1),
    fc.integer({ min: 0, max: limit + 5 }),
  );
  return fc.oneof(
    { arbitrary: whitespaceOnlyArb, weight: 1 },
    {
      arbitrary: fc
        .tuple(paddingArb, coreLen.chain((n) => textOfLength(n)), paddingArb)
        .map(([l, core, r]) => l + core + r),
      weight: 6,
    },
  );
}

/** Membungkus nilai valid dengan padding whitespace opsional (tetap valid setelah trim). */
export function withPadding(arb: fc.Arbitrary<string>): fc.Arbitrary<string> {
  return fc.tuple(paddingArb, arb, paddingArb).map(([l, v, r]) => l + v + r);
}

// ---------------------------------------------------------------------------
// Nomor HP
// ---------------------------------------------------------------------------

const PREFIX_VALID = ['08', '628', '+628'] as const;

function digitsArb(len: number): fc.Arbitrary<string> {
  if (len <= 0) return fc.constant('');
  return fc
    .array(fc.constantFrom(...'0123456789'), { minLength: len, maxLength: len })
    .map((a) => a.join(''));
}

/** Prefiks + digit acak dengan total digit (tanpa "+") tepat `totalDigits`. */
function hpWith(prefix: string, totalDigits: number): fc.Arbitrary<string> {
  const prefixDigits = prefix.replace('+', '').length;
  return digitsArb(totalDigits - prefixDigits).map((d) => prefix + d);
}

/** Nomor_HP_Valid: awalan 08 | 628 | +628, total digit 10–15 (bias ke batas). */
export const noHpValidArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(...PREFIX_VALID),
    fc.oneof(
      fc.constantFrom(BATAS.hpDigitMin, BATAS.hpDigitMaks),
      fc.integer({ min: BATAS.hpDigitMin, max: BATAS.hpDigitMaks }),
    ),
  )
  .chain(([p, n]) => hpWith(p, n));

/**
 * Nomor HP "hampir valid": selalu tidak valid, bahkan setelah di-trim.
 * Mencakup jumlah digit 9/16, awalan salah, karakter asing di tengah, dan kosong.
 */
export const noHpHampirValidArb: fc.Arbitrary<string> = fc.oneof(
  // Jumlah digit tepat di luar batas.
  fc
    .tuple(
      fc.constantFrom(...PREFIX_VALID),
      fc.constantFrom(BATAS.hpDigitMin - 1, BATAS.hpDigitMaks + 1),
    )
    .chain(([p, n]) => hpWith(p, n)),
  // Awalan salah dengan jumlah digit yang benar.
  fc
    .tuple(
      fc.constantFrom('07', '09', '00', '620', '627', '629', '+620', '+629', '8', '+08', '+8', '1'),
      fc.integer({ min: BATAS.hpDigitMin, max: BATAS.hpDigitMaks }),
    )
    .chain(([p, n]) => hpWith(p, n)),
  // Karakter asing disisipkan di tengah nomor valid.
  fc
    .tuple(noHpValidArb, fc.constantFrom(' ', '-', '.', 'a', '+', '(', '٣', '😊'), fc.nat())
    .map(([hp, ch, k]) => {
      const pos = 1 + (k % (hp.length - 1));
      return hp.slice(0, pos) + ch + hp.slice(pos);
    }),
  // Kosong / whitespace saja.
  fc.constant(''),
  whitespaceOnlyArb,
);

/** Input noHp formulir: valid (mungkin ber-padding) atau hampir valid. */
export const noHpInputArb: fc.Arbitrary<string> = fc.oneof(
  withPadding(noHpValidArb),
  noHpHampirValidArb,
);

// ---------------------------------------------------------------------------
// Tanggal & jam
// ---------------------------------------------------------------------------

export interface DateRange {
  minYear?: number;
  maxYear?: number;
}

/** Tanggal kalender valid "YYYY-MM-DD" (default 1900–2100), bias ke 29 Feb & akhir bulan. */
export function tanggalValidArb({ minYear = 1900, maxYear = 2100 }: DateRange = {}): fc.Arbitrary<string> {
  const yearArb = fc.integer({ min: minYear, max: maxYear });
  const umum = fc
    .tuple(yearArb, fc.integer({ min: 1, max: 12 }))
    .chain(([y, m]) =>
      fc
        .oneof(fc.constant(1), fc.constant(daysInMonth(y, m)), fc.integer({ min: 1, max: daysInMonth(y, m) }))
        .map((d) => `${pad4(y)}-${pad2(m)}-${pad2(d)}`),
    );
  const kabisat: number[] = [];
  for (let y = minYear; y <= maxYear; y++) if (isLeapYear(y)) kabisat.push(y);
  if (kabisat.length === 0) return umum;
  const feb29 = fc.constantFrom(...kabisat).map((y) => `${pad4(y)}-02-29`);
  return fc.oneof({ arbitrary: umum, weight: 5 }, { arbitrary: feb29, weight: 1 });
}

/** Tanggal tidak valid: berbentuk benar tapi bukan tanggal nyata, atau bentuk salah. */
export const tanggalTidakValidArb: fc.Arbitrary<string> = fc.oneof(
  // 29 Februari tahun non-kabisat.
  fc
    .integer({ min: 1900, max: 2100 })
    .filter((y) => !isLeapYear(y))
    .map((y) => `${pad4(y)}-02-29`),
  // 30/31 Februari, 31 pada bulan 30 hari.
  fc
    .tuple(fc.integer({ min: 1900, max: 2100 }), fc.constantFrom('02-30', '02-31', '04-31', '06-31', '09-31', '11-31'))
    .map(([y, md]) => `${pad4(y)}-${md}`),
  // Bulan 00 atau 13–99.
  fc
    .tuple(fc.integer({ min: 1900, max: 2100 }), fc.oneof(fc.constant(0), fc.integer({ min: 13, max: 99 })), fc.integer({ min: 1, max: 28 }))
    .map(([y, m, d]) => `${pad4(y)}-${pad2(m)}-${pad2(d)}`),
  // Hari 00 atau 32–99.
  fc
    .tuple(fc.integer({ min: 1900, max: 2100 }), fc.integer({ min: 1, max: 12 }), fc.oneof(fc.constant(0), fc.integer({ min: 32, max: 99 })))
    .map(([y, m, d]) => `${pad4(y)}-${pad2(m)}-${pad2(d)}`),
  // Bentuk salah.
  fc.constantFrom(
    '',
    ' ',
    '2025-1-05',
    '2025-01-5',
    '05-01-2025',
    '2025/01/05',
    '20250105',
    '2025-01-05T00:00',
    ' 2025-01-05',
    '2025-01-05 ',
    '12025-01-05',
    'abcd-ef-gh',
    '２０２５-01-05',
  ),
);

/** Tanggal input formulir: valid atau tidak valid. */
export const tanggalInputArb: fc.Arbitrary<string> = fc.oneof(tanggalValidArb(), tanggalTidakValidArb);

/** Triple (tahun, bulan, hari) acak di sekitar batas, untuk Property 18. */
export const dateTripleArb: fc.Arbitrary<{ y: number; m: number; d: number }> = fc.record({
  y: fc.oneof(fc.integer({ min: 1900, max: 2100 }), fc.constantFrom(1900, 2000, 2024, 2100)),
  m: fc.integer({ min: 0, max: 13 }),
  d: fc.integer({ min: 0, max: 32 }),
});

/** Format triple ke "YYYY-MM-DD" (tanpa validasi). */
export function tripleToISO({ y, m, d }: { y: number; m: number; d: number }): string {
  return `${pad4(y)}-${pad2(m)}-${pad2(d)}`;
}

/** Jam valid "HH:mm", bias ke 00:00 dan 23:59. */
export const jamValidArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('00:00', '23:59', '12:00'),
  fc
    .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }))
    .map(([h, m]) => `${pad2(h)}:${pad2(m)}`),
);

/** Jam tidak valid. */
export const jamTidakValidArb: fc.Arbitrary<string> = fc.oneof(
  fc
    .tuple(fc.integer({ min: 24, max: 99 }), fc.integer({ min: 0, max: 59 }))
    .map(([h, m]) => `${pad2(h)}:${pad2(m)}`),
  fc
    .tuple(fc.integer({ min: 0, max: 23 }), fc.integer({ min: 60, max: 99 }))
    .map(([h, m]) => `${pad2(h)}:${pad2(m)}`),
  fc.constantFrom('', '9:30', '09:3', '0930', '09.30', '09:30:00', 'ab:cd', '24:00', '-1:00'),
);

/** Objek Date valid dengan presisi menit (detik & ms = 0) di rentang 2000–2099. */
export const nowArb: fc.Arbitrary<Date> = fc
  .date({ min: new Date(2000, 0, 2), max: new Date(2099, 11, 30), noInvalidDate: true })
  .map((d) => {
    const c = new Date(d.getTime());
    c.setSeconds(0, 0);
    return c;
  });

/**
 * Pasangan tanggal+jam lokal di sekitar `now` (selisih −3..+3 hari, bias ke ±1 menit),
 * untuk menguji aturan "jadwal tidak boleh di waktu yang sudah lewat".
 */
export function tanggalJamSekitar(now: Date): fc.Arbitrary<{ tanggal: string; jam: string; offsetMenit: number }> {
  const offsetArb = fc.oneof(
    fc.constantFrom(-1, 0, 1),
    fc.integer({ min: -3 * 24 * 60, max: 3 * 24 * 60 }),
  );
  return offsetArb.map((offsetMenit) => {
    const base = new Date(now.getTime());
    base.setSeconds(0, 0);
    const t = new Date(base.getTime() + offsetMenit * 60_000);
    return { tanggal: toISODateLocal(t), jam: toHHmmLocal(t), offsetMenit };
  });
}

// ---------------------------------------------------------------------------
// Biaya
// ---------------------------------------------------------------------------

/** Biaya valid 0–999.999.999 dengan bias ke batas. */
export const biayaArb: fc.Arbitrary<number> = fc.oneof(
  fc.constantFrom(0, 1, 999, 1000, BATAS.biayaMaks),
  fc.integer({ min: 0, max: BATAS.biayaMaks }),
);

/** Input teks biaya valid (boleh ber-padding / nol di depan). */
export const biayaInputValidArb: fc.Arbitrary<string> = fc.oneof(
  withPadding(biayaArb.map(String)),
  fc.integer({ min: 0, max: 99_999 }).map((n) => `00${n}`),
);

/** Input teks biaya tidak valid (tetap tidak valid setelah trim). */
export const biayaInputTidakValidArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', '   ', '-1', '-0', '+5', '1.5', '1.000', '1,5', '1e3', 'abc', 'Rp 1000', '1 000', '١٢٣'),
  fc.integer({ min: BATAS.biayaMaks + 1, max: Number.MAX_SAFE_INTEGER }).map(String),
  fc.integer({ min: -BATAS.biayaMaks, max: -1 }).map(String),
);

/** Input biaya formulir: valid atau tidak valid. */
export const biayaInputArb: fc.Arbitrary<string> = fc.oneof(biayaInputValidArb, biayaInputTidakValidArb);

// ---------------------------------------------------------------------------
// Rekaman valid
// ---------------------------------------------------------------------------

export const idArb: fc.Arbitrary<string> = fc.uuid({ version: 4 });

/** Pasangan [createdAt, updatedAt] dengan updatedAt ≥ createdAt. */
export const timestampsArb: fc.Arbitrary<{ createdAt: number; updatedAt: number }> = fc
  .tuple(fc.integer({ min: EPOCH_MIN, max: EPOCH_MAX }), fc.integer({ min: 0, max: 365 * 24 * 3600 * 1000 }))
  .map(([createdAt, delta]) => ({ createdAt, updatedAt: createdAt + delta }));

export type PasienTanpaId = Omit<Pasien, 'id'>;
export type SesiTanpaRelasi = Omit<SesiTerapi, 'id' | 'pasienId'>;
export type JadwalTanpaRelasi = Omit<JadwalKunjungan, 'id' | 'pasienId'>;

export const umurArb: fc.Arbitrary<number | null> = fc.oneof(
  fc.constant(null),
  fc.integer({ min: 0, max: 150 }),
);

export const jenisKelaminArb: fc.Arbitrary<'Laki-laki' | 'Wanita' | null> = fc.constantFrom(
  null,
  'Laki-laki',
  'Wanita',
);

/** Field pasien valid (ter-trim, panjang di batas, non-ASCII). */
export const pasienFieldsArb: fc.Arbitrary<PasienTanpaId> = fc
  .record({
    nama: trimmedText(1, BATAS.nama),
    alamat: trimmedText(0, BATAS.alamat),
    noHp: noHpValidArb,
    umur: umurArb,
    jenisKelamin: jenisKelaminArb,
    ts: timestampsArb,
  })
  .map(({ ts, ...f }) => ({ ...f, ...ts }));

/** Field sesi valid tanpa id/pasienId. */
export const sesiFieldsArb: fc.Arbitrary<SesiTanpaRelasi> = fc
  .record({
    tanggal: tanggalValidArb({ minYear: 2000, maxYear: 2100 }),
    keluhan: trimmedText(1, BATAS.teksSesi),
    polaPenyakit: trimmedText(0, BATAS.teksSesi),
    terapi: trimmedText(1, BATAS.teksSesi),
    hasil: trimmedText(0, BATAS.teksSesi),
    biaya: biayaArb,
    ts: timestampsArb,
  })
  .map(({ ts, ...f }) => ({ ...f, ...ts }));

export const statusJadwalArb: fc.Arbitrary<StatusJadwal> = fc.constantFrom(...STATUS_JADWAL);

/** Field jadwal valid tanpa id/pasienId. */
export function jadwalFieldsArb(status: fc.Arbitrary<StatusJadwal> = statusJadwalArb): fc.Arbitrary<JadwalTanpaRelasi> {
  return fc
    .record({
      tanggal: tanggalValidArb({ minYear: 2000, maxYear: 2100 }),
      jam: jamValidArb,
      catatan: trimmedText(0, BATAS.catatan),
      status,
      ts: timestampsArb,
    })
    .map(({ ts, ...f }) => ({ ...f, ...ts }));
}

/** Pasien valid lengkap. */
export const pasienArb: fc.Arbitrary<Pasien> = fc
  .tuple(idArb, pasienFieldsArb)
  .map(([id, f]) => ({ id, ...f }));

/** Sesi valid milik `pasienId` (atau pasienId acak bila tidak diberikan). */
export function sesiArb(pasienId?: string | fc.Arbitrary<string>): fc.Arbitrary<SesiTerapi> {
  const pid = pasienId === undefined ? idArb : typeof pasienId === 'string' ? fc.constant(pasienId) : pasienId;
  return fc.tuple(idArb, pid, sesiFieldsArb).map(([id, p, f]) => ({ id, pasienId: p, ...f }));
}

/** Jadwal valid milik `pasienId` (atau pasienId acak bila tidak diberikan). */
export function jadwalArb(
  pasienId?: string | fc.Arbitrary<string>,
  status?: fc.Arbitrary<StatusJadwal>,
): fc.Arbitrary<JadwalKunjungan> {
  const pid = pasienId === undefined ? idArb : typeof pasienId === 'string' ? fc.constant(pasienId) : pasienId;
  return fc.tuple(idArb, pid, jadwalFieldsArb(status)).map(([id, p, f]) => ({ id, pasienId: p, ...f }));
}

// ---------------------------------------------------------------------------
// AppData dengan relasi konsisten
// ---------------------------------------------------------------------------

export interface AppDataOptions {
  maxPasien?: number;
  maxSesi?: number;
  maxJadwal?: number;
}

/**
 * AppData valid: id unik secara global (lintas jenis), setiap sesi/jadwal
 * merujuk pasien yang ada. Termasuk kemungkinan data kosong.
 */
export function appDataArb({ maxPasien = 6, maxSesi = 12, maxJadwal = 12 }: AppDataOptions = {}): fc.Arbitrary<AppData> {
  return fc
    .integer({ min: 0, max: maxPasien })
    .chain((np) =>
      fc
        .tuple(
          fc.constant(np),
          np === 0 ? fc.constant(0) : fc.integer({ min: 0, max: maxSesi }),
          np === 0 ? fc.constant(0) : fc.integer({ min: 0, max: maxJadwal }),
        ),
    )
    .chain(([np, ns, nj]) => {
      const total = np + ns + nj;
      const owner = fc.nat({ max: Math.max(0, np - 1) });
      return fc
        .tuple(
          fc.uniqueArray(idArb, { minLength: total, maxLength: total }),
          fc.array(pasienFieldsArb, { minLength: np, maxLength: np }),
          fc.array(fc.tuple(owner, sesiFieldsArb), { minLength: ns, maxLength: ns }),
          fc.array(fc.tuple(owner, jadwalFieldsArb()), { minLength: nj, maxLength: nj }),
        )
        .map(([ids, pf, sf, jf]): AppData => {
          const pasien: Pasien[] = pf.map((f, i) => ({ id: ids[i] as string, ...f }));
          const ownerId = (k: number): string => (pasien[k] as Pasien).id;
          const sesi: SesiTerapi[] = sf.map(([k, f], i) => ({
            id: ids[np + i] as string,
            pasienId: ownerId(k),
            ...f,
          }));
          const jadwal: JadwalKunjungan[] = jf.map(([k, f], i) => ({
            id: ids[np + ns + i] as string,
            pasienId: ownerId(k),
            ...f,
          }));
          return { pasien, sesi, jadwal };
        });
    });
}

/** AppData valid yang memiliki minimal satu pasien. */
export function appDataNonEmptyArb(opts: AppDataOptions = {}): fc.Arbitrary<AppData> {
  return appDataArb(opts).filter((d) => d.pasien.length > 0);
}

// ---------------------------------------------------------------------------
// Input formulir
// ---------------------------------------------------------------------------

/** Input formulir pasien acak di sekitar batas (valid maupun tidak). */
export const pasienInputArb: fc.Arbitrary<PasienInput> = fc.record({
  nama: formTextAround(BATAS.nama),
  alamat: formTextAround(BATAS.alamat),
  noHp: noHpInputArb,
  umur: fc.oneof(fc.constant(''), fc.integer({ min: -10, max: 200 }).map(String), fc.string()),
  jenisKelamin: fc.constantFrom('', 'Laki-laki', 'Wanita'),
});

/** Input formulir pasien yang pasti valid (mungkin ber-padding whitespace). */
export const pasienInputValidArb: fc.Arbitrary<PasienInput> = fc.record({
  nama: withPadding(trimmedText(1, BATAS.nama)),
  alamat: withPadding(trimmedText(0, BATAS.alamat)),
  noHp: withPadding(noHpValidArb),
  umur: fc.oneof(
    fc.constant(''),
    fc.integer({ min: 0, max: 150 }).map(String),
    fc.integer({ min: 0, max: 150 }).map((n) => `0${n}`),
  ),
  jenisKelamin: fc.constantFrom('', 'Laki-laki', 'Wanita'),
});

/** Input formulir sesi acak di sekitar batas (valid maupun tidak). */
export const sesiInputArb: fc.Arbitrary<SesiInput> = fc.record({
  tanggal: tanggalInputArb,
  keluhan: formTextAround(BATAS.teksSesi),
  polaPenyakit: formTextAround(BATAS.teksSesi),
  terapi: formTextAround(BATAS.teksSesi),
  hasil: formTextAround(BATAS.teksSesi),
  biaya: biayaInputArb,
});

/** Input formulir sesi yang pasti valid. */
export const sesiInputValidArb: fc.Arbitrary<SesiInput> = fc.record({
  tanggal: tanggalValidArb({ minYear: 2000, maxYear: 2100 }),
  keluhan: withPadding(trimmedText(1, BATAS.teksSesi)),
  polaPenyakit: fc.oneof(whitespaceOnlyArb, withPadding(trimmedText(0, BATAS.teksSesi))),
  terapi: withPadding(trimmedText(1, BATAS.teksSesi)),
  hasil: fc.oneof(whitespaceOnlyArb, withPadding(trimmedText(0, BATAS.teksSesi))),
  biaya: biayaInputValidArb,
});

/**
 * Input formulir jadwal acak. `pasienId` diambil dari `pasienIds` (bila ada),
 * id acak yang tidak terdaftar, atau kosong. Tanggal/jam bisa di sekitar `now`.
 */
export function jadwalInputArb(pasienIds: readonly string[], now?: Date): fc.Arbitrary<JadwalInput> {
  const pidArb: fc.Arbitrary<string> =
    pasienIds.length > 0
      ? fc.oneof(
          { arbitrary: fc.constantFrom(...pasienIds), weight: 4 },
          { arbitrary: idArb.filter((id) => !pasienIds.includes(id)), weight: 1 },
          { arbitrary: fc.constant(''), weight: 1 },
        )
      : fc.oneof(idArb, fc.constant(''));
  const waktuAcak = fc.record({
    tanggal: fc.oneof(tanggalValidArb({ minYear: 2000, maxYear: 2100 }), tanggalTidakValidArb),
    jam: fc.oneof(jamValidArb, jamTidakValidArb),
  });
  const waktuArb =
    now === undefined
      ? waktuAcak
      : fc.oneof(
          tanggalJamSekitar(now).map(({ tanggal, jam }) => ({ tanggal, jam })),
          waktuAcak,
        );
  return fc
    .record({ pasienId: pidArb, waktu: waktuArb, catatan: formTextAround(BATAS.catatan) })
    .map(({ pasienId, waktu, catatan }) => ({ pasienId, ...waktu, catatan }));
}

// ---------------------------------------------------------------------------
// File_Cadangan dan mutator rusak
// ---------------------------------------------------------------------------

export const BACKUP_FORMAT_VERSION = 1;

/** Objek File_Cadangan sesuai format design (independen dari cadangan.ts). */
export function buildBackupObject(data: AppData, exportedAt = '2025-01-05T09:30:00+07:00'): Record<string, unknown> {
  return { app: 'datapasien', formatVersion: BACKUP_FORMAT_VERSION, exportedAt, data };
}

export function buildBackupText(data: AppData, exportedAt?: string): string {
  return JSON.stringify(buildBackupObject(data, exportedAt), null, 2);
}

export type JenisKerusakan =
  | 'kosong'
  | 'jsonTerpotong'
  | 'bukanJson'
  | 'strukturSalah'
  | 'fieldHilang'
  | 'versiLain'
  | 'rekamanTidakValid'
  | 'idGanda'
  | 'pasienIdTidakAda';

export interface CadanganRusak {
  jenis: JenisKerusakan;
  text: string;
}

type Obj = Record<string, unknown>;
type Mutasi = (b: Obj) => void;

type DataObj = Obj & { pasien: Obj[]; sesi: Obj[]; jadwal: Obj[] };

function dataOf(b: Obj): DataObj {
  return b['data'] as DataObj;
}

const PASIEN_KEYS = ['id', 'nama', 'alamat', 'noHp', 'createdAt', 'updatedAt'] as const;
const SESI_KEYS = [
  'id', 'pasienId', 'tanggal', 'keluhan', 'polaPenyakit', 'terapi', 'hasil', 'biaya', 'createdAt', 'updatedAt',
] as const;
const JADWAL_KEYS = ['id', 'pasienId', 'tanggal', 'jam', 'catatan', 'status', 'createdAt', 'updatedAt'] as const;

/** Mutasi yang membuat satu rekaman melanggar aturan Validator (nilai tidak valid bahkan setelah trim). */
const pelanggaranPasien: Array<[string, unknown]> = [
  ['nama', ''],
  ['nama', '   '],
  ['nama', 'x'.repeat(BATAS.nama + 1)],
  ['alamat', 'y'.repeat(BATAS.alamat + 1)],
  ['noHp', '0812345'],
  ['noHp', '07123456789'],
  ['noHp', '0812-3456-789'],
];
const pelanggaranSesi: Array<[string, unknown]> = [
  ['tanggal', '2023-02-29'],
  ['tanggal', '2025-13-01'],
  ['tanggal', ''],
  ['keluhan', ''],
  ['terapi', '  '],
  ['keluhan', 'k'.repeat(BATAS.teksSesi + 1)],
  ['hasil', 'h'.repeat(BATAS.teksSesi + 1)],
  ['biaya', -1],
  ['biaya', 1.5],
  ['biaya', BATAS.biayaMaks + 1],
];
const pelanggaranJadwal: Array<[string, unknown]> = [
  ['jam', '24:00'],
  ['jam', '9:30'],
  ['tanggal', '2025-02-30'],
  ['catatan', 'c'.repeat(BATAS.catatan + 1)],
  ['status', 'Ditunda'],
];

/**
 * Arbitrary kerusakan File_Cadangan untuk `data` valid. Setiap hasil dijamin
 * tidak valid menurut aturan format/Validator/relasi. `freshPasien`/`freshSesi`
 * dipakai saat data tidak punya rekaman yang dapat dimutasi.
 */
export function cadanganRusakArb(data: AppData): fc.Arbitrary<CadanganRusak> {
  const base = (): Obj => JSON.parse(JSON.stringify(buildBackupObject(data))) as Obj;
  const text = buildBackupText(data);
  const allIds = new Set([...data.pasien, ...data.sesi, ...data.jadwal].map((r) => r.id));
  const idBaru = idArb.filter((id) => !allIds.has(id));

  const mutasiArb = (jenis: JenisKerusakan, m: fc.Arbitrary<Mutasi>): fc.Arbitrary<CadanganRusak> =>
    m.map((fn) => {
      const b = base();
      fn(b);
      return { jenis, text: JSON.stringify(b, null, 2) };
    });

  const kosong = fc
    .constantFrom('', ' ', '\n', '\t \r\n')
    .map((t): CadanganRusak => ({ jenis: 'kosong', text: t }));

  // Prefiks sejati sebelum '}' penutup: kurung tidak seimbang → JSON tidak valid.
  const lastBrace = text.lastIndexOf('}');
  const terpotong = fc
    .integer({ min: 1, max: Math.max(1, lastBrace) })
    .map((k): CadanganRusak => ({ jenis: 'jsonTerpotong', text: text.slice(0, k) }));

  const bukanJson = fc
    .constantFrom('bukan json', '{', '{"app": "datapasien",}', "{'app':'datapasien'}", 'undefined', 'NaN', '<xml/>')
    .map((t): CadanganRusak => ({ jenis: 'bukanJson', text: t }));

  const strukturSalah = fc.oneof(
    fc
      .constantFrom<unknown>(null, 1, 'teks', [], [buildBackupObject(data)], true)
      .map((v): CadanganRusak => ({ jenis: 'strukturSalah', text: JSON.stringify(v) })),
    mutasiArb(
      'strukturSalah',
      fc.constantFrom<Mutasi>(
        (b) => delete b['data'],
        (b) => (b['data'] = null),
        (b) => (b['data'] = []),
        (b) => delete (dataOf(b) as Obj)['pasien'],
        (b) => ((dataOf(b) as Obj)['sesi'] = {}),
        (b) => ((dataOf(b) as Obj)['jadwal'] = 'x'),
        (b) => delete b['formatVersion'],
      ),
    ),
  );

  const versiLain = mutasiArb(
    'versiLain',
    fc
      .oneof(fc.constantFrom<unknown>(0, 2, 999, -1, 1.5), fc.integer({ min: 2, max: 1000 }))
      .map((v): Mutasi => (b) => (b['formatVersion'] = v)),
  );

  // Field hilang / bertipe salah pada satu rekaman (ditambahkan bila tidak ada).
  const fieldHilang = mutasiArb(
    'fieldHilang',
    fc
      .tuple(pasienArb, fc.nat(), fc.constantFrom('hapus', 'tipe') as fc.Arbitrary<'hapus' | 'tipe'>)
      .chain(([pBaru, idx, mode]) => {
        const kinds: Array<['pasien' | 'sesi' | 'jadwal', readonly string[]]> = [['pasien', PASIEN_KEYS]];
        if (data.sesi.length > 0) kinds.push(['sesi', SESI_KEYS]);
        if (data.jadwal.length > 0) kinds.push(['jadwal', JADWAL_KEYS]);
        return fc.constantFrom(...kinds).chain(([kind, keys]) =>
          fc.constantFrom(...keys).map((key): Mutasi => (b) => {
            const list = dataOf(b)[kind];
            if (list.length === 0) list.push({ ...pBaru } as unknown as Obj);
            const rec = list[idx % list.length] as Obj;
            if (mode === 'hapus') delete rec[key];
            else rec[key] = typeof rec[key] === 'number' ? 'bukan angka' : 12345;
          }),
        );
      }),
  );

  const rekamanTidakValid = mutasiArb(
    'rekamanTidakValid',
    fc.tuple(pasienArb.filter((p) => !allIds.has(p.id)), fc.nat()).chain(([pBaru, idx]) => {
      const opsi: Array<fc.Arbitrary<Mutasi>> = [
        fc.constantFrom(...pelanggaranPasien).map(([k, v]): Mutasi => (b) => {
          const list = dataOf(b).pasien;
          if (list.length === 0) list.push({ ...pBaru } as unknown as Obj);
          (list[idx % list.length] as Obj)[k] = v;
        }),
      ];
      if (data.sesi.length > 0)
        opsi.push(
          fc.constantFrom(...pelanggaranSesi).map(([k, v]): Mutasi => (b) => {
            const list = dataOf(b).sesi;
            (list[idx % list.length] as Obj)[k] = v;
          }),
        );
      if (data.jadwal.length > 0)
        opsi.push(
          fc.constantFrom(...pelanggaranJadwal).map(([k, v]): Mutasi => (b) => {
            const list = dataOf(b).jadwal;
            (list[idx % list.length] as Obj)[k] = v;
          }),
        );
      return fc.oneof(...opsi);
    }),
  );

  const idGanda = mutasiArb(
    'idGanda',
    fc.tuple(pasienArb, pasienFieldsArb, fc.nat()).chain(([p1, f2, idx]) => {
      const opsi: Array<fc.Arbitrary<Mutasi>> = [
        fc.constant<Mutasi>((b) => {
          const list = dataOf(b).pasien;
          if (list.length === 0) {
            list.push({ ...p1 } as unknown as Obj, { ...f2, id: p1.id } as unknown as Obj);
          } else {
            const src = list[idx % list.length] as Obj;
            list.push({ ...src, nama: 'Duplikat' });
          }
        }),
      ];
      for (const kind of ['sesi', 'jadwal'] as const) {
        if (data[kind].length > 0)
          opsi.push(
            fc.constant<Mutasi>((b) => {
              const list = dataOf(b)[kind];
              list.push({ ...(list[idx % list.length] as Obj) });
            }),
          );
      }
      return fc.oneof(...opsi);
    }),
  );

  const pasienIdTidakAda = mutasiArb(
    'pasienIdTidakAda',
    fc
      .tuple(idBaru, idBaru, sesiFieldsArb, jadwalFieldsArb(), fc.nat(), fc.constantFrom('sesi', 'jadwal') as fc.Arbitrary<'sesi' | 'jadwal'>)
      .filter(([a, b]) => a !== b)
      .map(([orphanPid, recId, sf, jf, idx, kind]): Mutasi => (b) => {
        const list = dataOf(b)[kind];
        if (list.length > 0 && idx % 2 === 0) {
          (list[idx % list.length] as Obj)['pasienId'] = orphanPid;
        } else {
          const fields = kind === 'sesi' ? sf : jf;
          list.push({ id: recId, pasienId: orphanPid, ...fields } as unknown as Obj);
        }
      }),
  );

  return fc.oneof(
    kosong,
    terpotong,
    bukanJson,
    strukturSalah,
    fieldHilang,
    versiLain,
    rekamanTidakValid,
    idGanda,
    pasienIdTidakAda,
  );
}

/** AppData valid beserta salah satu versi File_Cadangan rusaknya. */
export function dataDanCadanganRusakArb(opts: AppDataOptions = {}): fc.Arbitrary<{ data: AppData } & CadanganRusak> {
  return appDataArb(opts).chain((data) => cadanganRusakArb(data).map((r) => ({ data, ...r })));
}
