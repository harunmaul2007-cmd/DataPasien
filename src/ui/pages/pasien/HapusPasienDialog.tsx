// Dialog konfirmasi hapus Data_Pasien (Req 3.1–3.3, 3.5, 3.6).
// Menampilkan nama pasien serta jumlah Sesi_Terapi dan Jadwal_Kunjungan
// (semua status) yang ikut terhapus, termasuk angka 0.

import { useRef, useState, type ReactNode } from 'react';
import { PESAN_GAGAL_HAPUS, useDataStore, useDataStoreSelector } from '../../../state/dataStore';
import { Dialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';
import { PESAN_PASIEN_TIDAK_DITEMUKAN } from './PasienFormDialog';

export const PESAN_PASIEN_DIHAPUS = 'Data pasien berhasil dihapus';

export interface HapusPasienDialogProps {
  /** Id pasien yang akan dihapus; null berarti dialog tertutup. */
  pasienId: string | null;
  /** Dipanggil saat dialog ditutup (batal atau setelah berhasil dihapus). */
  onClose: () => void;
  /** Dipanggil setelah penghapusan berhasil, sebelum onClose. */
  onDeleted?: (pasienId: string) => void;
}

export function HapusPasienDialog(props: HapusPasienDialogProps): ReactNode {
  if (props.pasienId === null) return null;
  return <HapusPasienDialogContent key={props.pasienId} {...props} pasienId={props.pasienId} />;
}

function HapusPasienDialogContent({
  pasienId,
  onClose,
  onDeleted,
}: HapusPasienDialogProps & { pasienId: string }): ReactNode {
  const store = useDataStore();
  const toast = useToast();
  const pasien = useDataStoreSelector((s) => s.selectPasien(pasienId));
  const summary = useDataStoreSelector((s) => s.selectDeletionSummary(pasienId));
  // Nama disimpan agar tetap terbaca bila data berubah saat dialog terbuka.
  const [nama] = useState(() => pasien?.nama ?? '');
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);

  async function handleConfirm(): Promise<void> {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await store.deletePasien(pasienId);
      toast.success(PESAN_PASIEN_DIHAPUS);
      onDeleted?.(pasienId);
      onClose();
    } catch {
      // Data tetap utuh (transaksi dibatalkan); dialog tetap terbuka (Req 3.6).
      toast.error(PESAN_GAGAL_HAPUS);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  }

  if (!pasien && !deleting) {
    return (
      <Dialog
        open
        title="Hapus Pasien"
        onClose={onClose}
        actions={
          <button type="button" className="btn" onClick={onClose}>
            Tutup
          </button>
        }
      >
        <p role="alert">{PESAN_PASIEN_TIDAK_DITEMUKAN}</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      title="Hapus Pasien"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={deleting}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => void handleConfirm()}
            disabled={deleting}
          >
            {deleting ? 'Menghapus…' : 'Hapus'}
          </button>
        </>
      }
    >
      <p>
        Hapus pasien <strong data-testid="hapus-nama">{pasien?.nama ?? nama}</strong>?
      </p>
      <p>Data berikut juga akan ikut terhapus:</p>
      <ul>
        <li>
          <span data-testid="hapus-jumlah-sesi">{summary.jumlahSesi}</span> sesi terapi
        </li>
        <li>
          <span data-testid="hapus-jumlah-jadwal">{summary.jumlahJadwal}</span> jadwal kunjungan
        </li>
        {summary.jumlahFoto > 0 ? (
          <li>
            <span data-testid="hapus-jumlah-foto">{summary.jumlahFoto}</span> foto sesi
          </li>
        ) : null}
      </ul>
    </Dialog>
  );
}
