// Query murni atas daftar pasien: pengurutan, pencarian, tanggal terapi
// terakhir, dan ringkasan hapus berantai. Tidak ada fungsi yang memutasi input.

import type { FotoMeta, JadwalKunjungan, Pasien, SesiTerapi } from './types';

const collator = new Intl.Collator('id', { sensitivity: 'base' });

/** Pembanding nama tanpa membedakan huruf besar/kecil, tie-break id (stabil & deterministik). */
function comparePasien(a: Pasien, b: Pasien): number {
  const byNama = collator.compare(a.nama, b.nama);
  if (byNama !== 0) return byNama;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Mengembalikan salinan daftar terurut nama menaik (case-insensitive), lalu id. Req 4.4 */
export function sortPasien(list: readonly Pasien[]): Pasien[] {
  return [...list].sort(comparePasien);
}

/**
 * Mencari pasien yang nama atau noHp-nya mengandung kata kunci (setelah trim,
 * tanpa membedakan huruf besar/kecil). Kata kunci kosong → semua pasien.
 * Hasil selalu terurut seperti `sortPasien`. Req 4.2, 4.3, 4.4
 */
export function searchPasien(list: readonly Pasien[], keyword: string): Pasien[] {
  const q = keyword.trim().toLowerCase();
  if (q === '') return sortPasien(list);
  return sortPasien(
    list.filter((p) => p.nama.toLowerCase().includes(q) || p.noHp.toLowerCase().includes(q)),
  );
}

/** Tanggal sesi terbaru milik pasien ("YYYY-MM-DD"), atau null jika belum ada sesi. Req 4.1, 4.7 */
export function lastTherapyDate(pasienId: string, sesi: readonly SesiTerapi[]): string | null {
  let latest: string | null = null;
  for (const s of sesi) {
    // Format ISO "YYYY-MM-DD" dapat dibandingkan secara leksikografis.
    if (s.pasienId === pasienId && (latest === null || s.tanggal > latest)) {
      latest = s.tanggal;
    }
  }
  return latest;
}

/** Jumlah sesi, jadwal, dan foto yang ikut terhapus bersama pasien. Req 3.1, 4.5, 4.6 */
export function deletionSummary(
  pasienId: string,
  sesi: readonly SesiTerapi[],
  jadwal: readonly JadwalKunjungan[],
  foto?: readonly FotoMeta[],
): { jumlahSesi: number; jumlahJadwal: number; jumlahFoto: number } {
  const sesiIds = new Set(sesi.filter((s) => s.pasienId === pasienId).map((s) => s.id));
  return {
    jumlahSesi: sesiIds.size,
    jumlahJadwal: jadwal.filter((j) => j.pasienId === pasienId).length,
    jumlahFoto: foto ? foto.filter((f) => sesiIds.has(f.sesiId)).length : 0,
  };
}
