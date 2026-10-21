// Dialog konfirmasi hapus sesi terapi (Req 6.3, 6.6, 6.7).
// Menyebut nama pasien, tanggal terapi, dan biaya; data baru dihapus setelah
// Pengguna mengonfirmasi. Batal/Escape/Tombol_Kembali menutup tanpa perubahan.

import { useState, type ReactNode } from 'react';
import { formatRupiah, formatTanggal } from '../../../domain/format';
import type { SesiTerapi } from '../../../domain/types';
import { PESAN_GAGAL_HAPUS, useDataStore } from '../../../state/dataStore';
import { Dialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';

export const PESAN_SESI_DIHAPUS = 'Sesi terapi berhasil dihapus';

export interface HapusSesiDialogProps {
  /** Sesi yang akan dihapus; null = dialog tertutup. */
  sesi: SesiTerapi | null;
  namaPasien: string;
  onClose: () => void;
  /** Dipanggil setelah penghapusan berhasil. Default: onClose. */
  onDeleted?: () => void;
}

export function HapusSesiDialog({ sesi, namaPasien, onClose, onDeleted }: HapusSesiDialogProps): ReactNode {
  const store = useDataStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const tutup = () => {
    if (!busy) onClose();
  };

  async function konfirmasi() {
    if (!sesi || busy) return;
    setBusy(true);
    try {
      await store.deleteSesi(sesi.id);
      toast.success(PESAN_SESI_DIHAPUS);
      (onDeleted ?? onClose)();
    } catch {
      toast.error(PESAN_GAGAL_HAPUS);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={sesi !== null}
      title="Hapus Sesi Terapi"
      onClose={tutup}
      actions={
        <>
          <button type="button" className="btn" onClick={tutup} disabled={busy}>
            Batal
          </button>
          <button type="button" className="btn btn--danger" onClick={() => void konfirmasi()} disabled={busy}>
            {busy ? 'Menghapus…' : 'Hapus'}
          </button>
        </>
      }
    >
      {sesi ? (
        (() => {
          const fotoList = store.selectFotoSesi(sesi.id);
          const jumlahFoto = fotoList.length;
          return (
            <p>
              Hapus sesi terapi <strong>{namaPasien}</strong> pada tanggal <strong>{formatTanggal(sesi.tanggal)}</strong>{' '}
              dengan biaya <strong>{formatRupiah(sesi.biaya)}</strong>
              {jumlahFoto > 0 ? ` dan ${jumlahFoto} foto yang tersimpan` : ''}?
            </p>
          );
        })()
      ) : null}
    </Dialog>
  );
}
