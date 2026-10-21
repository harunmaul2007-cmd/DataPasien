// DialogStack: daftar dialog yang sedang terbuka, berurutan dari yang paling
// awal dibuka hingga paling atas. Dipakai Tombol_Kembali (Android) untuk
// menutup dialog teratas dengan perilaku sama seperti "Batal" (Req 13.15).

import { createContext, useContext, useState, type ReactNode } from 'react';

export interface DialogEntry {
  /** Menutup dialog seperti memilih batal. */
  close: () => void;
}

export interface DialogStackApi {
  /** Mendaftarkan dialog terbuka; mengembalikan fungsi untuk melepas pendaftaran. */
  register: (entry: DialogEntry) => () => void;
  /** Menutup dialog teratas. Mengembalikan false jika tidak ada dialog terbuka. */
  closeTop: () => boolean;
  /** Jumlah dialog yang sedang terbuka. */
  size: () => number;
}

/** Implementasi murni (tanpa React) agar mudah diuji dan dipakai ulang. */
export function createDialogStack(): DialogStackApi {
  const entries: DialogEntry[] = [];
  return {
    register(entry) {
      entries.push(entry);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const i = entries.lastIndexOf(entry);
        if (i >= 0) entries.splice(i, 1);
      };
    },
    closeTop() {
      const top = entries[entries.length - 1];
      if (!top) return false;
      top.close();
      return true;
    },
    size: () => entries.length,
  };
}

const DialogStackContext = createContext<DialogStackApi | null>(null);

export function DialogStackProvider(props: { stack?: DialogStackApi; children?: ReactNode }): ReactNode {
  const [ownStack] = useState(createDialogStack);
  return (
    <DialogStackContext.Provider value={props.stack ?? ownStack}>{props.children}</DialogStackContext.Provider>
  );
}

export function useDialogStack(): DialogStackApi {
  const stack = useContext(DialogStackContext);
  if (!stack) throw new Error('useDialogStack harus dipakai di dalam DialogStackProvider');
  return stack;
}
