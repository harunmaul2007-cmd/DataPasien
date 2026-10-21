// LaporanSesiFlow: alur penyusunan, pembuatan, pratinjau, simpan, dan bagikan laporan PDF (Req 5, 6, 8, 10).

import { useEffect, useState, useCallback } from 'react';
import { layoutLaporan, type GambarInfo } from '../../../domain/laporanLayout';
import { buildLaporanModel, opsiAwal } from '../../../domain/laporanSesi';
import type { FotoMeta, OpsiLaporan, Pasien, SesiTerapi } from '../../../domain/types';
import { createFileGateway, type FileGateway } from '../../../infra/fileGateway';
import { createPdfRenderer, type PdfRenderer } from '../../../infra/pdfRenderer';
import { createShareGateway, type ShareGateway } from '../../../infra/shareGateway';
import { useDialogStack } from '../../components/DialogStack';
import { useToast } from '../../components/Toast';
import { useDataStore } from '../../../state/dataStore';

export interface LaporanSesiFlowProps {
  pasien: Pasien;
  sesi: SesiTerapi;
  fotoList: FotoMeta[];
  onTutup: () => void;
  pdfRenderer?: PdfRenderer;
  fileGateway?: FileGateway;
  shareGateway?: ShareGateway;
}

export function LaporanSesiFlow({
  pasien,
  sesi,
  fotoList,
  onTutup,
  pdfRenderer,
  fileGateway,
  shareGateway,
}: LaporanSesiFlowProps) {
  const store = useDataStore();
  const toast = useToast();
  const dialogStack = useDialogStack();

  const renderer = pdfRenderer ?? createPdfRenderer();
  const fileGw = fileGateway ?? createFileGateway();
  const shareGw = shareGateway ?? createShareGateway();

  const { opsi: opsiDefault, tampilkanOpsiFoto } = opsiAwal(fotoList.length);
  const [opsi, setOpsi] = useState<OpsiLaporan>(opsiDefault);
  const [tahap, setTahap] = useState<'opsi' | 'membuat' | 'pratinjau'>('opsi');

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [namaFile, setNamaFile] = useState('');
  const [judulBagikan, setJudulBagikan] = useState('');
  const [bisaBerbagi, setBisaBerbagi] = useState(false);
  const [sedangAksi, setSedangAksi] = useState(false);

  // Daftarkan dialog ke DialogStack
  const handleTutup = useCallback(() => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    shareGw.bersihkanCache().catch(() => {});
    onTutup();
  }, [pdfUrl, shareGw, onTutup]);

  useEffect(() => {
    const unregister = dialogStack.register({ close: handleTutup });
    return unregister;
  }, [dialogStack, handleTutup]);

  // Cek dukungan berbagi file
  useEffect(() => {
    let aktif = true;
    shareGw.canShareFile('application/pdf').then((bisa) => {
      if (aktif) setBisaBerbagi(bisa);
    });
    return () => {
      aktif = false;
    };
  }, [shareGw]);

  const buatLaporan = async () => {
    setTahap('membuat');
    try {
      const pengaturan = store.selectPengaturan();
      const now = new Date();
      const model = buildLaporanModel(pasien, sesi, fotoList, pengaturan, opsi, now);
      setNamaFile(model.namaFile);
      setJudulBagikan(model.judulBagikan);

      // 1. Muat font metrics
      const metrics = await renderer.metrics();

      // 2. Muat logo
      let logoInfo: GambarInfo | null = null;
      const gambarMap = new Map<string, { data: ArrayBuffer; mime: string }>();

      if (model.kop.adaLogo && pengaturan?.logo) {
        try {
          const logoBlob = await store.loadLogoBlob();
          if (logoBlob) {
            const buf = await logoBlob.arrayBuffer();
            gambarMap.set('logo', { data: buf, mime: pengaturan.logo.mime });
            logoInfo = {
              key: 'logo',
              lebarPx: pengaturan.logo.lebar,
              tinggiPx: pengaturan.logo.tinggi,
              gagal: false,
            };
          } else {
            logoInfo = { key: 'logo', lebarPx: 100, tinggiPx: 100, gagal: true };
          }
        } catch {
          logoInfo = { key: 'logo', lebarPx: 100, tinggiPx: 100, gagal: true };
        }
      }

      // 3. Muat foto sesi
      const fotoInfos: GambarInfo[] = [];
      if (model.foto) {
        for (const f of model.foto) {
          try {
            const blob = await store.loadFotoBlob(f);
            const buf = await blob.arrayBuffer();
            gambarMap.set(f.id, { data: buf, mime: f.mime });
            fotoInfos.push({
              key: f.id,
              lebarPx: f.lebar,
              tinggiPx: f.tinggi,
              gagal: false,
            });
          } catch {
            fotoInfos.push({
              key: f.id,
              lebarPx: f.lebar,
              tinggiPx: f.tinggi,
              gagal: true,
            });
          }
        }
      }

      // 4. Susun tata letak halaman
      const halaman = layoutLaporan(model, metrics, logoInfo, fotoInfos);

      // 5. Render ke Uint8Array
      const bytes = await renderer.render(halaman, gambarMap, model.judulBagikan);
      setPdfBytes(bytes);

      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);

      setTahap('pratinjau');
    } catch {
      toast.error('Laporan gagal dibuat, silakan coba lagi');
      handleTutup();
    }
  };

  const handleSimpanPdf = async () => {
    if (!pdfBytes || sedangAksi) return;
    setSedangAksi(true);
    try {
      const res = await fileGw.saveBinary(namaFile, pdfBytes, 'application/pdf');
      toast.success(`PDF berhasil disimpan ke ${res.location}`);
    } catch {
      toast.error('Gagal menyimpan file PDF');
    } finally {
      setSedangAksi(false);
    }
  };

  const handleBagikanPdf = async () => {
    if (!pdfBytes || sedangAksi) return;
    setSedangAksi(true);
    try {
      const res = await shareGw.shareFile(namaFile, pdfBytes, 'application/pdf', judulBagikan);
      if (res === 'dibagikan') {
        toast.success('Laporan berhasil dibagikan');
      }
    } catch {
      toast.error('Gagal membagikan laporan');
    } finally {
      setSedangAksi(false);
    }
  };

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Laporan Sesi Terapi"
      data-testid="laporan-sesi-flow"
    >
      <div className="dialog-box laporan-flow-box">
        {tahap === 'opsi' && (
          <>
            <div className="dialog-header">
              <h2>Pilihan Laporan PDF</h2>
              <button
                type="button"
                className="btn-icon"
                onClick={handleTutup}
                aria-label="Tutup pilihan laporan"
              >
                ✕
              </button>
            </div>
            <div className="dialog-body">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={opsi.sertakanBiaya}
                  onChange={(e) => setOpsi({ ...opsi, sertakanBiaya: e.target.checked })}
                />
                <span>Sertakan biaya terapi</span>
              </label>

              {tampilkanOpsiFoto && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={opsi.sertakanFoto}
                    onChange={(e) => setOpsi({ ...opsi, sertakanFoto: e.target.checked })}
                  />
                  <span>Sertakan dokumentasi foto ({fotoList.length} foto)</span>
                </label>
              )}
            </div>
            <div className="dialog-footer">
              <button type="button" className="btn btn-secondary" onClick={handleTutup}>
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={buatLaporan}
                data-testid="btn-buat-laporan"
              >
                Buat laporan PDF
              </button>
            </div>
          </>
        )}

        {tahap === 'membuat' && (
          <div className="laporan-loading-body" role="status">
            <div className="spinner" />
            <p>Menyusun laporan PDF…</p>
          </div>
        )}

        {tahap === 'pratinjau' && pdfUrl && (
          <>
            <div className="dialog-header">
              <h2>Pratinjau Laporan</h2>
              <button
                type="button"
                className="btn-icon"
                onClick={handleTutup}
                aria-label="Tutup pratinjau"
              >
                ✕
              </button>
            </div>
            <div className="dialog-body laporan-preview-body">
              <iframe
                src={pdfUrl}
                title="Pratinjau PDF"
                className="laporan-pdf-iframe"
                data-testid="pdf-iframe"
              />
              {!bisaBerbagi && (
                <p className="keterangan-bantu" role="note">
                  Perangkat ini tidak mendukung berbagi file. Simpan PDF lalu kirim secara manual.
                </p>
              )}
            </div>
            <div className="dialog-footer">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={sedangAksi}
                onClick={handleTutup}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={sedangAksi}
                onClick={handleSimpanPdf}
                data-testid="btn-simpan-pdf"
              >
                Simpan PDF
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!bisaBerbagi || sedangAksi}
                onClick={handleBagikanPdf}
                data-testid="btn-bagikan-pdf"
              >
                Bagikan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
