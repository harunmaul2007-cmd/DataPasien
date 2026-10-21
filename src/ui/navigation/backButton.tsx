// Penanganan Tombol_Kembali Android (Req 13.14–13.18).
//
// Urutan keputusan:
//   1. Ada dialog terbuka → tutup dialog teratas (= Batal, Req 13.15).
//   2. Bukan Halaman_Utama → kembali ke halaman sebelumnya (Req 13.14).
//   3. Halaman_Utama → tampilkan dialog konfirmasi keluar Keluar/Batal (Req 13.16).
//
// Dialog konfirmasi keluar sendiri terdaftar di DialogStack, sehingga menekan
// Tombol_Kembali saat dialog itu terbuka menutupnya seperti Batal (Req 13.18).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { PlatformAdapter } from '../../infra/platform';
import { Dialog } from '../components/Dialog';
import { useDialogStack, type DialogStackApi } from '../components/DialogStack';
import { ROUTES } from './routes';

export type BackAction = 'closeDialog' | 'navigateBack' | 'confirmExit';

export interface BackState {
  /** Jumlah dialog yang sedang terbuka. */
  openDialogs: number;
  /** Path rute saat ini (mis. `useLocation().pathname`). */
  pathname: string;
}

/** true bila path adalah Halaman_Utama (daftar pasien). */
export function isHalamanUtama(pathname: string): boolean {
  return pathname === ROUTES.pasienList || pathname === '';
}

/** Keputusan murni Tombol_Kembali berdasarkan keadaan saat ini. */
export function decideBackAction(state: BackState): BackAction {
  if (state.openDialogs > 0) return 'closeDialog';
  if (!isHalamanUtama(state.pathname)) return 'navigateBack';
  return 'confirmExit';
}

export interface BackDeps {
  dialogStack: DialogStackApi;
  pathname: string;
  /** Kembali ke halaman sebelumnya (`navigate(-1)`). */
  navigateBack: () => void;
  /** Menampilkan dialog konfirmasi keluar. */
  showExitConfirm: () => void;
}

/** Menjalankan keputusan Tombol_Kembali; mengembalikan aksi yang diambil. */
export function handleBackButton(deps: BackDeps): BackAction {
  const action = decideBackAction({ openDialogs: deps.dialogStack.size(), pathname: deps.pathname });
  if (action === 'closeDialog') deps.dialogStack.closeTop();
  else if (action === 'navigateBack') deps.navigateBack();
  else deps.showExitConfirm();
  return action;
}

export interface ExitConfirmDialogProps {
  open: boolean;
  onExit: () => void;
  onCancel: () => void;
}

/** Dialog konfirmasi keluar dengan tepat dua pilihan: Keluar dan Batal (Req 13.16). */
export function ExitConfirmDialog({ open, onExit, onCancel }: ExitConfirmDialogProps): ReactNode {
  return (
    <Dialog
      open={open}
      title="Keluar dari Aplikasi?"
      onClose={onCancel}
      actions={
        <>
          <button type="button" className="btn" onClick={onCancel}>
            Batal
          </button>
          <button type="button" className="btn btn--primary" onClick={onExit}>
            Keluar
          </button>
        </>
      }
    >
      <p>Data yang sudah disimpan tetap tersedia saat Aplikasi dibuka kembali.</p>
    </Dialog>
  );
}

/**
 * Menyambungkan Tombol_Kembali platform ke logika di atas. Harus dirender di
 * dalam Router dan DialogStackProvider. Di web (`onBack` no-op) tidak berefek.
 */
export function BackButtonHandler({ platform }: { platform: PlatformAdapter }): ReactNode {
  const dialogStack = useDialogStack();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [exitOpen, setExitOpen] = useState(false);

  // Simpan nilai terbaru di ref agar listener tidak perlu didaftar ulang.
  const latest = useRef({ dialogStack, pathname, navigate });
  latest.current = { dialogStack, pathname, navigate };

  useEffect(
    () =>
      platform.onBack(() => {
        const { dialogStack: stack, pathname: path, navigate: nav } = latest.current;
        handleBackButton({
          dialogStack: stack,
          pathname: path,
          navigateBack: () => nav(-1),
          showExitConfirm: () => setExitOpen(true),
        });
      }),
    [platform],
  );

  return (
    <ExitConfirmDialog
      open={exitOpen}
      onCancel={() => setExitOpen(false)}
      onExit={() => {
        setExitOpen(false);
        platform.exitApp();
      }}
    />
  );
}
