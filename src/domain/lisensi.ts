// Kode aktivasi Full Version (verifikasi offline).
//
// Format kode: "DP1.<payload>.<tanda-tangan>"
// - payload    : base64url(JSON {"e": email, "t": "YYYY-MM-DD"})
// - tanda-tangan: base64url(ECDSA P-256 / SHA-256, format IEEE-P1363 64 byte)
//                 atas teks ASCII "DP1.<payload>"
// Kode diterbitkan oleh pembuat aplikasi dengan kunci privat
// (scripts/lisensi.mjs); aplikasi hanya membawa kunci publik.

export const PREFIKS_KODE = 'DP1';

export interface InfoLisensi {
  email: string;
  /** Tanggal terbit "YYYY-MM-DD". */
  diterbitkan: string;
  /** Kode lengkap yang sudah dinormalisasi. */
  kode: string;
}

export type HasilVerifikasi = { ok: true; info: InfoLisensi } | { ok: false; alasan: string };

export const PESAN_KODE_TIDAK_DIKENALI = 'Kode aktivasi tidak dikenali. Salin ulang kode lengkap dari pesan WhatsApp.';
export const PESAN_KODE_TIDAK_VALID = 'Kode aktivasi tidak valid';
export const PESAN_TIDAK_DIDUKUNG = 'Perangkat ini tidak mendukung pemeriksaan kode aktivasi';

// Tanda tangan selalu 64 byte = tepat 86 karakter base64url, sehingga teks yang
// menempel setelah kode (mis. "Terima kasih" setelah spasi dibuang) diabaikan.
const POLA_KODE = new RegExp(`${PREFIKS_KODE}\\.([A-Za-z0-9_-]+)\\.([A-Za-z0-9_-]{86})`);

/**
 * Ambil kode dari teks tempelan. Spasi/baris baru (mis. akibat pemotongan baris
 * di WhatsApp) dibuang lebih dulu; teks di sekitar kode diabaikan.
 */
export function ekstrakKode(teks: string): { kode: string; payload: string; ttd: string } | null {
  const m = POLA_KODE.exec(teks.replace(/\s+/g, ''));
  if (!m) return null;
  return { kode: m[0], payload: m[1]!, ttd: m[2]! };
}

export function base64UrlKeBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bacaPayload(payload: string): { email: string; diterbitkan: string } | null {
  try {
    const obj: unknown = JSON.parse(new TextDecoder().decode(base64UrlKeBytes(payload)));
    if (typeof obj !== 'object' || obj === null) return null;
    const { e, t } = obj as Record<string, unknown>;
    if (typeof e !== 'string' || e.trim() === '' || typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return null;
    }
    return { email: e, diterbitkan: t };
  } catch {
    return null;
  }
}

/** Verifikasi kode terhadap kunci publik (JWK EC P-256). Tidak pernah melempar. */
export async function verifikasiKode(
  teks: string,
  kunciPublik: JsonWebKey,
  subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle,
): Promise<HasilVerifikasi> {
  const bagian = ekstrakKode(teks);
  if (!bagian) return { ok: false, alasan: PESAN_KODE_TIDAK_DIKENALI };
  const isi = bacaPayload(bagian.payload);
  if (!isi) return { ok: false, alasan: PESAN_KODE_TIDAK_DIKENALI };
  if (!subtle) return { ok: false, alasan: PESAN_TIDAK_DIDUKUNG };

  try {
    const ttd = base64UrlKeBytes(bagian.ttd);
    if (ttd.length !== 64) return { ok: false, alasan: PESAN_KODE_TIDAK_VALID };
    const kunci = await subtle.importKey('jwk', kunciPublik, { name: 'ECDSA', namedCurve: 'P-256' }, false, [
      'verify',
    ]);
    const pesan = new TextEncoder().encode(`${PREFIKS_KODE}.${bagian.payload}`);
    const sah = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kunci, ttd as BufferSource, pesan);
    if (!sah) return { ok: false, alasan: PESAN_KODE_TIDAK_VALID };
    return { ok: true, info: { ...isi, kode: bagian.kode } };
  } catch {
    return { ok: false, alasan: PESAN_KODE_TIDAK_VALID };
  }
}
