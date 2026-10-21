// Serialisasi dan validasi File_Cadangan (Req 14). Fungsi murni tanpa I/O.
//
// parseBackup memeriksa berurutan dan berhenti pada alasan pertama:
// file kosong → JSON tidak valid → struktur tidak sesuai → versi tidak
// didukung → rekaman tidak lolos Validator / tipe field salah → identitas
// ganda → sesi/jadwal yang pasienId-nya tidak ada di file.

import { pad2 } from './tanggal';
import { STATUS_JADWAL } from './types';
import type { AppData, Counts, JadwalKunjungan, Pasien, SesiTerapi, StatusJadwal } from './types';
import { validateJadwal, validatePasien, validateSesi } from './validator';

export const FORMAT_VERSION = 1;
export const APP_ID = 'datapasien';

export const ALASAN = {
  kosong: 'File kosong',
  bukanJson: 'File bukan JSON yang valid',
  strukturSalah: 'Struktur file cadangan tidak sesuai',
  versiTidakDidukung: 'Versi file cadangan tidak didukung',
  /** Prefiks; lengkapnya "Data pasien ke-N tidak valid: <pesan>". */
  pasienTidakValid: 'Data pasien',
  sesiTidakValid: 'Data sesi terapi',
  jadwalTidakValid: 'Data jadwal kunjungan',
  /** Prefiks; lengkapnya "Identitas ganda ditemukan pada data <jenis>". */
  idGanda: 'Identitas ganda ditemukan',
  sesiTanpaPasien: 'Sesi terapi merujuk pasien yang tidak ada',
  jadwalTanpaPasien: 'Jadwal kunjungan merujuk pasien yang tidak ada',
} as const;

export type ParseBackupResult =
  | { ok: true; data: AppData; counts: Counts }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Ekspor
// ---------------------------------------------------------------------------

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/** ISO 8601 waktu lokal dengan offset, mis. "2025-01-05T09:30:00+07:00". */
export function toLocalISOString(d: Date): string {
  const offsetMenit = -d.getTimezoneOffset();
  const tanda = offsetMenit >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMenit);
  return (
    `${pad4(d.getFullYear())}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    `${tanda}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
  );
}

/** "datapasien-cadangan-YYYYMMDD-HHmm.json" menurut waktu lokal. */
export function backupFileName(d: Date): string {
  const tgl = `${pad4(d.getFullYear())}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
  return `datapasien-cadangan-${tgl}-${pad2(d.getHours())}${pad2(d.getMinutes())}.json`;
}

function pickPasien(p: Pasien): Pasien {
  return {
    id: p.id,
    nama: p.nama,
    alamat: p.alamat,
    noHp: p.noHp,
    umur: p.umur ?? null,
    jenisKelamin: p.jenisKelamin ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function pickSesi(s: SesiTerapi): SesiTerapi {
  return {
    id: s.id,
    pasienId: s.pasienId,
    tanggal: s.tanggal,
    keluhan: s.keluhan,
    polaPenyakit: s.polaPenyakit,
    terapi: s.terapi,
    hasil: s.hasil,
    biaya: s.biaya,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function pickJadwal(j: JadwalKunjungan): JadwalKunjungan {
  return {
    id: j.id,
    pasienId: j.pasienId,
    tanggal: j.tanggal,
    jam: j.jam,
    catatan: j.catatan,
    status: j.status,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

/** Teks File_Cadangan (JSON berindentasi 2). */
export function serializeBackup(data: AppData, exportedAt: Date): string {
  const file = {
    app: APP_ID,
    formatVersion: FORMAT_VERSION,
    exportedAt: toLocalISOString(exportedAt),
    data: {
      pasien: data.pasien.map(pickPasien),
      sesi: data.sesi.map(pickSesi),
      jadwal: data.jadwal.map(pickJadwal),
    },
  };
  return JSON.stringify(file, null, 2);
}

// ---------------------------------------------------------------------------
// Impor
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;

function isObject(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Galat internal pembawa alasan penolakan. */
class Tolak extends Error {}

function fieldSalah(field: string): string {
  return `field "${field}" tidak ada atau bertipe salah`;
}

function belumNormal(field: string): string {
  return `nilai field "${field}" memiliki spasi di awal atau akhir`;
}

function ambilString(rec: Obj, field: string): string {
  const v = rec[field];
  if (typeof v !== 'string') throw new Tolak(fieldSalah(field));
  return v;
}

function ambilId(rec: Obj, field: string): string {
  const v = ambilString(rec, field);
  if (v.length === 0) throw new Tolak(fieldSalah(field));
  return v;
}

function ambilWaktu(rec: Obj, field: string): number {
  const v = rec[field];
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new Tolak(fieldSalah(field));
  return v;
}

/** Pesan pertama dari hasil validasi gagal. */
function pesanPertama(errors: Partial<Record<string, string>>): string {
  return Object.values(errors).find((m): m is string => typeof m === 'string') ?? 'tidak valid';
}

/** Pastikan nilai tersimpan sama dengan hasil normalisasi Validator. */
function cekNormal(asli: Obj, normal: Obj, fields: readonly string[]): void {
  for (const f of fields) {
    if (asli[f] !== normal[f]) throw new Tolak(belumNormal(f));
  }
}

function parsePasien(v: unknown): Pasien {
  if (!isObject(v)) throw new Tolak('rekaman bukan objek');
  const id = ambilId(v, 'id');
  const nama = ambilString(v, 'nama');
  const alamat = ambilString(v, 'alamat');
  const noHp = ambilString(v, 'noHp');
  const createdAt = ambilWaktu(v, 'createdAt');
  const updatedAt = ambilWaktu(v, 'updatedAt');

  // Validasi umur (Req 9.12, 9.13)
  let umur: number | null = null;
  if ('umur' in v && v.umur !== null && v.umur !== undefined) {
    if (typeof v.umur !== 'number' || !Number.isInteger(v.umur) || v.umur < 0 || v.umur > 150) {
      throw new Tolak('Atribut umur tidak valid');
    }
    umur = v.umur;
  }

  // Validasi jenisKelamin (Req 9.12, 9.13)
  let jenisKelamin: 'Laki-laki' | 'Wanita' | null = null;
  if ('jenisKelamin' in v && v.jenisKelamin !== null && v.jenisKelamin !== undefined) {
    if (v.jenisKelamin !== 'Laki-laki' && v.jenisKelamin !== 'Wanita') {
      throw new Tolak('Atribut jenisKelamin tidak valid');
    }
    jenisKelamin = v.jenisKelamin;
  }

  const p: Pasien = {
    id,
    nama,
    alamat,
    noHp,
    umur,
    jenisKelamin,
    createdAt,
    updatedAt,
  };
  const r = validatePasien({
    nama,
    alamat,
    noHp,
    umur: umur !== null ? String(umur) : '',
    jenisKelamin: jenisKelamin ?? '',
  });
  if (!r.ok) throw new Tolak(pesanPertama(r.errors));
  cekNormal(p as unknown as Obj, r.value, ['nama', 'alamat', 'noHp']);
  return p;
}

function parseSesi(v: unknown): SesiTerapi {
  if (!isObject(v)) throw new Tolak('rekaman bukan objek');
  const id = ambilId(v, 'id');
  const pasienId = ambilId(v, 'pasienId');
  const tanggal = ambilString(v, 'tanggal');
  const keluhan = ambilString(v, 'keluhan');
  const polaPenyakit = ambilString(v, 'polaPenyakit');
  const terapi = ambilString(v, 'terapi');
  const hasil = ambilString(v, 'hasil');
  const biaya = v['biaya'];
  if (typeof biaya !== 'number') throw new Tolak(fieldSalah('biaya'));
  const createdAt = ambilWaktu(v, 'createdAt');
  const updatedAt = ambilWaktu(v, 'updatedAt');

  const s: SesiTerapi = {
    id, pasienId, tanggal, keluhan, polaPenyakit, terapi, hasil, biaya, createdAt, updatedAt,
  };
  // Biaya non-bulat (mis. 1.5) atau tak hingga ditolak lewat aturan Validator.
  const biayaTeks = Number.isInteger(biaya) ? String(biaya) : 'x';
  const r = validateSesi({ tanggal, keluhan, polaPenyakit, terapi, hasil, biaya: biayaTeks });
  if (!r.ok) throw new Tolak(pesanPertama(r.errors));
  cekNormal(s as unknown as Obj, r.value, ['keluhan', 'polaPenyakit', 'terapi', 'hasil', 'biaya']);
  return s;
}

function parseJadwal(v: unknown, now: Date): JadwalKunjungan {
  if (!isObject(v)) throw new Tolak('rekaman bukan objek');
  const id = ambilId(v, 'id');
  const pasienId = ambilId(v, 'pasienId');
  const tanggal = ambilString(v, 'tanggal');
  const jam = ambilString(v, 'jam');
  const catatan = ambilString(v, 'catatan');
  const status = ambilString(v, 'status');
  const createdAt = ambilWaktu(v, 'createdAt');
  const updatedAt = ambilWaktu(v, 'updatedAt');

  // Keberadaan pasien diperiksa pada tahap relasi (setelah identitas ganda),
  // jadi di sini pasienId rekaman sendiri dianggap terdaftar.
  const r = validateJadwal({ pasienId, tanggal, jam, catatan }, now, new Set([pasienId]), {
    abaikanWaktuLewat: true,
  });
  if (!r.ok) throw new Tolak(pesanPertama(r.errors));
  if (!(STATUS_JADWAL as readonly string[]).includes(status)) {
    throw new Tolak(`status "${status}" tidak dikenal`);
  }
  const j: JadwalKunjungan = {
    id, pasienId, tanggal, jam, catatan, status: status as StatusJadwal, createdAt, updatedAt,
  };
  cekNormal(j as unknown as Obj, r.value, ['catatan']);
  return j;
}

function parseDaftar<T>(list: unknown[], label: string, parse: (v: unknown) => T): T[] {
  return list.map((v, i) => {
    try {
      return parse(v);
    } catch (e) {
      if (e instanceof Tolak) throw new Tolak(`${label} ke-${i + 1} tidak valid: ${e.message}`);
      throw e;
    }
  });
}

function adaIdGanda(list: ReadonlyArray<{ id: string }>): boolean {
  return new Set(list.map((r) => r.id)).size !== list.length;
}

/** Membaca dan memvalidasi teks File_Cadangan. */
export function parseBackup(text: string): ParseBackupResult {
  if (text.trim().length === 0) return { ok: false, reason: ALASAN.kosong };

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return { ok: false, reason: ALASAN.bukanJson };
  }

  if (
    !isObject(root) ||
    root['app'] !== APP_ID ||
    !('formatVersion' in root) ||
    typeof root['exportedAt'] !== 'string' ||
    !isObject(root['data'])
  ) {
    return { ok: false, reason: ALASAN.strukturSalah };
  }
  const raw = root['data'];
  const rawPasien = raw['pasien'];
  const rawSesi = raw['sesi'];
  const rawJadwal = raw['jadwal'];
  if (!Array.isArray(rawPasien) || !Array.isArray(rawSesi) || !Array.isArray(rawJadwal)) {
    return { ok: false, reason: ALASAN.strukturSalah };
  }

  if (root['formatVersion'] !== FORMAT_VERSION) {
    return { ok: false, reason: ALASAN.versiTidakDidukung };
  }

  let data: AppData;
  try {
    const now = new Date();
    data = {
      pasien: parseDaftar(rawPasien, ALASAN.pasienTidakValid, parsePasien),
      sesi: parseDaftar(rawSesi, ALASAN.sesiTidakValid, parseSesi),
      jadwal: parseDaftar(rawJadwal, ALASAN.jadwalTidakValid, (v) => parseJadwal(v, now)),
    };
  } catch (e) {
    if (e instanceof Tolak) return { ok: false, reason: e.message };
    throw e;
  }

  if (adaIdGanda(data.pasien)) return { ok: false, reason: `${ALASAN.idGanda} pada data pasien` };
  if (adaIdGanda(data.sesi)) return { ok: false, reason: `${ALASAN.idGanda} pada data sesi terapi` };
  if (adaIdGanda(data.jadwal)) {
    return { ok: false, reason: `${ALASAN.idGanda} pada data jadwal kunjungan` };
  }

  const pasienIds = new Set(data.pasien.map((p) => p.id));
  if (data.sesi.some((s) => !pasienIds.has(s.pasienId))) {
    return { ok: false, reason: ALASAN.sesiTanpaPasien };
  }
  if (data.jadwal.some((j) => !pasienIds.has(j.pasienId))) {
    return { ok: false, reason: ALASAN.jadwalTanpaPasien };
  }

  return {
    ok: true,
    data,
    counts: { pasien: data.pasien.length, sesi: data.sesi.length, jadwal: data.jadwal.length },
  };
}
