// Mesin tata letak Laporan Sesi PDF (fungsi murni, Requirement 5, 6, 8, 10).

import type { LaporanModel } from './types';
import { WARNA, type Rgb } from './warna';

export interface FontMetrics {
  widthOf(text: string, font: 'regular' | 'bold', sizePt: number): number;
  hasGlyph(codePoint: number, font: 'regular' | 'bold'): boolean;
}

export interface GambarInfo {
  key: string;
  lebarPx: number;
  tinggiPx: number;
  gagal: boolean;
}

export type Op =
  | { t: 'text'; x: number; y: number; text: string; font: 'regular' | 'bold'; size: number; color: Rgb }
  | { t: 'rect'; x: number; y: number; w: number; h: number; color: Rgb }
  | { t: 'image'; key: string; x: number; y: number; w: number; h: number }
  | { t: 'placeholder'; x: number; y: number; w: number; h: number; text: 'Foto tidak dapat dimuat' };

export interface Halaman {
  ops: Op[];
}

// ---------------------------------------------------------------------------
// Ukuran & Margin (A4 tegak, satuan pt)
// 1 mm = 2.8346 pt
// ---------------------------------------------------------------------------

export const HALAMAN = {
  lebar: 595.28,
  tinggi: 841.89,
  margin: 51.02, // 18 mm
} as const;

export const UKURAN_HURUF = {
  namaPraktik: 18,
  judulLaporan: 15,
  judulBagian: 13,
  labelNilai: 10.5,
  footer: 8.5,
} as const;

export const TATA_LETAK = {
  kolomLabelLebar: 120,
  kolomNilaiOffset: 128, // margin + 128
  jarakFotoMm: 17.01, // 6 mm
  areaFooterTinggi: 20,
} as const;

/**
 * Ganti code point yang tidak didukung oleh font dengan "?".
 * Surrogate pair diperlakukan sebagai satu code point.
 */
export function gantiGlyphTakDidukung(
  text: string,
  font: 'regular' | 'bold',
  m: FontMetrics,
): string {
  let res = '';
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp !== undefined && m.hasGlyph(cp, font)) {
      res += char;
    } else {
      res += '?';
    }
  }
  return res;
}

/**
 * Bungkus teks ke dalam baris-baris berukuran <= lebarMaks:
 * - Dibagi per \n
 * - Tiap paragraf dibungkus per kata pada spasi
 * - Kata yang melebihi lebarMaks dipecah per code point
 */
export function bungkusTeks(
  text: string,
  lebarMaks: number,
  font: 'regular' | 'bold',
  size: number,
  m: FontMetrics,
): string[] {
  const safeText = gantiGlyphTakDidukung(text, font, m);
  const paragrafList = safeText.split('\n');
  const barisHasil: string[] = [];

  for (const paragraf of paragrafList) {
    if (paragraf.trim() === '') {
      barisHasil.push('');
      continue;
    }

    const kataList = paragraf.split(' ');
    let barisSaatIni = '';

    for (const kata of kataList) {
      if (barisSaatIni === '') {
        const lebarKata = m.widthOf(kata, font, size);
        if (lebarKata <= lebarMaks) {
          barisSaatIni = kata;
        } else {
          // Kata lebih panjang dari lebarMaks, pecah per karakter
          let bagian = '';
          for (const c of kata) {
            const uji = bagian + c;
            if (m.widthOf(uji, font, size) <= lebarMaks) {
              bagian = uji;
            } else {
              if (bagian !== '') barisHasil.push(bagian);
              bagian = c;
            }
          }
          barisSaatIni = bagian;
        }
      } else {
        const uji = `${barisSaatIni} ${kata}`;
        if (m.widthOf(uji, font, size) <= lebarMaks) {
          barisSaatIni = uji;
        } else {
          barisHasil.push(barisSaatIni);
          const lebarKata = m.widthOf(kata, font, size);
          if (lebarKata <= lebarMaks) {
            barisSaatIni = kata;
          } else {
            let bagian = '';
            for (const c of kata) {
              const ujiChar = bagian + c;
              if (m.widthOf(ujiChar, font, size) <= lebarMaks) {
                bagian = ujiChar;
              } else {
                if (bagian !== '') barisHasil.push(bagian);
                bagian = c;
              }
            }
            barisSaatIni = bagian;
          }
        }
      }
    }

    if (barisSaatIni !== '') {
      barisHasil.push(barisSaatIni);
    }
  }

  return barisHasil;
}

/**
 * Mesin penyusunan tata letak Laporan Sesi.
 * Koordinat: x dari kiri, y dari bawah (sistem koordinat Cartesian PDF).
 */
export function layoutLaporan(
  model: LaporanModel,
  m: FontMetrics,
  logo: GambarInfo | null,
  foto: GambarInfo[],
): Halaman[] {
  const margin = HALAMAN.margin;
  const lebarHalaman = HALAMAN.lebar;
  const tinggiHalaman = HALAMAN.tinggi;
  const lebarIsi = lebarHalaman - 2 * margin;
  const batasBawahIsi = margin + TATA_LETAK.areaFooterTinggi; // y minimal sebelum halaman baru

  const halamanList: Halaman[] = [];
  let opsSaatIni: Op[] = [];
  let yKursor = tinggiHalaman - margin; // mulai dari atas

  function bukaHalamanBaru(): void {
    if (opsSaatIni.length > 0) {
      halamanList.push({ ops: opsSaatIni });
      opsSaatIni = [];
    }
    yKursor = tinggiHalaman - margin;
  }

  // 1. KOP LAPORAN (Hanya di Halaman 1)
  let lebarLogoPt = 0;
  let tinggiLogoPt = 0;
  const adaLogoValid = logo !== null && !logo.gagal && logo.lebarPx > 0 && logo.tinggiPx > 0;

  if (adaLogoValid) {
    const maksLebarLogo = 60 * 2.8346; // 60 mm
    const maksTinggiLogo = 25 * 2.8346; // 25 mm
    const rasioLogo = logo.lebarPx / logo.tinggiPx;

    lebarLogoPt = maksLebarLogo;
    tinggiLogoPt = lebarLogoPt / rasioLogo;
    if (tinggiLogoPt > maksTinggiLogo) {
      tinggiLogoPt = maksTinggiLogo;
      lebarLogoPt = tinggiLogoPt * rasioLogo;
    }
  }

  const xTeksKop = adaLogoValid ? margin + lebarLogoPt + 11.34 : margin; // 11.34 pt = 4 mm
  const lebarTeksKop = lebarHalaman - margin - xTeksKop;

  // Nama Praktik
  const barisNamaPraktik = bungkusTeks(
    model.kop.namaPraktik,
    lebarTeksKop,
    'bold',
    UKURAN_HURUF.namaPraktik,
    m,
  );
  // Alamat Praktik
  const barisAlamatPraktik = model.kop.alamat
    ? bungkusTeks(model.kop.alamat, lebarTeksKop, 'regular', UKURAN_HURUF.labelNilai, m)
    : [];
  // No HP Praktik
  const barisNoHpPraktik = model.kop.noHp
    ? bungkusTeks(model.kop.noHp, lebarTeksKop, 'regular', UKURAN_HURUF.labelNilai, m)
    : [];

  const lhNama = UKURAN_HURUF.namaPraktik * 1.3;
  const lhKop = UKURAN_HURUF.labelNilai * 1.35;
  const totalTinggiTeksKop =
    barisNamaPraktik.length * lhNama +
    barisAlamatPraktik.length * lhKop +
    barisNoHpPraktik.length * lhKop;

  const tinggiKop = Math.max(tinggiLogoPt, totalTinggiTeksKop);
  const yAtasKop = yKursor;

  if (adaLogoValid) {
    opsSaatIni.push({
      t: 'image',
      key: logo.key,
      x: margin,
      y: yAtasKop - tinggiLogoPt,
      w: lebarLogoPt,
      h: tinggiLogoPt,
    });
  }

  let yTeksKopKursor = yAtasKop - UKURAN_HURUF.namaPraktik;
  for (const b of barisNamaPraktik) {
    opsSaatIni.push({
      t: 'text',
      x: xTeksKop,
      y: yTeksKopKursor,
      text: b,
      font: 'bold',
      size: UKURAN_HURUF.namaPraktik,
      color: WARNA.teksUtama,
    });
    yTeksKopKursor -= lhNama;
  }

  for (const b of barisAlamatPraktik) {
    opsSaatIni.push({
      t: 'text',
      x: xTeksKop,
      y: yTeksKopKursor,
      text: b,
      font: 'regular',
      size: UKURAN_HURUF.labelNilai,
      color: WARNA.teksUtama,
    });
    yTeksKopKursor -= lhKop;
  }

  for (const b of barisNoHpPraktik) {
    opsSaatIni.push({
      t: 'text',
      x: xTeksKop,
      y: yTeksKopKursor,
      text: b,
      font: 'regular',
      size: UKURAN_HURUF.labelNilai,
      color: WARNA.teksUtama,
    });
    yTeksKopKursor -= lhKop;
  }

  // Garis aksen kop
  const yGarisKop = yAtasKop - tinggiKop - 10;
  opsSaatIni.push({
    t: 'rect',
    x: margin,
    y: yGarisKop,
    w: lebarIsi,
    h: 2,
    color: WARNA.garisAksen,
  });

  yKursor = yGarisKop - 20;

  // 2. JUDUL LAPORAN
  const barisJudul = bungkusTeks(
    model.judul,
    lebarIsi,
    'bold',
    UKURAN_HURUF.judulLaporan,
    m,
  );
  for (const b of barisJudul) {
    opsSaatIni.push({
      t: 'text',
      x: margin,
      y: yKursor - UKURAN_HURUF.judulLaporan,
      text: b,
      font: 'bold',
      size: UKURAN_HURUF.judulLaporan,
      color: WARNA.teksUtama,
    });
    yKursor -= UKURAN_HURUF.judulLaporan * 1.4;
  }
  yKursor -= 10;

  // 3. BAGIAN DATA PASIEN & SESI TERAPI
  const xKolomLabel = margin;
  const xKolomNilai = margin + TATA_LETAK.kolomNilaiOffset;
  const lebarKolomNilai = lebarHalaman - margin - xKolomNilai;
  const lhIsi = UKURAN_HURUF.labelNilai * 1.4;

  for (const bagian of model.bagian) {
    // Header Bagian
    const tinggiHeaderBagian = 22;
    if (yKursor - tinggiHeaderBagian - lhIsi < batasBawahIsi) {
      bukaHalamanBaru();
    }

    // Blok latar aksen muda
    opsSaatIni.push({
      t: 'rect',
      x: margin,
      y: yKursor - tinggiHeaderBagian,
      w: lebarIsi,
      h: tinggiHeaderBagian,
      color: WARNA.latarAksenMuda,
    });

    opsSaatIni.push({
      t: 'text',
      x: margin + 8,
      y: yKursor - tinggiHeaderBagian + 6,
      text: bagian.judul,
      font: 'bold',
      size: UKURAN_HURUF.judulBagian,
      color: WARNA.judulBagian,
    });

    yKursor -= tinggiHeaderBagian + 8;

    // Baris-baris data dalam bagian
    for (const b of bagian.baris) {
      const barisNilai = bungkusTeks(
        b.nilai,
        lebarKolomNilai,
        'regular',
        UKURAN_HURUF.labelNilai,
        m,
      );
      const totalTinggiItem = Math.max(1, barisNilai.length) * lhIsi + 4;

      if (yKursor - totalTinggiItem < batasBawahIsi) {
        bukaHalamanBaru();
      }

      // Label (rata kiri)
      opsSaatIni.push({
        t: 'text',
        x: xKolomLabel,
        y: yKursor - UKURAN_HURUF.labelNilai,
        text: b.label,
        font: 'bold',
        size: UKURAN_HURUF.labelNilai,
        color: WARNA.teksUtama,
      });

      // Nilai
      let yNilaiKursor = yKursor - UKURAN_HURUF.labelNilai;
      for (const bn of barisNilai) {
        opsSaatIni.push({
          t: 'text',
          x: xKolomNilai,
          y: yNilaiKursor,
          text: bn,
          font: 'regular',
          size: UKURAN_HURUF.labelNilai,
          color: WARNA.teksUtama,
        });
        yNilaiKursor -= lhIsi;
      }

      yKursor -= totalTinggiItem;
    }

    yKursor -= 10; // Jarak antar bagian
  }

  // 4. BAGIAN DOKUMENTASI FOTO (Jika disertakan)
  if (model.foto && model.foto.length > 0) {
    const fotoInfoMap = new Map<string, GambarInfo>();
    for (const fi of foto) {
      fotoInfoMap.set(fi.key, fi);
    }

    const lebarKolomFoto = (lebarIsi - TATA_LETAK.jarakFotoMm) / 2;
    const tinggiMaksFoto = (tinggiHalaman - 2 * margin - TATA_LETAK.areaFooterTinggi) / 2;

    // Kelompokkan foto dalam baris-baris berpasangan (maks 2 per baris)
    const barisFotoList: Array<[GambarInfo, GambarInfo | null]> = [];
    for (let i = 0; i < model.foto.length; i += 2) {
      const meta1 = model.foto[i];
      if (!meta1) continue;
      const f1 = fotoInfoMap.get(meta1.id) ?? {
        key: meta1.id,
        lebarPx: meta1.lebar,
        tinggiPx: meta1.tinggi,
        gagal: false,
      };
      const meta2 = i + 1 < model.foto.length ? model.foto[i + 1] : undefined;
      const f2 = meta2
        ? (fotoInfoMap.get(meta2.id) ?? {
            key: meta2.id,
            lebarPx: meta2.lebar,
            tinggiPx: meta2.tinggi,
            gagal: false,
          })
        : null;
      barisFotoList.push([f1, f2]);
    }

    // Fungsi bantu ukuran render foto
    function ukuranRenderFoto(fi: GambarInfo): { w: number; h: number } {
      if (fi.gagal || fi.lebarPx <= 0 || fi.tinggiPx <= 0) {
        return { w: lebarKolomFoto, h: 140 };
      }
      const wPt = fi.lebarPx * 0.75;
      const rasio = fi.lebarPx / fi.tinggiPx;

      let wTarget = Math.min(wPt, lebarKolomFoto);
      let hTarget = wTarget / rasio;
      if (hTarget > tinggiMaksFoto) {
        hTarget = tinggiMaksFoto;
        wTarget = hTarget * rasio;
      }
      return { w: wTarget, h: hTarget };
    }

    const tinggiHeaderFoto = 22;
    const pertamaBaris = barisFotoList[0];
    if (pertamaBaris) {
      const sz1 = ukuranRenderFoto(pertamaBaris[0]);
      const sz2 = pertamaBaris[1] ? ukuranRenderFoto(pertamaBaris[1]) : { w: 0, h: 0 };
      const tinggiBarisPertama = Math.max(sz1.h, sz2.h) + 10;

      // Pastikan judul Dokumentasi Foto tidak sendirian di akhir halaman
      if (yKursor - tinggiHeaderFoto - tinggiBarisPertama < batasBawahIsi) {
        bukaHalamanBaru();
      }
    }

    // Header Dokumentasi Foto
    opsSaatIni.push({
      t: 'rect',
      x: margin,
      y: yKursor - tinggiHeaderFoto,
      w: lebarIsi,
      h: tinggiHeaderFoto,
      color: WARNA.latarAksenMuda,
    });

    opsSaatIni.push({
      t: 'text',
      x: margin + 8,
      y: yKursor - tinggiHeaderFoto + 6,
      text: 'Dokumentasi Foto',
      font: 'bold',
      size: UKURAN_HURUF.judulBagian,
      color: WARNA.judulBagian,
    });

    yKursor -= tinggiHeaderFoto + 12;

    // Render baris demi baris foto
    for (const [fLeft, fRight] of barisFotoList) {
      const uLeft = ukuranRenderFoto(fLeft);
      const uRight = fRight ? ukuranRenderFoto(fRight) : { w: 0, h: 0 };
      const tinggiBaris = Math.max(uLeft.h, uRight.h) + 12;

      if (yKursor - tinggiBaris < batasBawahIsi) {
        bukaHalamanBaru();
      }

      // Foto Kiri
      const xLeft = margin;
      const yLeft = yKursor - uLeft.h;
      if (fLeft.gagal) {
        opsSaatIni.push({
          t: 'placeholder',
          x: xLeft,
          y: yLeft,
          w: uLeft.w,
          h: uLeft.h,
          text: 'Foto tidak dapat dimuat',
        });
      } else {
        opsSaatIni.push({
          t: 'image',
          key: fLeft.key,
          x: xLeft,
          y: yLeft,
          w: uLeft.w,
          h: uLeft.h,
        });
      }

      // Foto Kanan (bila ada)
      if (fRight) {
        const xRight = margin + lebarKolomFoto + TATA_LETAK.jarakFotoMm;
        const yRight = yKursor - uRight.h;
        if (fRight.gagal) {
          opsSaatIni.push({
            t: 'placeholder',
            x: xRight,
            y: yRight,
            w: uRight.w,
            h: uRight.h,
            text: 'Foto tidak dapat dimuat',
          });
        } else {
          opsSaatIni.push({
            t: 'image',
            key: fRight.key,
            x: xRight,
            y: yRight,
            w: uRight.w,
            h: uRight.h,
          });
        }
      }

      yKursor -= tinggiBaris;
    }
  }

  if (opsSaatIni.length > 0) {
    halamanList.push({ ops: opsSaatIni });
  }

  // 5. FOOTER (Ditambahkan ke setiap halaman: "Dibuat {tgl}" & "Halaman N dari Total")
  const totalHalaman = halamanList.length;
  for (let idx = 0; idx < totalHalaman; idx++) {
    const hal = halamanList[idx];
    if (!hal) continue;
    const nomorHal = idx + 1;
    const teksKiri = `Dibuat ${model.tanggalDibuat}`;
    const teksKanan = `Halaman ${nomorHal} dari ${totalHalaman}`;
    const yFooter = margin;

    hal.ops.push({
      t: 'text',
      x: margin,
      y: yFooter,
      text: teksKiri,
      font: 'regular',
      size: UKURAN_HURUF.footer,
      color: WARNA.teksFooter,
    });

    const lebarTeksKanan = m.widthOf(teksKanan, 'regular', UKURAN_HURUF.footer);
    hal.ops.push({
      t: 'text',
      x: lebarHalaman - margin - lebarTeksKanan,
      y: yFooter,
      text: teksKanan,
      font: 'regular',
      size: UKURAN_HURUF.footer,
      color: WARNA.teksFooter,
    });
  }

  return halamanList;
}
