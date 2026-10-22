// LaporanCanvasPreview: komponen pratinjau halaman PDF berbasis HTML5 Canvas (Req 5, 6, 8, 10).
// Menjamin pratinjau muncul sempurna di Android WebView tanpa ketergantungan plugin PDF iframe peramban.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HALAMAN, type Halaman } from '../../domain/laporanLayout';

export interface LaporanCanvasPreviewProps {
  halaman: Halaman[];
  gambarMap: Map<string, { data: ArrayBuffer; mime: string }>;
}

const SCALE = 2; // Resolusi 2x untuk tampilan tajam di layar Retina / ponsel Android

export function LaporanCanvasPreview({ halaman, gambarMap }: LaporanCanvasPreviewProps): ReactNode {
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement> | null>(null);

  // 1. Preload semua gambar dari gambarMap ke HTMLImageElement
  useEffect(() => {
    let active = true;
    const urlsToRevoke: string[] = [];
    const imageMap = new Map<string, HTMLImageElement>();

    const loadAll = async () => {
      const promises: Promise<void>[] = [];

      for (const [key, val] of gambarMap.entries()) {
        const blob = new Blob([val.data], { type: val.mime });
        const url = URL.createObjectURL(blob);
        urlsToRevoke.push(url);

        const img = new Image();
        img.src = url;

        const p = new Promise<void>((resolve) => {
          img.onload = () => {
            imageMap.set(key, img);
            resolve();
          };
          img.onerror = () => {
            resolve(); // Lanjutkan meski satu gambar gagal
          };
        });

        promises.push(p);
      }

      await Promise.all(promises);

      if (active) {
        setLoadedImages(imageMap);
      }
    };

    void loadAll();

    return () => {
      active = false;
      for (const u of urlsToRevoke) {
        URL.revokeObjectURL(u);
      }
    };
  }, [gambarMap]);

  return (
    <div className="laporan-canvas-container" role="region" aria-label="Pratinjau Halaman Laporan">
      {halaman.map((hal, idx) => (
        <div key={idx} className="laporan-page-wrapper">
          <div className="laporan-page-label">Halaman {idx + 1} dari {halaman.length}</div>
          <SinglePageCanvas
            hal={hal}
            images={loadedImages}
            data-testid={`pdf-canvas-${idx}`}
          />
        </div>
      ))}
    </div>
  );
}

interface SinglePageCanvasProps {
  hal: Halaman;
  images: Map<string, HTMLImageElement> | null;
  'data-testid'?: string;
}

function SinglePageCanvas({ hal, images, 'data-testid': testId }: SinglePageCanvasProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return; // Fallback aman untuk lingkungan jsdom / headless test

    const w = Math.round(HALAMAN.lebar * SCALE);
    const h = Math.round(HALAMAN.tinggi * SCALE);
    canvas.width = w;
    canvas.height = h;

    // Latar belakang kertas putih
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    for (const op of hal.ops) {
      if (op.t === 'text') {
        ctx.textBaseline = 'alphabetic';
        ctx.font = `${op.font === 'bold' ? 'bold ' : 'normal '}${Math.round(op.size * SCALE)}px "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = `rgb(${op.color.r}, ${op.color.g}, ${op.color.b})`;
        ctx.fillText(op.text, Math.round(op.x * SCALE), Math.round((HALAMAN.tinggi - op.y) * SCALE));
      } else if (op.t === 'rect') {
        ctx.fillStyle = `rgb(${op.color.r}, ${op.color.g}, ${op.color.b})`;
        ctx.fillRect(
          Math.round(op.x * SCALE),
          Math.round((HALAMAN.tinggi - op.y - op.h) * SCALE),
          Math.round(op.w * SCALE),
          Math.round(op.h * SCALE)
        );
      } else if (op.t === 'image') {
        const img = images?.get(op.key);
        if (img && img.naturalWidth > 0) {
          ctx.drawImage(
            img,
            Math.round(op.x * SCALE),
            Math.round((HALAMAN.tinggi - op.y - op.h) * SCALE),
            Math.round(op.w * SCALE),
            Math.round(op.h * SCALE)
          );
        } else {
          // Kotak placeholder jika gambar belum/gagal dimuat
          ctx.fillStyle = '#f4f4f4';
          ctx.fillRect(
            Math.round(op.x * SCALE),
            Math.round((HALAMAN.tinggi - op.y - op.h) * SCALE),
            Math.round(op.w * SCALE),
            Math.round(op.h * SCALE)
          );
          ctx.strokeStyle = '#cccccc';
          ctx.lineWidth = 1;
          ctx.strokeRect(
            Math.round(op.x * SCALE),
            Math.round((HALAMAN.tinggi - op.y - op.h) * SCALE),
            Math.round(op.w * SCALE),
            Math.round(op.h * SCALE)
          );
        }
      } else if (op.t === 'placeholder') {
        ctx.fillStyle = '#f4f4f4';
        ctx.fillRect(
          Math.round(op.x * SCALE),
          Math.round((HALAMAN.tinggi - op.y - op.h) * SCALE),
          Math.round(op.w * SCALE),
          Math.round(op.h * SCALE)
        );
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          Math.round(op.x * SCALE),
          Math.round((HALAMAN.tinggi - op.y - op.h) * SCALE),
          Math.round(op.w * SCALE),
          Math.round(op.h * SCALE)
        );
        ctx.fillStyle = '#666666';
        ctx.font = `normal ${Math.round(9 * SCALE)}px "Noto Sans", sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(
          op.text,
          Math.round((op.x + 8) * SCALE),
          Math.round((HALAMAN.tinggi - (op.y + op.h / 2)) * SCALE)
        );
      }
    }
  }, [hal, images]);

  return (
    <canvas
      ref={canvasRef}
      className="laporan-canvas-page"
      data-testid={testId}
      aria-label="Halaman Dokumen Laporan"
    />
  );
}
