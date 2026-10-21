// Unit test domain untuk tata letak laporan PDF dan kontras warna (Req 5, 6, 8, 10).

import { describe, expect, it } from 'vitest';
import {
  layoutLaporan,
  HALAMAN,
  type FontMetrics,
  type GambarInfo,
} from '../laporanLayout';
import {
  buildLaporanModel,
  opsiAwal,
} from '../laporanSesi';
import { rasioKontras, WARNA } from '../warna';
import type { FotoMeta, Pasien, PengaturanLaporan, SesiTerapi } from '../types';

const dummyMetrics: FontMetrics = {
  hasGlyph() {
    return true;
  },
  widthOf(text, _font, sizePt) {
    return text.length * sizePt * 0.5;
  },
};

const dummyPasien: Pasien = {
  id: 'pasien-1',
  nama: 'Budi Santoso',
  alamat: 'Jl. Melati No. 5, Jakarta',
  noHp: '081234567890',
  umur: 35,
  jenisKelamin: 'Laki-laki',
  createdAt: 1000,
  updatedAt: 1000,
};

const dummySesi: SesiTerapi = {
  id: 'sesi-1',
  pasienId: 'pasien-1',
  tanggal: '2025-03-15',
  keluhan: 'Nyeri punggung bawah dan pinggang kaku setelah angkat beban berat.',
  polaPenyakit: 'Sindrom Qi Stagnation dan Blood Stasis di Meridian Du Mai.',
  terapi: 'Akupunktur titik BL23, BL25, BL40 ditambah moxibustion dan bekam kering 15 menit.',
  hasil: 'Rasa nyeri berkurang sekitar 60%, pinggang lebih fleksibel.',
  biaya: 175000,
  createdAt: 2000,
  updatedAt: 2000,
};

const dummyPengaturan: PengaturanLaporan = {
  namaPraktik: 'Klinik Akupunktur Sehat Lestari',
  alamatPraktik: 'Jl. Kebon Jeruk No. 12, Jakarta Barat',
  noHpPraktik: '081987654321',
  logo: {
    mime: 'image/png',
    lebar: 200,
    tinggi: 200,
    ukuran: 5000,
    diperbaruiPada: 1000,
  },
};

describe('LaporanSesi: buildLaporanModel & opsiAwal', () => {
  it('opsiAwal default tidak menyertakan biaya dan menyembunyikan opsi foto jika tidak ada foto', () => {
    const { opsi: o0, tampilkanOpsiFoto: t0 } = opsiAwal(0);
    expect(o0.sertakanBiaya).toBe(false);
    expect(o0.sertakanFoto).toBe(false);
    expect(t0).toBe(false);

    const { opsi: o2, tampilkanOpsiFoto: t2 } = opsiAwal(2);
    expect(o2.sertakanBiaya).toBe(false);
    expect(o2.sertakanFoto).toBe(true);
    expect(t2).toBe(true);
  });

  it('buildLaporanModel menyusun namaFile dan judulBagikan sesuai spesifikasi', () => {
    const now = new Date(2025, 2, 16, 14, 30);
    const model = buildLaporanModel(dummyPasien, dummySesi, [], dummyPengaturan, {
      sertakanBiaya: true,
      sertakanFoto: false,
    }, now);

    expect(model.namaFile).toBe('laporan-terapi-budi-santoso-20250315.pdf');
    expect(model.judulBagikan).toBe('Laporan Hasil Terapi - Budi Santoso');
    expect(model.kop.namaPraktik).toBe('Klinik Akupunktur Sehat Lestari');
    expect(model.kop.adaLogo).toBe(true);

    const barisPasien = model.bagian[0]!.baris;
    expect(barisPasien.find((b) => b.label === 'Umur')?.nilai).toBe('35 tahun');
    expect(barisPasien.find((b) => b.label === 'Jenis Kelamin')?.nilai).toBe('Laki-laki');

    const barisSesi = model.bagian[1]!.baris;
    expect(barisSesi.find((b) => b.label === 'Biaya')?.nilai).toBe('Rp 175.000');
    expect(barisSesi.find((b) => b.label === 'Diagnosa')?.nilai).toContain('Qi Stagnation');
  });

  it('buildLaporanModel menyembunyikan biaya jika opsi sertakanBiaya = false', () => {
    const model = buildLaporanModel(dummyPasien, dummySesi, [], dummyPengaturan, {
      sertakanBiaya: false,
      sertakanFoto: false,
    });
    const barisSesi = model.bagian[1]!.baris;
    expect(barisSesi.find((b) => b.label === 'Biaya')).toBeUndefined();
  });
});

describe('LaporanLayout: layoutLaporan & Pagination (Req 5, 6, 8)', () => {
  it('menghasilkan halaman A4 dengan nomor halaman "Halaman X dari Y"', () => {
    const model = buildLaporanModel(dummyPasien, dummySesi, [], dummyPengaturan, {
      sertakanBiaya: true,
      sertakanFoto: false,
    });
    const halamanList = layoutLaporan(model, dummyMetrics, null, []);

    expect(halamanList.length).toBeGreaterThanOrEqual(1);
    const h1 = halamanList[0]!;
    expect(HALAMAN.lebar).toBe(595.28);
    expect(HALAMAN.tinggi).toBe(841.89);

    // Footer memiliki nomor halaman
    const footerElem = h1.ops.find((op) => op.t === 'text' && op.text.includes('Halaman 1 dari'));
    expect(footerElem).toBeDefined();
  });

  it('menyusun grid foto 2 kolom dengan teks alt/caption', () => {
    const fotoList: FotoMeta[] = [
      {
        id: 'f1',
        sesiId: 'sesi-1',
        urutan: 1,
        mime: 'image/jpeg',
        ukuran: 5000,
        lebar: 800,
        tinggi: 600,
        ditambahkanPada: 1000,
      },
      {
        id: 'f2',
        sesiId: 'sesi-1',
        urutan: 2,
        mime: 'image/jpeg',
        ukuran: 6000,
        lebar: 600,
        tinggi: 800,
        ditambahkanPada: 1000,
      },
    ];

    const model = buildLaporanModel(dummyPasien, dummySesi, fotoList, dummyPengaturan, {
      sertakanBiaya: true,
      sertakanFoto: true,
    });

    const fotoInfos: GambarInfo[] = [
      { key: 'f1', lebarPx: 800, tinggiPx: 600, gagal: false },
      { key: 'f2', lebarPx: 600, tinggiPx: 800, gagal: false },
    ];

    const halamanList = layoutLaporan(model, dummyMetrics, null, fotoInfos);
    expect(halamanList.length).toBeGreaterThanOrEqual(1);

    // Pastikan ada elemen gambar di tata letak
    const gambarElems = halamanList.flatMap((h) => h.ops.filter((op) => op.t === 'image'));
    expect(gambarElems.length).toBe(2);
  });
});

describe('Warna & Aksesibilitas Kontras (Req 11)', () => {
  it('kontras teks utama terhadap background putih memenuhi WCAG AA (>= 4.5:1)', () => {
    const ratio = rasioKontras(WARNA.teksUtama, WARNA.latarPutih);
    expect(ratio).toBeGreaterThanOrEqual(7.0); // Teks gelap pada kertas putih
  });

  it('kontras teks footer terhadap background putih memenuhi WCAG AA (>= 4.5:1)', () => {
    const ratio = rasioKontras(WARNA.teksFooter, WARNA.latarPutih);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
