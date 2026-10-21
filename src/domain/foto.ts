// Utilitas domain Foto Sesi dan Logo Praktik (murni tanpa I/O).

import { formatTanggal } from './format';
import type { FotoDiproses, FotoMeta } from './types';

export const BATAS_JUMLAH_FOTO = 10;
export const PROFIL_FOTO = { maksByte: 20_971_520, maksSisi: 1600, maksDimensi: 1600, labelBatas: '20 MB' } as const;
export const PROFIL_LOGO = { maksByte: 5_242_880, maksSisi: 512, maksDimensi: 512, labelBatas: '5 MB' } as const;

export type FormatSumber = 'jpeg' | 'png' | 'webp' | 'heic' | 'gif' | 'bmp' | 'avif';

export type AlasanTolak = 'format' | 'ukuran' | 'batas';

function stringAt(bytes: Uint8Array, offset: number, len: number): string {
  if (offset + len > bytes.length) return '';
  let str = '';
  for (let i = 0; i < len; i++) {
    const b = bytes[offset + i];
    if (b !== undefined) str += String.fromCharCode(b);
  }
  return str;
}

/**
 * Deteksi format gambar dari magic bytes (header 12–32 byte pertama).
 */
export function deteksiFormat(header: Uint8Array): FormatSumber | null {
  if (header.length < 2) return null;

  // JPEG: FF D8 FF
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return 'png';
  }

  // GIF: GIF87a / GIF89a
  if (header.length >= 6) {
    const s6 = stringAt(header, 0, 6);
    if (s6 === 'GIF87a' || s6 === 'GIF89a') return 'gif';
  }

  // BMP: BM
  if (header[0] === 0x42 && header[1] === 0x4d) {
    return 'bmp';
  }

  // WebP: RIFF....WEBP
  if (header.length >= 12 && stringAt(header, 0, 4) === 'RIFF' && stringAt(header, 8, 4) === 'WEBP') {
    return 'webp';
  }

  // ISO-BMFF: ftyp pada offset 4
  if (header.length >= 12 && stringAt(header, 4, 4) === 'ftyp') {
    // Kumpulkan brand (major brand pada offset 8 dan compatible brands berikutnya)
    const brands: string[] = [];
    for (let offset = 8; offset + 4 <= header.length; offset += 4) {
      brands.push(stringAt(header, offset, 4).toLowerCase());
    }

    const avifBrands = ['avif', 'avis'];
    if (brands.some((b) => avifBrands.includes(b))) {
      return 'avif';
    }

    const heicBrands = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'];
    if (brands.some((b) => heicBrands.includes(b))) {
      return 'heic';
    }
  }

  return null;
}

/**
 * Deteksi format gambar dari magic bytes (menerima ArrayBuffer atau Uint8Array).
 */
export function deteksiFormatMagic(buf: ArrayBuffer | Uint8Array): FormatSumber | 'unknown' {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return deteksiFormat(bytes) ?? 'unknown';
}

/**
 * Menghitung ukuran target gambar: sisi terpanjang <= maks, rasio dipertahankan,
 * tidak diperbesar, sisi minimal 1 px.
 */
export function ukuranTarget(w: number, h: number, maks: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 1, h: 1 };
  const sisiPanjang = Math.max(w, h);
  if (sisiPanjang <= maks) {
    return { w, h };
  }
  if (w >= h) {
    const wTarget = maks;
    const hTarget = Math.max(1, Math.round((h * maks) / w));
    return { w: wTarget, h: hTarget };
  } else {
    const hTarget = maks;
    const wTarget = Math.max(1, Math.round((w * maks) / h));
    return { w: wTarget, h: hTarget };
  }
}

/** Teks alternatif aksesibel untuk Foto N. */
export function teksAltFoto(n: number, tanggal: string): string {
  const trimmed = tanggal.trim();
  if (trimmed === '') return `Foto ${n} sesi terapi`;
  // Jika tanggal berupa ISO YYYY-MM-DD, formatkan ke bahasa Indonesia
  const tglTampil = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? formatTanggal(trimmed) : trimmed;
  return `Foto ${n} sesi terapi ${tglTampil}`;
}

/** Format posisi foto: "3 / 7" */
export function posisiFoto(n: number, total: number): string {
  return `${n} / ${total}`;
}

/** Status aktif tombol navigasi penampil foto. */
export function navPenampil(
  index: number,
  total: number,
): { sebelumnya: boolean; berikutnya: boolean } {
  if (total <= 1) {
    return { sebelumnya: false, berikutnya: false };
  }
  return {
    sebelumnya: index > 0,
    berikutnya: index < total - 1,
  };
}

// ---------------------------------------------------------------------------
// Draft foto Formulir Sesi (state murni)
// ---------------------------------------------------------------------------

export type ItemDraft =
  | { jenis: 'tersimpan'; meta: FotoMeta }
  | { jenis: 'baru'; tempId: string; foto: FotoDiproses };

export interface FotoDraft {
  items: ItemDraft[];
  memproses: boolean;
  pesan: string[];
}

export type AksiDraft =
  | { type: 'prosesMulai' }
  | { type: 'terima'; tempId: string; foto: FotoDiproses }
  | { type: 'tolak'; namaFile: string; alasan: AlasanTolak }
  | { type: 'prosesSelesai' }
  | { type: 'hapus'; key: string };

export function pesanPenolakan(namaFile: string, alasan: AlasanTolak): string {
  if (alasan === 'format') return `${namaFile}: format gambar tidak didukung`;
  if (alasan === 'ukuran') return `${namaFile}: ukuran melebihi batas 20 MB`;
  return 'Maksimal 10 foto per sesi terapi';
}

export function draftAwal(fotoTersimpan: FotoMeta[]): FotoDraft {
  const sorted = [...fotoTersimpan].sort((a, b) => a.urutan - b.urutan);
  return {
    items: sorted.map((meta) => ({ jenis: 'tersimpan', meta })),
    memproses: false,
    pesan: [],
  };
}

export function bolehTambah(s: FotoDraft): boolean {
  return !s.memproses && s.items.length < BATAS_JUMLAH_FOTO;
}

export function fotoDraftReducer(s: FotoDraft, a: AksiDraft): FotoDraft {
  switch (a.type) {
    case 'prosesMulai':
      return { ...s, memproses: true, pesan: [] };
    case 'terima': {
      if (s.items.length >= BATAS_JUMLAH_FOTO) {
        const pesanBatas = pesanPenolakan('', 'batas');
        const pesan = s.pesan.includes(pesanBatas) ? s.pesan : [...s.pesan, pesanBatas];
        return { ...s, pesan };
      }
      return {
        ...s,
        items: [...s.items, { jenis: 'baru', tempId: a.tempId, foto: a.foto }],
      };
    }
    case 'tolak': {
      const p = pesanPenolakan(a.namaFile, a.alasan);
      const pesan = s.pesan.includes(p) ? s.pesan : [...s.pesan, p];
      return { ...s, pesan };
    }
    case 'prosesSelesai':
      return { ...s, memproses: false };
    case 'hapus': {
      const items = s.items.filter((item) => {
        const key = item.jenis === 'tersimpan' ? item.meta.id : item.tempId;
        return key !== a.key;
      });
      return { ...s, items };
    }
    default:
      return s;
  }
}

export function diffDraft(
  awal: FotoMeta[],
  s: FotoDraft,
): { tambah: FotoDiproses[]; hapusIds: string[] } {
  const tambah: FotoDiproses[] = [];
  const tersimpanIdSet = new Set<string>();

  for (const item of s.items) {
    if (item.jenis === 'baru') {
      tambah.push(item.foto);
    } else {
      tersimpanIdSet.add(item.meta.id);
    }
  }

  const hapusIds = awal.filter((m) => !tersimpanIdSet.has(m.id)).map((m) => m.id);

  return { tambah, hapusIds };
}
