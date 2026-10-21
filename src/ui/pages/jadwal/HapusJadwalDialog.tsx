// Dialog konfirmasi hapus Jadwal_Kunjungan (Req 8.13).
// Menyebut nama pasien, tanggal, dan jam; jadwal baru dihapus setelah Pengguna
// mengonfirmasi. Data_Pasien dan Sesi_Terapi tidak tersentuh. Batal/Escape/
// Tombol_Kembali menutup tanpa perubahan.

import { useState, type ReactNode } from 'react';
import { formatJam, formatTanggal } from '../../../domain/format';
import type { JadwalKunjungan } from '../../../domain/types';
import { PESAN_GAGAL_HAPUS, useDataStore } from '../../../state/dataStore';
import { Dialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';

export const PESAN_JADWAL_DIHAPUS = 'Jadwal kunjungan berhasil dihapus';

export interface HapusJadwalDialogProps {
  /** Jadwal yang akan dihapus; null = dialog tertutup. */
  jadwal: JadwalKunjungan | null;
  namaPasien: string;
  onClose: () => void;
  /** Dipanggil setelah penghapusan berhasil. Default: onClose. */
  onDeleted?: () => void;
}

export function HapusJadwalDialog({ jadwal, namaPasien, onClose, onDeleted }: HapusJadwalDialogProps): ReactNode {
  const store = useDataStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const tutup = () => {
    if (!busy) onClose();
  };

  async function konfirmasi() {
    if (!jadwal || busy) return;
    setBusy(true);
    try {
      await store.deleteJadwal(jadwal.id);
      toast.success(PESAN_JADWAL_DIHAPUS);
      (onDeleted ?? onClose)();
    } catch {
      toast.error(PESAN_GAGAL_HAPUS);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={jadwal !== null}
      title="Hapus Jadwal"
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
      {jadwal ? (
        <p>
          Hapus jadwal kunjungan <strong>{namaPasien}</strong> pada tanggal{' '}
          <strong>{formatTanggal(jadwal.tanggal)}</strong> jam <strong>{formatJam(jadwal.jam)}</strong>?
        </p>
      ) : null}
    </Dialog>
  );
}
