// FotoPicker: pemilih foto dari galeri dan kamera untuk Formulir Sesi (Requirement 2).

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  bolehTambah,
  PROFIL_FOTO,
  BATAS_JUMLAH_FOTO,
  type AksiDraft,
  type FotoDraft,
} from '../../../domain/foto';
import { createCameraGateway, type CameraGateway } from '../../../infra/cameraGateway';
import { createImageProcessor, type ImageProcessor } from '../../../infra/imageProcessor';
import { useToast } from '../../components/Toast';

export interface FotoPickerProps {
  draft: FotoDraft;
  dispatch: (aksi: AksiDraft) => void;
  imageProcessor?: ImageProcessor;
  cameraGateway?: CameraGateway;
}

export function FotoPicker({
  draft,
  dispatch,
  imageProcessor,
  cameraGateway,
}: FotoPickerProps) {
  const [kameraTersedia, setKameraTersedia] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const processor = imageProcessor ?? createImageProcessor();
  const camGateway = cameraGateway ?? createCameraGateway();

  useEffect(() => {
    let aktif = true;
    camGateway.cekKameraTersedia().then((tersedia) => {
      if (aktif) setKameraTersedia(tersedia);
    });
    return () => {
      aktif = false;
    };
  }, [camGateway]);

  const dapatTambah = bolehTambah(draft);

  const prosesDaftarFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    dispatch({ type: 'prosesMulai' });

    try {
      // Hitung item sementara agar batasan 10 foto tepat
      let jumlahSaatIni = draft.items.length;

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file) continue;

        if (jumlahSaatIni >= BATAS_JUMLAH_FOTO) {
          dispatch({ type: 'tolak', namaFile: file.name, alasan: 'batas' });
          break;
        }

        const hasil = await processor.process(file, PROFIL_FOTO);
        if (hasil.ok) {
          dispatch({
            type: 'terima',
            tempId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            foto: hasil.foto,
          });
          jumlahSaatIni++;
        } else {
          dispatch({
            type: 'tolak',
            namaFile: file.name,
            alasan: hasil.alasan,
          });
        }
      }
    } finally {
      dispatch({ type: 'prosesSelesai' });
      // Reset input agar file yang sama dapat dipilih ulang
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const handleGalleryChange = (e: ChangeEvent<HTMLInputElement>) => {
    prosesDaftarFile(e.target.files);
  };

  const handleCameraChange = (e: ChangeEvent<HTMLInputElement>) => {
    prosesDaftarFile(e.target.files);
  };

  const handleBukaKamera = () => {
    try {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    } catch {
      toast.error('Kamera tidak dapat digunakan. Gunakan Tambah foto dari galeri.');
    }
  };

  return (
    <div className="foto-picker-container" data-testid="foto-picker">
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,.heic,.heif,.avif"
        multiple
        style={{ display: 'none' }}
        onChange={handleGalleryChange}
        data-testid="input-galeri"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleCameraChange}
        data-testid="input-kamera"
      />

      <div className="foto-picker-actions">
        <button
          type="button"
          className="btn btn-secondary foto-picker-btn"
          disabled={!dapatTambah}
          onClick={() => galleryInputRef.current?.click()}
          aria-label="Tambah foto dari galeri"
        >
          📁 Tambah foto
        </button>

        {kameraTersedia && (
          <button
            type="button"
            className="btn btn-secondary foto-picker-btn"
            disabled={!dapatTambah}
            onClick={handleBukaKamera}
            aria-label="Ambil foto dengan kamera"
          >
            📷 Ambil foto
          </button>
        )}
      </div>

      {draft.memproses && (
        <div className="foto-picker-status" role="status" aria-live="polite">
          Memproses foto…
        </div>
      )}

      {draft.pesan.length > 0 && (
        <div className="foto-picker-pesan-list" role="alert">
          {draft.pesan.map((pesan, idx) => (
            <div key={idx} className="foto-picker-pesan-item">
              {pesan}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
