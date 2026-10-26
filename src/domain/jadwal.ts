// Logika murni Jadwal_Kunjungan: tampilan per tanggal, per pasien,
// transisi status, dan aksi yang tersedia. Tidak ada fungsi yang memutasi input.

import type { JadwalKunjungan } from './types';

/** Perbandingan string biner (kode unit), deterministik lintas lokal. */
function cmpStr(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Tie-break umum agar urutan deterministik: createdAt menaik, lalu id menaik. */
function cmpTieBreak(a: JadwalKunjungan, b: JadwalKunjungan): number {
  return a.createdAt - b.createdAt || cmpStr(a.id, b.id);
}

/**
 * Seluruh jadwal (semua status) bertanggal `tanggal`, urut jam menaik
 * (Req 8.4). Tie-break: createdAt lalu id.
 */
export function jadwalPadaTanggal(tanggal: string, jadwal: JadwalKunjungan[]): JadwalKunjungan[] {
  return jadwal
    .filter((j) => j.tanggal === tanggal)
    .sort((a, b) => cmpStr(a.jam, b.jam) || cmpTieBreak(a, b));
}

/**
 * Jadwal berstatus Terjadwal milik pasien, urut tanggal lalu jam menaik
 * (Req 8.11). Tie-break: createdAt lalu id.
 */
export function jadwalTerjadwalPasien(
  pasienId: string,
  jadwal: JadwalKunjungan[],
): JadwalKunjungan[] {
  return jadwal
    .filter((j) => j.pasienId === pasienId && j.status === 'Terjadwal')
    .sort(
      (a, b) => cmpStr(a.tanggal, b.tanggal) || cmpStr(a.jam, b.jam) || cmpTieBreak(a, b),
    );
}

/**
 * Seluruh jadwal yang ada (semua status), urut tanggal menaik lalu jam menaik.
 * Tie-break: createdAt lalu id.
 */
export function semuaJadwal(jadwal: JadwalKunjungan[]): JadwalKunjungan[] {
  return [...jadwal].sort(
    (a, b) => cmpStr(a.tanggal, b.tanggal) || cmpStr(a.jam, b.jam) || cmpTieBreak(a, b),
  );
}

/**
 * Transisi status dari Terjadwal ke Selesai/Dibatalkan (Req 8.9, 8.10).
 * Mengembalikan null jika status awal bukan Terjadwal (Req 8.14).
 *
 * Hanya `status` yang berubah. `updatedAt` diisi `now` bila diberikan;
 * jika `now` tidak diberikan, `updatedAt` dipertahankan sehingga seluruh
 * field selain `status` identik dengan input.
 */
export function transisiStatus(
  j: JadwalKunjungan,
  target: 'Selesai' | 'Dibatalkan',
  now?: number,
): JadwalKunjungan | null {
  if (j.status !== 'Terjadwal') return null;
  return { ...j, status: target, updatedAt: now ?? j.updatedAt };
}

/** Aksi yang tersedia untuk sebuah jadwal (Req 8.14). Hapus selalu tersedia. */
export function aksiTersedia(j: JadwalKunjungan): {
  ubah: boolean;
  selesai: boolean;
  batal: boolean;
  hapus: true;
} {
  const aktif = j.status === 'Terjadwal';
  return { ubah: aktif, selesai: aktif, batal: aktif, hapus: true };
}
