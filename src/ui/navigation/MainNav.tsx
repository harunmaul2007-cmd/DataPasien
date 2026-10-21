// Navigasi utama. Satu elemen <nav> yang ditata CSS:
// - < 768 px: bilah bawah tetap (Pasien, Jadwal, Laporan + ikon Cadangan)
// - ≥ 768 px: sidebar kiri yang selalu terlihat
// Setiap menu tercapai dalam satu ketukan dari halaman mana pun.

import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MAIN_NAV, ROUTES, SETTINGS_NAV, type NavItem } from './routes';

/** Menu aktif: Pasien juga aktif pada halaman detail pasien. */
export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.to === ROUTES.pasienList) return pathname === '/' || pathname.startsWith('/pasien/');
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

function NavItemLink({ item, iconOnly, pathname }: { item: NavItem; iconOnly?: boolean; pathname: string }): ReactNode {
  const active = isNavActive(item, pathname);
  return (
    <Link
      to={item.to}
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
  return (
    <nav className="nav" aria-label="Navigasi utama">
      <span className="nav__brand">Data Pasien</span>
      <ul className="nav__list">
        {MAIN_NAV.map((item) => (
          <li key={item.to} className="nav__item">
            <NavItemLink item={item} pathname={pathname} />
          </li>
        ))}
        <li className="nav__item nav__item--settings">
          <NavItemLink item={SETTINGS_NAV} iconOnly pathname={pathname} />
        </li>
      </ul>
    </nav>
  );
}
