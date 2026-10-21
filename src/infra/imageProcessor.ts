// ImageProcessor: konversi, pengecilan, dan deteksi transparansi gambar di perangkat (Req 2, 10).

import {
  deteksiFormat,
  ukuranTarget,
  PROFIL_FOTO,
  PROFIL_LOGO,
  type FormatSumber,
} from '../domain/foto';
import type { FotoDiproses } from '../domain/types';

export type ProfilGambar = typeof PROFIL_FOTO | typeof PROFIL_LOGO;

export type HasilProses =
  | { ok: true; foto: FotoDiproses }
  | { ok: false; alasan: 'format' | 'ukuran' };

export interface ImageProcessor {
  process(file: File, profil: ProfilGambar): Promise<HasilProses>;
}

const TIMEOUT_PROSES_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout pemrosesan gambar'));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob);
      },
      mime,
      quality
    );
  });
}

function memilikiTransparansi(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const len = data.length;
    for (let i = 3; i < len; i += 4) {
      const alpha = data[i];
      if (alpha !== undefined && alpha < 255) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function gambarKeCanvas(
  bitmap: ImageBitmap,
  targetW: number,
  targetH: number,
  doc: Document = document
): HTMLCanvasElement {
  let curW = bitmap.width;
  let curH = bitmap.height;

  if (curW === targetW && curH === targetH) {
    const canvas = doc.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context tidak tersedia');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0);
    return canvas;
  }

  let currentSource: CanvasImageSource = bitmap;
  while (curW > 2 * targetW || curH > 2 * targetH) {
    const nextW = Math.max(targetW, Math.floor(curW / 2));
    const nextH = Math.max(targetH, Math.floor(curH / 2));
    const stepCanvas = doc.createElement('canvas');
    stepCanvas.width = nextW;
    stepCanvas.height = nextH;
    const stepCtx = stepCanvas.getContext('2d');
    if (!stepCtx) throw new Error('Canvas 2D context tidak tersedia');
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(currentSource, 0, 0, nextW, nextH);
    currentSource = stepCanvas;
    curW = nextW;
    curH = nextH;
  }

  const finalCanvas = doc.createElement('canvas');
  finalCanvas.width = targetW;
  finalCanvas.height = targetH;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Canvas 2D context tidak tersedia');
  finalCtx.imageSmoothingQuality = 'high';
  finalCtx.drawImage(currentSource, 0, 0, targetW, targetH);
  return finalCanvas;
}

export class DefaultImageProcessor implements ImageProcessor {
  constructor(private readonly doc: Document = document) {}

  async process(file: File, profil: ProfilGambar): Promise<HasilProses> {
    // 1. Cek ukuran file terhadap batas maksimal byte
    if (file.size > profil.maksByte) {
      return { ok: false, alasan: 'ukuran' };
    }

    try {
      return await withTimeout(this.lakukanProses(file, profil), TIMEOUT_PROSES_MS);
    } catch {
      return { ok: false, alasan: 'format' };
    }
  }

  private async lakukanProses(file: File, profil: ProfilGambar): Promise<HasilProses> {
    // 2. Baca 32 byte pertama untuk deteksi magic bytes
    const sliceHeader = file.slice(0, 32);
    const headerBuf = await sliceHeader.arrayBuffer();
    const format = deteksiFormat(new Uint8Array(headerBuf));
    if (!format) {
      return { ok: false, alasan: 'format' };
    }

    // 3. Dekode menjadi ImageBitmap
    let bitmap: ImageBitmap;
    if (format === 'heic') {
      try {
        const { heicTo } = await import('heic-to');
        const pngBlob = await heicTo({ blob: file, type: 'image/png' });
        bitmap = await createImageBitmap(pngBlob);
      } catch {
        return { ok: false, alasan: 'format' };
      }
    } else {
      try {
        // { imageOrientation: 'from-image' } menormalkan rotasi EXIF & untuk GIF mengambil frame pertama
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        return { ok: false, alasan: 'format' };
      }
    }

    try {
      // 4. Hitung ukuran target & render ke canvas
      const { w: targetW, h: targetH } = ukuranTarget(bitmap.width, bitmap.height, profil.maksSisi);
      const canvas = gambarKeCanvas(bitmap, targetW, targetH, this.doc);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return { ok: false, alasan: 'format' };
      }

      // 5. Deteksi transparansi:
      // Format yang dapat memiliki alpha diuji; jika ada alpha < 255 -> simpan sebagai PNG, selain itu JPEG 0.85
      const formatBisaAlpha: FormatSumber[] = ['png', 'webp', 'gif', 'avif', 'heic', 'bmp'];
      let mime: 'image/jpeg' | 'image/png' = 'image/jpeg';
      if (formatBisaAlpha.includes(format)) {
        const transparan = memilikiTransparansi(ctx, targetW, targetH);
        if (transparan) {
          mime = 'image/png';
        }
      }

      // 6. Ekspor ke Blob
      const blob = await canvasToBlob(canvas, mime, mime === 'image/jpeg' ? 0.85 : undefined);
      if (!blob) {
        return { ok: false, alasan: 'format' };
      }

      const data = await blob.arrayBuffer();
      return {
        ok: true,
        foto: {
          data,
          mime,
          ukuran: data.byteLength,
          lebar: targetW,
          tinggi: targetH,
        },
      };
    } finally {
      bitmap.close?.();
    }
  }
}

export function createImageProcessor(doc: Document = document): ImageProcessor {
  return new DefaultImageProcessor(doc);
}
