// LogoPicker: pratinjau, pilih, ganti, dan hapus logo praktik (Requirement 10).

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { PROFIL_LOGO } from '../../../domain/foto';
import type { DraftLogo, LogoMeta } from '../../../domain/types';
import { createImageProcessor, type ImageProcessor } from '../../../infra/imageProcessor';
import { useDataStore } from '../../../state/dataStore';
import { useToast } from '../../components/Toast';

export interface LogoPickerProps {
  draftLogo: DraftLogo;
  onDraftLogoChange: (next: DraftLogo) => void;
  logoTersimpan: LogoMeta | null;
  memproses: boolean;
  onMemprosesChange: (m: boolean) => void;
  imageProcessor?: ImageProcessor;
}

export function LogoPicker({
  draftLogo,
  onDraftLogoChange,
  logoTersimpan,
  memproses,
  onMemprosesChange,
  imageProcessor,
}: LogoPickerProps) {
  const store = useDataStore();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processor = imageProcessor ?? createImageProcessor();

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let aktif = true;

    if (draftLogo.jenis === 'hapus') {
      setPreviewUrl(null);
      return;
    }

    if (draftLogo.jenis === 'baru') {
      const blob = new Blob([draftLogo.foto.data as unknown as BlobPart], { type: draftLogo.foto.mime });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }

    // draftLogo.jenis === 'tetap'
    if (logoTersimpan) {
      store.loadLogoBlob().then((blob) => {
        if (!aktif || !blob) return;
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      });
    } else {
      setPreviewUrl(null);
    }

    return () => {
      aktif = false;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [draftLogo, logoTersimpan, store]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    onMemprosesChange(true);
    try {
      const hasil = await processor.process(file, PROFIL_LOGO);
      if (hasil.ok) {
        onDraftLogoChange({ jenis: 'baru', foto: hasil.foto });
      } else {
        if (hasil.alasan === 'ukuran') {
          toast.error(`${file.name}: ukuran melebihi batas 5 MB`);
        } else {
          toast.error(`${file.name}: format gambar tidak didukung`);
        }
      }
    } catch {
      toast.error(`${file.name}: format gambar tidak didukung`);
    } finally {
      onMemprosesChange(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const adaLogo = previewUrl !== null;

  return (
    <div className="logo-picker-container" data-testid="logo-picker">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.heic,.heif,.avif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        data-testid="input-logo"
      />

      {adaLogo && (
        <div className="logo-preview-box">
          <img
            src={previewUrl}
            alt="Logo praktik"
            className="logo-preview-img"
            data-testid="img-logo-preview"
          />
        </div>
      )}

      <div className="logo-picker-actions">
        {adaLogo ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={memproses}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Ganti logo praktik"
            >
              Ganti logo
            </button>
            <button
              type="button"
              className="btn btn-danger-secondary"
              disabled={memproses}
              onClick={() => onDraftLogoChange({ jenis: 'hapus' })}
              aria-label="Hapus logo praktik"
            >
              Hapus logo
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={memproses}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Pilih logo praktik"
          >
            Pilih logo
          </button>
        )}
      </div>

      {memproses && (
        <div className="logo-picker-status" role="status" aria-live="polite">
          Memproses logo…
        </div>
      )}
    </div>
  );
}
