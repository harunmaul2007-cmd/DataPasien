// PhotoViewer: penampil foto layar penuh (Requirement 3).

import { useEffect, useState, useCallback, useRef } from 'react';
import { posisiFoto, teksAltFoto } from '../../domain/foto';
import type { FotoSource } from '../../domain/types';
import { useDialogStack } from './DialogStack';

export interface PhotoViewerProps {
  sources: FotoSource[];
  startIndex: number;
  tanggal: string;
  onClose: (lastIndex: number) => void;
}

export function PhotoViewer({ sources, startIndex, tanggal, onClose }: PhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [blobUrls, setBlobUrls] = useState<Map<number, string | null>>(new Map());
  const [loading, setLoading] = useState(true);
  const dialogStack = useDialogStack();
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;

  const handleClose = useCallback(() => {
    onClose(currentIndexRef.current);
  }, [onClose]);

  // Daftarkan ke DialogStack agar tombol kembali menutup viewer (Req 3.5)
  useEffect(() => {
    const unregister = dialogStack.register({ close: handleClose });
    return unregister;
  }, [dialogStack, handleClose]);

  // Tangani tombol Escape & keyboard panah kiri/kanan
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        setCurrentIndex((i) => i - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < sources.length - 1) {
        e.preventDefault();
        setCurrentIndex((i) => i + 1);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, sources.length, handleClose]);

  // Muat foto saat ini dan prefetch foto sebelum/sesudahnya
  useEffect(() => {
    let aktif = true;

    async function loadIndex(idx: number) {
      if (idx < 0 || idx >= sources.length) return;
      const src = sources[idx];
      if (!src) return;

      if (blobUrls.has(idx)) {
        return;
      }

      try {
        const blob = await src.load();
        if (!aktif) return;
        const url = URL.createObjectURL(blob);
        setBlobUrls((prev) => new Map(prev).set(idx, url));
      } catch {
        if (!aktif) return;
        setBlobUrls((prev) => new Map(prev).set(idx, null));
      }
    }

    setLoading(!blobUrls.has(currentIndex));
    loadIndex(currentIndex).finally(() => {
      if (aktif) setLoading(false);
    });

    // Prefetch tetangga
    if (currentIndex + 1 < sources.length) loadIndex(currentIndex + 1);
    if (currentIndex - 1 >= 0) loadIndex(currentIndex - 1);

    return () => {
      aktif = false;
    };
  }, [currentIndex, sources, blobUrls]);

  // Revoke object URLs saat unmount
  useEffect(() => {
    return () => {
      for (const url of blobUrls.values()) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, [blobUrls]);

  const total = sources.length;
  const currentUrl = blobUrls.get(currentIndex);
  const isGagal = currentUrl === null;
  const altText = teksAltFoto(currentIndex + 1, tanggal);

  return (
    <div
      className="photo-viewer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Penampil Foto"
      data-testid="photo-viewer"
    >
      <div className="photo-viewer-header">
        <span className="photo-viewer-posisi" aria-live="polite">
          {posisiFoto(currentIndex + 1, total)}
        </span>
        <button
          type="button"
          className="btn-icon photo-viewer-close"
          onClick={handleClose}
          aria-label="Tutup penampil foto"
        >
          ✕
        </button>
      </div>

      <div className="photo-viewer-content">
        {loading ? (
          <div className="photo-viewer-loading" role="status">
            Memuat foto…
          </div>
        ) : isGagal ? (
          <div className="photo-viewer-error" role="status">
            Foto tidak dapat dimuat
          </div>
        ) : currentUrl ? (
          <img
            src={currentUrl}
            alt={altText}
            className="photo-viewer-img"
            decoding="async"
            onError={() => {
              setBlobUrls((prev) => new Map(prev).set(currentIndex, null));
            }}
          />
        ) : null}
      </div>

      {total > 1 && (
        <div className="photo-viewer-nav">
          <button
            type="button"
            className="btn photo-viewer-prev"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            aria-label="Foto sebelumnya"
          >
            ‹ Sebelumnya
          </button>
          <button
            type="button"
            className="btn photo-viewer-next"
            disabled={currentIndex === total - 1}
            onClick={() => setCurrentIndex((i) => Math.min(total - 1, i + 1))}
            aria-label="Foto berikutnya"
          >
            Berikutnya ›
          </button>
        </div>
      )}
    </div>
  );
}
