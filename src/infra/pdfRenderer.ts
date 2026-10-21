// PdfRenderer: rendering halaman PDF dengan pdf-lib dan @pdf-lib/fontkit (Req 5, 6, 8, 10).

import type { FontMetrics, Halaman } from '../domain/laporanLayout';
import { HALAMAN } from '../domain/laporanLayout';
import regularFontUrl from './fonts/NotoSans-Regular.ttf?url';
import boldFontUrl from './fonts/NotoSans-Bold.ttf?url';

export interface PdfRenderer {
  metrics(): Promise<FontMetrics>;
  render(
    halaman: Halaman[],
    gambar: Map<string, { data: ArrayBuffer; mime: string }>,
    judulBagikan?: string
  ): Promise<Uint8Array>;
}

let regularFontCache: ArrayBuffer | null = null;
let boldFontCache: ArrayBuffer | null = null;

async function muatFont(url: string, namaFile: string): Promise<ArrayBuffer> {
  if (typeof fetch === 'function') {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch {
      // Fallback ke Node fs di lingkungan pengujian
    }
  }

  if (typeof process !== 'undefined' && process.versions?.node) {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(currentDir, 'fonts', namaFile);
    const buf = await fs.readFile(filePath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  throw new Error(`Gagal memuat font ${namaFile}`);
}

async function getRegularFontBytes(): Promise<ArrayBuffer> {
  if (!regularFontCache) {
    regularFontCache = await muatFont(regularFontUrl, 'NotoSans-Regular.ttf');
  }
  return regularFontCache;
}

async function getBoldFontBytes(): Promise<ArrayBuffer> {
  if (!boldFontCache) {
    boldFontCache = await muatFont(boldFontUrl, 'NotoSans-Bold.ttf');
  }
  return boldFontCache;
}

export class DefaultPdfRenderer implements PdfRenderer {
  async metrics(): Promise<FontMetrics> {
    const fontkitModule = await import('@pdf-lib/fontkit');
    const fontkit = (fontkitModule.default || fontkitModule) as {
      create(buf: Uint8Array): {
        unitsPerEm: number;
        layout(text: string): { advanceWidth: number };
        hasGlyphForCodePoint(cp: number): boolean;
      };
    };

    const regularBytes = await getRegularFontBytes();
    const boldBytes = await getBoldFontBytes();

    const regFont = fontkit.create(new Uint8Array(regularBytes));
    const bFont = fontkit.create(new Uint8Array(boldBytes));

    return {
      widthOf(text: string, font: 'regular' | 'bold', sizePt: number): number {
        const f = font === 'bold' ? bFont : regFont;
        const run = f.layout(text);
        return (run.advanceWidth / f.unitsPerEm) * sizePt;
      },
      hasGlyph(codePoint: number, font: 'regular' | 'bold'): boolean {
        const f = font === 'bold' ? bFont : regFont;
        return f.hasGlyphForCodePoint(codePoint);
      },
    };
  }

  async render(
    halaman: Halaman[],
    gambar: Map<string, { data: ArrayBuffer; mime: string }>,
    judulBagikan = 'Laporan Hasil Terapi'
  ): Promise<Uint8Array> {
    const { PDFDocument, rgb } = await import('pdf-lib');
    const fontkitModule = await import('@pdf-lib/fontkit');
    const fontkit = fontkitModule.default || fontkitModule;

    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);

    const regularBytes = await getRegularFontBytes();
    const boldBytes = await getBoldFontBytes();

    const regularFont = await doc.embedFont(regularBytes, { subset: true });
    const boldFont = await doc.embedFont(boldBytes, { subset: true });

    // Sematkan semua gambar yang tersedia (sekali per key)
    const embeddedImages = new Map<string, import('pdf-lib').PDFImage>();
    for (const [key, item] of gambar.entries()) {
      try {
        if (item.mime === 'image/png') {
          const img = await doc.embedPng(item.data);
          embeddedImages.set(key, img);
        } else {
          const img = await doc.embedJpg(item.data);
          embeddedImages.set(key, img);
        }
      } catch {
        // Abaikan kegagalan penyematan gambar; layout akan menangani placeholder jika gagal
      }
    }

    doc.setTitle(judulBagikan);
    doc.setCreator('Data Pasien');
    doc.setProducer('Data Pasien');

    for (const hal of halaman) {
      const page = doc.addPage([HALAMAN.lebar, HALAMAN.tinggi]);

      for (const op of hal.ops) {
        if (op.t === 'text') {
          const font = op.font === 'bold' ? boldFont : regularFont;
          page.drawText(op.text, {
            x: op.x,
            y: op.y,
            size: op.size,
            font,
            color: rgb(op.color.r / 255, op.color.g / 255, op.color.b / 255),
          });
        } else if (op.t === 'rect') {
          page.drawRectangle({
            x: op.x,
            y: op.y,
            width: op.w,
            height: op.h,
            color: rgb(op.color.r / 255, op.color.g / 255, op.color.b / 255),
          });
        } else if (op.t === 'image') {
          const img = embeddedImages.get(op.key);
          if (img) {
            page.drawImage(img, {
              x: op.x,
              y: op.y,
              width: op.w,
              height: op.h,
            });
          } else {
            // Gambar gagal disematkan -> gambar kotak placeholder
            page.drawRectangle({
              x: op.x,
              y: op.y,
              width: op.w,
              height: op.h,
              color: rgb(0.95, 0.95, 0.95),
              borderColor: rgb(0.8, 0.8, 0.8),
              borderWidth: 1,
            });
            page.drawText('Foto tidak dapat dimuat', {
              x: op.x + 8,
              y: op.y + op.h / 2 - 4,
              size: 9,
              font: regularFont,
              color: rgb(0.4, 0.4, 0.4),
            });
          }
        } else if (op.t === 'placeholder') {
          page.drawRectangle({
            x: op.x,
            y: op.y,
            width: op.w,
            height: op.h,
            color: rgb(0.95, 0.95, 0.95),
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
          });
          page.drawText(op.text, {
            x: op.x + 8,
            y: op.y + op.h / 2 - 4,
            size: 9,
            font: regularFont,
            color: rgb(0.4, 0.4, 0.4),
          });
        }
      }
    }

    return await doc.save();
  }
}

export function createPdfRenderer(): PdfRenderer {
  return new DefaultPdfRenderer();
}
