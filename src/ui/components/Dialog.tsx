// Dialog tunggal berbasis elemen <dialog> untuk formulir dan konfirmasi.
// Saat terbuka, dialog mendaftar ke DialogStack sehingga Tombol_Kembali dapat
// menutup dialog teratas; penutupan via Escape/Tombol_Kembali = "Batal".

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useDialogStack } from './DialogStack';

export interface DialogProps {
  open: boolean;
  title: string;
  /** Dipanggil saat dialog ditutup sebagai batal (Escape, Tombol_Kembali, tombol tutup). */
  onClose: () => void;
  children?: ReactNode;
  /** Tombol aksi di bagian bawah dialog. */
  actions?: ReactNode;
}

export function Dialog({ open, title, onClose, children, actions }: DialogProps): ReactNode {
  const ref = useRef<HTMLDialogElement>(null);
  const stack = useDialogStack();
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Daftar ke DialogStack selama terbuka.
  useEffect(() => {
    if (!open) return;
    return stack.register({ close: () => onCloseRef.current() });
  }, [open, stack]);

  // Elemen <dialog> hanya dirender saat terbuka; tampilkan sebagai modal.
  // jsdom belum mendukung showModal, jadi pakai atribut `open` sebagai cadangan.
  useEffect(() => {
    const el = ref.current;
    if (!open || !el || el.open) return;
    try {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    } catch {
      el.setAttribute('open', '');
    }
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Escape: jangan biarkan peramban menutup sendiri; serahkan ke pemilik state.
        e.preventDefault();
        onCloseRef.current();
      }}
    >
      <h2 id={titleId} className="dialog__title">
        {title}
      </h2>
      <div className="dialog__body">{children}</div>
      {actions ? <div className="dialog__actions">{actions}</div> : null}
    </dialog>
  );
}
