// Dialog yang muncul saat fitur Full Version diklik pada versi gratis.

import type { ReactNode } from 'react';
import type { HasilVerifikasi } from '../../domain/lisensi';
import { AktivasiPanel } from './AktivasiPanel';
import { Dialog } from './Dialog';

export interface FullVersionDialogProps {
  fitur: string;
  aktivasi: (teks: string) => Promise<HasilVerifikasi>;
  onClose: () => void;
}

export function FullVersionDialog({ fitur, aktivasi, onClose }: FullVersionDialogProps): ReactNode {
  return (
    <Dialog
      open
      title="Fitur Full Version"
      onClose={onClose}
      actions={
        <button type="button" className="btn" onClick={onClose}>
          Tutup
        </button>
      }
    >
      <AktivasiPanel fitur={fitur} aktivasi={aktivasi} onAktif={onClose} />
    </Dialog>
  );
}
