// FotoStrip: strip thumbnail foto sesi terapi (Requirement 2, 3).

import { useEffect, useState } from 'react';
import { teksAltFoto } from '../../domain/foto';
import type { FotoSource } from '../../domain/types';

export interface FotoStripProps {
  sources: FotoSource[];
  tanggal: string;
  onFotoClick?: (index: number) => void;
  onHapusFoto?: (index: number) => void;
  showCountBadge?: boolean;
}

export function FotoStrip({
  sources,
  tanggal,
  onFotoClick,
  onHapusFoto,
  showCountBadge = false,
}: FotoStripProps) {
  const [blobUrls, setBlobUrls] = useState<Map<number, string | null>>(new Map());

  useEffect(() => {
    let aktif = true;

    async function loadAll() {
      const urls = new Map<number, string | null>();
      for (let i = 0; i < sources.length; i++) {
        const src = sources[i];
        if (!src) continue;
        try {
          const blob = await src.load();
          if (!aktif) return;
          urls.set(i, URL.createObjectURL(blob));
        } catch {
          if (!aktif) return;
          urls.set(i, null);
        }
      }
      if (aktif) {
        setBlobUrls(urls);
      }
    }

    loadAll();

    return () => {
      aktif = false;
      for (const url of blobUrls.values()) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, [sources]);

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="foto-strip-container" data-testid="foto-strip">
      {showCountBadge && (
        <div className="foto-strip-count-badge" aria-label={`${sources.length} foto`}>
          {sources.length} foto
        </div>
      )}
      <div className="foto-strip-list" role="list">
        {sources.map((src, index) => {
          const url = blobUrls.get(index);
          const isGagal = url === null;
          const altText = teksAltFoto(index + 1, tanggal);

          return (
            <div key={src.key} className="foto-strip-item" role="listitem">
              <button
                type="button"
                className="foto-thumbnail-btn"
                onClick={() => onFotoClick?.(index)}
                aria-label={`Lihat ${altText}`}
              >
                {isGagal ? (
                  <div className="foto-thumbnail-error" role="status">
                    Foto tidak dapat dimuat
                  </div>
                ) : url ? (
                  <img
                    src={url}
                    alt={altText}
                    className="foto-thumbnail-img"
                    loading="lazy"
                    decoding="async"
                    onError={() => {
                      setBlobUrls((prev) => new Map(prev).set(index, null));
                    }}
                  />
                ) : (
                  <div className="foto-thumbnail-loading">…</div>
                )}
              </button>

              {onHapusFoto && (
                <button
                  type="button"
                  className="foto-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHapusFoto(index);
                  }}
                  aria-label={`Hapus foto ${index + 1}`}
                  title="Hapus foto"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
