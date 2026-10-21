// Unit test domain untuk fitur-fitur baru:
// - Validator (umur, jenisKelamin, pengaturan)
// - Format (formatUmur, formatJenisKelamin)
// - Foto (deteksiFormatMagic, hitungDimensiTarget, fotoDraftReducer)
// - WhatsApp (tautanWhatsApp)
// - Kontak (normalisasiNomorHp, terapkanKontak)

import { describe, expect, it } from 'vitest';
import {
  formatJenisKelamin,
  formatUmur,
} from '../format';
import {
  deteksiFormatMagic,
  fotoDraftReducer,
  ukuranTarget,
  PROFIL_FOTO,
  type FotoDraft,
} from '../foto';
import { normalisasiNomor, terapkanKontak } from '../kontak';
import { tautanWhatsApp } from '../whatsapp';
import {
  validatePasien,
  validatePengaturan,
  PESAN,
} from '../validator';

describe('Validator: umur dan jenisKelamin pasien (Req 14)', () => {
  const baseInput = { nama: 'Budi', alamat: 'Jl. Mawar', noHp: '081234567890' };

  it('menerima umur kosong atau whitespace dan dinormalisasi menjadi null', () => {
    const res1 = validatePasien({ ...baseInput, umur: '' });
    expect(res1.ok).toBe(true);
    if (res1.ok) expect(res1.value.umur).toBeNull();

    const res2 = validatePasien({ ...baseInput, umur: '   ' });
    expect(res2.ok).toBe(true);
    if (res2.ok) expect(res2.value.umur).toBeNull();
  });

  it('menerima umur valid 0–150 dan dinormalisasi menjadi number', () => {
    const res0 = validatePasien({ ...baseInput, umur: '0' });
    expect(res0.ok).toBe(true);
    if (res0.ok) expect(res0.value.umur).toBe(0);

    const res42 = validatePasien({ ...baseInput, umur: ' 42 ' });
    expect(res42.ok).toBe(true);
    if (res42.ok) expect(res42.value.umur).toBe(42);

    const res150 = validatePasien({ ...baseInput, umur: '150' });
    expect(res150.ok).toBe(true);
    if (res150.ok) expect(res150.value.umur).toBe(150);
  });

  it('menolak umur negatif, desimal, >150, atau non-angka', () => {
    const resNeg = validatePasien({ ...baseInput, umur: '-5' });
    expect(resNeg.ok).toBe(false);
    if (!resNeg.ok) expect(resNeg.errors.umur).toBe(PESAN.umurTidakValid);

    const resDes = validatePasien({ ...baseInput, umur: '25.5' });
    expect(resDes.ok).toBe(false);
    if (!resDes.ok) expect(resDes.errors.umur).toBe(PESAN.umurTidakValid);

    const resOver = validatePasien({ ...baseInput, umur: '151' });
    expect(resOver.ok).toBe(false);
    if (!resOver.ok) expect(resOver.errors.umur).toBe(PESAN.umurTidakValid);

    const resHuruf = validatePasien({ ...baseInput, umur: 'duapuluh' });
    expect(resHuruf.ok).toBe(false);
    if (!resHuruf.ok) expect(resHuruf.errors.umur).toBe(PESAN.umurTidakValid);
  });

  it('menerima jenis kelamin kosong atau null dan dinormalisasi menjadi null', () => {
    const res1 = validatePasien({ ...baseInput, jenisKelamin: '' });
    expect(res1.ok).toBe(true);
    if (res1.ok) expect(res1.value.jenisKelamin).toBeNull();

    const res2 = validatePasien({ ...baseInput, jenisKelamin: null });
    expect(res2.ok).toBe(true);
    if (res2.ok) expect(res2.value.jenisKelamin).toBeNull();
  });

  it('menerima jenis kelamin Laki-laki atau Wanita', () => {
    const resL = validatePasien({ ...baseInput, jenisKelamin: 'Laki-laki' });
    expect(resL.ok).toBe(true);
    if (resL.ok) expect(resL.value.jenisKelamin).toBe('Laki-laki');

    const resW = validatePasien({ ...baseInput, jenisKelamin: 'Wanita' });
    expect(resW.ok).toBe(true);
    if (resW.ok) expect(resW.value.jenisKelamin).toBe('Wanita');
  });

  it('menolak jenis kelamin di luar pilihan yang valid', () => {
    const res = validatePasien({ ...baseInput, jenisKelamin: 'Pria' as any });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.jenisKelamin).toBe(PESAN.jenisKelaminTidakValid);
  });
});

describe('Validator: Pengaturan Praktik (Req 10)', () => {
  it('menerima nama praktik valid dengan alamat dan noHp opsional', () => {
    const res = validatePengaturan({
      namaPraktik: '  Klinik Sehat Terapi  ',
      alamatPraktik: '  Jl. Merdeka 10  ',
      noHpPraktik: '  081234567890  ',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual({
        namaPraktik: 'Klinik Sehat Terapi',
        alamatPraktik: 'Jl. Merdeka 10',
        noHpPraktik: '081234567890',
      });
    }
  });

  it('menolak nama praktik kosong atau melebihi 100 karakter', () => {
    const res1 = validatePengaturan({ namaPraktik: '   ', alamatPraktik: '', noHpPraktik: '' });
    expect(res1.ok).toBe(false);
    if (!res1.ok) expect(res1.errors.namaPraktik).toBe(PESAN.namaPraktikWajib);

    const res2 = validatePengaturan({ namaPraktik: 'a'.repeat(101), alamatPraktik: '', noHpPraktik: '' });
    expect(res2.ok).toBe(false);
    if (!res2.ok) expect(res2.errors.namaPraktik).toBe(PESAN.namaPraktikMaks);
  });

  it('menolak noHp praktik yang tidak valid bila diisi', () => {
    const res = validatePengaturan({
      namaPraktik: 'Klinik Sehat',
      alamatPraktik: '',
      noHpPraktik: '12345',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.noHpPraktik).toBe(PESAN.noHpPraktikTidakValid);
  });
});

describe('Format: formatUmur & formatJenisKelamin', () => {
  it('formatUmur mengembalikan string tahun atau strip', () => {
    expect(formatUmur(null)).toBe('-');
    expect(formatUmur(undefined)).toBe('-');
    expect(formatUmur(0)).toBe('0 tahun');
    expect(formatUmur(28)).toBe('28 tahun');
  });

  it('formatJenisKelamin mengembalikan nilai atau strip', () => {
    expect(formatJenisKelamin(null)).toBe('-');
    expect(formatJenisKelamin(undefined)).toBe('-');
    expect(formatJenisKelamin('Laki-laki')).toBe('Laki-laki');
    expect(formatJenisKelamin('Wanita')).toBe('Wanita');
  });
});

describe('Foto: Deteksi Magic Bytes & Resizing (Req 2)', () => {
  it('mendeteksi JPEG dari header FFD8FF', () => {
    const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).buffer;
    expect(deteksiFormatMagic(buf)).toBe('jpeg');
  });

  it('mendeteksi PNG dari header 89504E47', () => {
    const buf = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    expect(deteksiFormatMagic(buf)).toBe('png');
  });

  it('mendeteksi WebP dan GIF', () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).buffer;
    expect(deteksiFormatMagic(webp)).toBe('webp');

    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]).buffer;
    expect(deteksiFormatMagic(gif)).toBe('gif');
  });

  it('mendeteksi HEIC/AVIF dari ftyp box', () => {
    const heic = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]).buffer;
    expect(deteksiFormatMagic(heic)).toBe('heic');
  });

  it('mengembalikan unknown untuk data sembarang', () => {
    const random = new Uint8Array([0x01, 0x02, 0x03, 0x04]).buffer;
    expect(deteksiFormatMagic(random)).toBe('unknown');
  });

  it('ukuranTarget tidak memperbesar jika di bawah batas', () => {
    const dim = ukuranTarget(800, 600, PROFIL_FOTO.maksDimensi);
    expect(dim).toEqual({ w: 800, h: 600 });
  });

  it('ukuranTarget mengecilkan proporsional jika melebihi batas 1600px', () => {
    const landscape = ukuranTarget(3200, 1600, PROFIL_FOTO.maksDimensi);
    expect(landscape).toEqual({ w: 1600, h: 800 });

    const portrait = ukuranTarget(1200, 2400, PROFIL_FOTO.maksDimensi);
    expect(portrait).toEqual({ w: 800, h: 1600 });
  });
});

describe('Foto: fotoDraftReducer', () => {
  const awal: FotoDraft = {
    items: [],
    memproses: false,
    pesan: [],
  };

  it('menangani aksi terima foto baru', () => {
    const next = fotoDraftReducer(awal, {
      type: 'terima',
      tempId: 'temp-1',
      foto: {
        data: new ArrayBuffer(10),
        mime: 'image/jpeg',
        ukuran: 10,
        lebar: 100,
        tinggi: 100,
      },
    });
    expect(next.items).toHaveLength(1);
    expect(next.items[0]?.jenis).toBe('baru');
  });

  it('menangani penolakan batas kuota dan format', () => {
    const nextBatas = fotoDraftReducer(awal, {
      type: 'tolak',
      namaFile: 'foto11.jpg',
      alasan: 'batas',
    });
    expect(nextBatas.pesan[0]).toContain('Maksimal 10 foto');

    const nextFormat = fotoDraftReducer(awal, {
      type: 'tolak',
      namaFile: 'file.pdf',
      alasan: 'format',
    });
    expect(nextFormat.pesan[0]).toContain('format gambar tidak didukung');
  });

  it('menangani penghapusan foto dari draft', () => {
    const denganItem: FotoDraft = {
      ...awal,
      items: [
        {
          jenis: 'baru',
          tempId: 'temp-1',
          foto: { data: new ArrayBuffer(10), mime: 'image/jpeg', ukuran: 10, lebar: 100, tinggi: 100 },
        },
      ],
    };
    const next = fotoDraftReducer(denganItem, { type: 'hapus', key: 'temp-1' });
    expect(next.items).toHaveLength(0);
  });
});

describe('WhatsApp: tautanWhatsApp (Req 12)', () => {
  it('mengonversi 08xxx menjadi https://wa.me/628xxx', () => {
    expect(tautanWhatsApp('081234567890')).toBe('https://wa.me/6281234567890');
  });

  it('mengonversi +628xxx atau 628xxx menjadi https://wa.me/628xxx', () => {
    expect(tautanWhatsApp('+6281234567890')).toBe('https://wa.me/6281234567890');
    expect(tautanWhatsApp('6281234567890')).toBe('https://wa.me/6281234567890');
  });

  it('menghapus spasi dan tanda hubung', () => {
    expect(tautanWhatsApp(' 0812-3456-7890 ')).toBe('https://wa.me/6281234567890');
  });
});

describe('Kontak: normalisasi & terapkanKontak (Req 11)', () => {
  it('normalisasi nomor HP kontak ke format tanpa spasi / tanda baca', () => {
    expect(normalisasiNomor('+62 812-3456-7890')).toBe('+6281234567890');
    expect(normalisasiNomor('0812-3456-7890')).toBe('081234567890');
  });

  it('terapkanKontak mengisi nama jika form nama masih kosong', () => {
    const res = terapkanKontak(
      { nama: '', noHp: '' },
      { nama: 'Ibu Siti' },
      '081299998888',
    );
    expect(res.nama).toBe('Ibu Siti');
    expect(res.noHp).toBe('081299998888');
  });

  it('terapkanKontak mempertahankan nama jika form nama sudah terisi', () => {
    const res = terapkanKontak(
      { nama: 'Siti Rahma', noHp: '' },
      { nama: 'Ibu Siti Kontak' },
      '081299998888',
    );
    expect(res.nama).toBe('Siti Rahma');
    expect(res.noHp).toBe('081299998888');
  });
});
