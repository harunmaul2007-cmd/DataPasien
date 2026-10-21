// Definisi path rute aplikasi (hash router) (Req 7.8, 7.9).

export const ROUTES = {
  pasienList: '/',
  pasienDetail: '/pasien/:id',
  jadwal: '/jadwal',
  laporan: '/laporan',
  pengaturan: '/pengaturan',
  cadangan: '/cadangan',
} as const;

export function pasienDetailPath(id: string): string {
  return `/pasien/${encodeURIComponent(id)}`;
}

export interface NavItem {
  to: string;
  label: string;
  icon: string;
}

/** Empat menu utama (Req 7.8). */
export const MAIN_NAV: readonly NavItem[] = [
  { to: ROUTES.pasienList, label: 'Pasien', icon: '👤' },
  { to: ROUTES.jadwal, label: 'Jadwal', icon: '📅' },
  { to: ROUTES.laporan, label: 'Laporan', icon: '📊' },
  { to: ROUTES.pengaturan, label: 'Pengaturan', icon: '🏢' },
];

/** Menu cadangan tetap terpisah (Req 7.9). */
export const SETTINGS_NAV: NavItem = { to: ROUTES.cadangan, label: 'Cadangan', icon: '💾' };
