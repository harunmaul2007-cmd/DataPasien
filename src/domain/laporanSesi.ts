// Model data Laporan Sesi dan fungsi pembantu penamaan file (Requirement 5, 6, 8, 10, 13).

import { atauStrip, formatJenisKelamin, formatRupiah, formatTanggal, formatUmur } from './format';
import { pad2 } from './tanggal';
import type {
  FotoMeta,
  ISODate,
  LaporanBagian,
  LaporanBaris,
  LaporanModel,
  OpsiLaporan,
  Pasien,
  PengaturanLaporan,
  SesiTerapi,
} from './types';

/**
 * Buat slug dari nama pasien:
 * - Huruf kecil
 * - Rangkaian karakter selain a-z dan 0-9 diganti satu tanda "-"
 * - Tanpa tanda "-" di awal dan di akhir
 * - Maksimal 40 karakter (tidak berakhir dengan "-")
 * - Jika kosong, gunakan "pasien"
 */
export function slugNama(nama: string): string {
  let s = nama
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (s.length > 40) {
    s = s.slice(0, 40).replace(/-+$/, '');
  }

  return s.length > 0 ? s : 'pasien';
}

/**
 * Nama file Laporan: "laporan-terapi-{slug}-YYYYMMDD.pdf".
 * YYYYMMDD diambil dari tanggal sesi terapi.
 */
export function namaFileLaporan(nama: string, tanggal: ISODate): string {
  const yyyymmdd = tanggal.replace(/-/g, '');
  return `laporan-terapi-${slugNama(nama)}-${yyyymmdd}.pdf`;
}

/**
 * Menghasilkan nama file unik bila nama dasar sudah ada dalam himpunan nama terpakai:
 * "{stem}-N.pdf" dengan N terkecil mulai dari 2.
 */
export function namaFileUnik(dasar: string, terpakai: ReadonlySet<string>): string {
  if (!terpakai.has(dasar)) return dasar;

  const stem = dasar.endsWith('.pdf') ? dasar.slice(0, -4) : dasar;
  let n = 2;
  while (terpakai.has(`${stem}-${n}.pdf`)) {
    n++;
  }
  return `${stem}-${n}.pdf`;
}

/**
 * Nilai opsi bawaan dialog pilihan laporan:
 * - Biaya selalu false (tidak dipilih)
 * - Foto default true bila jumlah foto > 0
 * - Pilihan foto disembunyikan bila jumlah foto = 0
 */
export function opsiAwal(jumlahFoto: number): {
  opsi: OpsiLaporan;
  tampilkanOpsiFoto: boolean;
} {
  const adaFoto = jumlahFoto > 0;
  return {
    opsi: {
      sertakanBiaya: false,
      sertakanFoto: adaFoto,
    },
    tampilkanOpsiFoto: adaFoto,
  };
}

function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Memotret data pasien, sesi terapi, foto, dan pengaturan menjadi model laporan.
 */
export function buildLaporanModel(
  p: Pasien,
  s: SesiTerapi,
  foto: FotoMeta[],
  peng: PengaturanLaporan | null,
  opsi: OpsiLaporan,
  now: Date = new Date(),
): LaporanModel {
  const adaPengaturanNama = peng !== null && peng.namaPraktik.trim().length > 0;
  const kop = adaPengaturanNama
    ? {
        namaPraktik: peng.namaPraktik.trim(),
        alamat: peng.alamatPraktik.trim().length > 0 ? peng.alamatPraktik.trim() : null,
        noHp: peng.noHpPraktik.trim().length > 0 ? peng.noHpPraktik.trim() : null,
        adaLogo: peng.logo !== null,
      }
    : {
        namaPraktik: 'Data Pasien',
        alamat: null,
        noHp: null,
        adaLogo: false,
      };

  const barisPasien: LaporanBaris[] = [
    { label: 'Nama', nilai: p.nama },
    { label: 'Umur', nilai: formatUmur(p.umur) },
    { label: 'Jenis Kelamin', nilai: formatJenisKelamin(p.jenisKelamin) },
    { label: 'Alamat', nilai: atauStrip(p.alamat) },
    { label: 'Nomor HP', nilai: p.noHp },
  ];

  const barisSesi: LaporanBaris[] = [
    { label: 'Tanggal terapi', nilai: formatTanggal(s.tanggal) },
    { label: 'Keluhan', nilai: s.keluhan },
    { label: 'Diagnosa', nilai: atauStrip(s.polaPenyakit) },
    { label: 'Terapi yang diberikan', nilai: s.terapi },
    { label: 'Hasil terapi', nilai: atauStrip(s.hasil) },
  ];

  if (opsi.sertakanBiaya) {
    barisSesi.push({ label: 'Biaya', nilai: formatRupiah(s.biaya) });
  }

  const bagian: LaporanBagian[] = [
    { judul: 'Data Pasien', baris: barisPasien },
    { judul: 'Sesi Terapi', baris: barisSesi },
  ];

  const sortedFoto = [...foto].sort((a, b) => a.urutan - b.urutan);
  const fotoDipakai = opsi.sertakanFoto && sortedFoto.length > 0 ? sortedFoto : null;

  return {
    kop,
    judul: 'Laporan Hasil Terapi',
    bagian,
    foto: fotoDipakai,
    tanggalDibuat: formatTanggal(toLocalISODate(now)),
    namaFile: namaFileLaporan(p.nama, s.tanggal),
    judulBagikan: `Laporan Hasil Terapi - ${p.nama}`,
  };
}
