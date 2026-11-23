import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { APP_INFO } from '../../domain/appInfo';
import { ROUTES } from '../navigation/routes';

/**
 * Header bilah atas aplikasi yang menampilkan logo "E-Data Pasien".
 * Ditampilkan di layar ponsel (< 768px); pada layar desktop disembunyikan
 * karena logo/nama merek sudah ditampilkan pada sidebar navigasi.
 */
export function AppHeader(): ReactNode {
  return (
    <header className="app-header">
      <Link to={ROUTES.pasienList} className="app-header__brand" aria-label={APP_INFO.namaAplikasi}>
        <img
          src="./logo-horizontal.png"
          alt={APP_INFO.namaAplikasi}
          className="app-header__logo"
          width="168"
          height="24"
        />
      </Link>
    </header>
  );
}
