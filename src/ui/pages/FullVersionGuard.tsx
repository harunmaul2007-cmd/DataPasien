// Penjaga rute fitur Full Version (dipakai untuk halaman Pengaturan).
// Versi gratis melihat panel aktivasi sebagai ganti isi halaman.

import type { ReactNode } from 'react';
import { useLisensi } from '../../state/lisensi';
import { AktivasiPanel } from '../components/AktivasiPanel';

export function FullVersionGuard({ fitur, children }: { fitur: string; children: ReactNode }): ReactNode {
  const lisensi = useLisensi();
  if (lisensi.status === 'aktif') return children;
  if (lisensi.status === 'memeriksa') {
    return <p role="status">Memeriksa lisensi…</p>;
  }
  return (
    <section className="page" aria-labelledby="full-version-judul">
      <h1 id="full-version-judul">{fitur} 🔒</h1>
      <div className="card">
        <AktivasiPanel fitur={fitur} aktivasi={lisensi.aktivasi} />
      </div>
    </section>
  );
}
