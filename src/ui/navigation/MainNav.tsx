// Navigasi utama. Satu elemen <nav> yang ditata CSS:
// - < 768 px: bilah bawah tetap (Pasien, Jadwal, Laporan + ikon Cadangan)
// - ≥ 768 px: sidebar kiri yang selalu terlihat
// Setiap menu tercapai dalam satu ketukan dari halaman mana pun.

import type { MouseEvent, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { APP_INFO } from '../../domain/appInfo';
import { useLisensi } from '../../state/lisensi';
import { MAIN_NAV, ROUTES, SETTINGS_NAV, type NavItem } from './routes';

/** Menu aktif: Pasien juga aktif pada halaman detail pasien. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.to === ROUTES.pasienList) return pathname === '/' || pathname.startsWith('/pasien/');
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavItemLink({
  item,
  iconOnly,
  pathname,
  onClick,
}: {
  item: NavItem;
  iconOnly?: boolean;
  pathname: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}): ReactNode {
  const active = isNavActive(item, pathname);
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={`nav__link${active ? ' nav__link--active' : ''}${iconOnly ? ' nav__link--settings' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={iconOnly ? item.label : undefined}
    >
      <span className="nav__icon" aria-hidden="true">
        {item.icon}
      </span>
      <span className="nav__label">{item.label}</span>
    </Link>
  );
}

export function MainNav(): ReactNode {
  const { pathname } = useLocation();
  const lisensi = useLisensi();
  // Pengaturan = fitur Full Version: pada versi gratis tampilkan dialog aktivasi.
  const klikTerkunci = (item: NavItem) =>
    item.to === ROUTES.pengaturan && lisensi.status === 'gratis'
      ? (e: MouseEvent<HTMLAnchorElement>) => {
          e.preventDefault();
          lisensi.minta(item.label);
        }
      : undefined;
  return (
    <nav className="nav" aria-label="Navigasi utama">
      <span className="nav__brand">{APP_INFO.namaAplikasi}</span>
      <ul className="nav__list">
        {MAIN_NAV.map((item) => (
          <li key={item.to} className="nav__item">
            <NavItemLink item={item} pathname={pathname} onClick={klikTerkunci(item)} />
          </li>
        ))}
        <li className="nav__item nav__item--settings">
          <NavItemLink item={SETTINGS_NAV} iconOnly pathname={pathname} />
        </li>
      </ul>
      <div className="nav__footer" aria-hidden="true">
        <span className="nav__footer-brand">{APP_INFO.creatorNama}</span>
        <span>v{APP_INFO.versionName}</span>
      </div>
    </nav>
  );
}
