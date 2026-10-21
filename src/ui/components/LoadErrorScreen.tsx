// Layar saat data gagal dimuat (Req 10.6). Tidak ada operasi tulis yang
// diizinkan DataStore sampai pemuatan berhasil, sehingga data tersimpan aman.

import type { ReactNode } from 'react';

export function LoadErrorScreen(props: { onRetry: () => void }): ReactNode {
  return (
    <section className="status-screen" aria-labelledby="load-error-title">
      <div role="alert">
        <h1 id="load-error-title">Data gagal dimuat</h1>
        <p>Data tersimpan tidak diubah. Silakan coba lagi.</p>
      </div>
      <button type="button" className="btn btn--primary" onClick={props.onRetry}>
        Coba lagi
      </button>
    </section>
  );
}

export function LoadingScreen(): ReactNode {
  return (
    <section className="status-screen" aria-busy="true">
      <p role="status">Memuat data…</p>
    </section>
  );
}
