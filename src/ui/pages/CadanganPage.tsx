// Halaman cadangan: ekspor seluruh data ke File_Cadangan dan impor (pemulihan)
// dari File_Cadangan (Req 14).
//
// Alur impor: pilih file → parseBackup (di DataStore.pickBackupFile) →
//   - dibatalkan (null)  → tidak ada pesan maupun dialog (Req 14.12)
//   - ditolak (ok:false) → pesan alasan, tanpa dialog (Req 14.6)
//   - valid              → dialog konfirmasi berisi jumlah + peringatan (Req 14.3)
//                          → konfirmasi: importBackup (Req 14.4, 14.7)
//                          → batal: tutup dialog, data tetap (Req 14.5)
// Data tersimpan tidak disentuh sebelum Pengguna mengonfirmasi.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AppData, Counts } from '../../domain/types';
import { PESAN_GAGAL_EKSPOR, PESAN_GAGAL_IMPOR, useDataStore } from '../../state/dataStore';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/Toast';
import './CadanganPage.css';

/** "3 pasien, 5 sesi terapi, dan 2 jadwal kunjungan" */
export function formatCounts(c: Counts): string {
  return `${c.pasien} pasien, ${c.sesi} sesi terapi, dan ${c.jadwal} jadwal kunjungan`;
}

type Busy = 'idle' | 'export' | 'pick' | 'import';

interface PendingImport {
  data: AppData;
  counts: Counts;
}

export function CadanganPage(): ReactNode {
  const store = useDataStore();
  const toast = useToast();
  const [busy, setBusy] = useState<Busy>('idle');
  const [pending, setPending] = useState<PendingImport | null>(null);

  // Hindari setState setelah halaman ditinggalkan saat operasi async berjalan.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const finish = () => {
    if (mounted.current) setBusy('idle');
  };

  async function handleExport(): Promise<void> {
    if (busy !== 'idle') return;
    setBusy('export');
    try {
      const { fileName, location, counts } = await store.exportBackup();
      toast.success(
        `Ekspor berhasil. File ${fileName} disimpan di ${location}. Diekspor: ${formatCounts(counts)}.`,
      );
    } catch {
      // Req 14.11: hanya pesan gagal, tanpa pesan berhasil.
      toast.error(PESAN_GAGAL_EKSPOR);
    } finally {
      finish();
    }
  }

  async function handlePick(): Promise<void> {
    if (busy !== 'idle') return;
    setBusy('pick');
    try {
      const result = await store.pickBackupFile();
      if (result === null) return; // dibatalkan: tanpa pesan (Req 14.12)
      if (!result.ok) {
        toast.error(`Impor ditolak: ${result.reason}`);
        return;
      }
      if (mounted.current) setPending({ data: result.data, counts: result.counts });
    } catch {
      toast.error('File cadangan gagal dibaca');
    } finally {
      finish();
    }
  }

  function handleCancelImport(): void {
    if (busy === 'import') return;
    setPending(null);
  }

  async function handleConfirmImport(): Promise<void> {
    if (!pending || busy !== 'idle') return;
    setBusy('import');
    try {
      const counts = await store.importBackup(pending.data);
      toast.success(`Impor berhasil. Diimpor: ${formatCounts(counts)}.`);
    } catch {
      // Req 14.7: data tersimpan & tampilan tetap seperti sebelum impor.
      toast.error(PESAN_GAGAL_IMPOR);
    } finally {
      if (mounted.current) setPending(null);
      finish();
    }
  }

  const disabled = busy !== 'idle';

  return (
    <section className="page cadangan" aria-labelledby="cadangan-judul">
      <h1 id="cadangan-judul">Cadangan</h1>

      <div className="cadangan__section">
        <h2 className="cadangan__heading">Ekspor data</h2>
        <p className="cadangan__desc">
          Simpan seluruh data pasien, sesi terapi, dan jadwal kunjungan ke satu file cadangan (JSON).
          File cadangan hanya mencakup data teks dan tidak menyertakan foto sesi maupun logo praktik.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => void handleExport()} disabled={disabled}>
          {busy === 'export' ? 'Mengekspor…' : 'Ekspor data'}
        </button>
      </div>

      <div className="cadangan__section">
        <h2 className="cadangan__heading">Impor data</h2>
        <p className="cadangan__desc">
          Pulihkan data dari file cadangan. Seluruh data yang ada saat ini akan diganti dengan isi file.
        </p>
        <button type="button" className="btn" onClick={() => void handlePick()} disabled={disabled}>
          {busy === 'pick' ? 'Membaca file…' : 'Impor data'}
        </button>
      </div>

      <Dialog
        open={pending !== null}
        title="Konfirmasi impor"
        onClose={handleCancelImport}
        actions={
          <>
            <button type="button" className="btn" onClick={handleCancelImport} disabled={busy === 'import'}>
              Batal
            </button>
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => void handleConfirmImport()}
              disabled={busy === 'import'}
            >
              {busy === 'import' ? 'Mengimpor…' : 'Impor'}
            </button>
          </>
        }
      >
        {pending ? (
          <>
            <p>File berisi {formatCounts(pending.counts)}.</p>
            <p className="cadangan__warning">
              Peringatan: seluruh data yang ada saat ini akan diganti dengan isi file ini. Foto sesi yang tidak termasuk dalam sesi terapi file cadangan akan dibersihkan, sedangkan logo praktik dan pengaturan laporan dipertahankan.
            </p>
          </>
        ) : null}
      </Dialog>
    </section>
  );
}
