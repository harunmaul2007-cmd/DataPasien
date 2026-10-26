// Informasi aplikasi dan pengembang (creator).
import versionData from '../../version.json';

export interface AppInfo {
  namaAplikasi: string;
  deskripsiAplikasi: string;
  versionName: string;
  versionCode: number;
  creatorNama: string;
  creatorTagline: string;
  creatorLogoUrl: string;
  creatorDeskripsi: string;
}

export const APP_INFO: AppInfo = {
  namaAplikasi: 'Data Pasien',
  deskripsiAplikasi: 'Aplikasi Manajemen Pasien Terapi (PWA & APK Android)',
  versionName: versionData.versionName,
  versionCode: versionData.versionCode,
  creatorNama: 'Berkah Web Solution',
  creatorTagline: 'Solusi Website & Aplikasi Profesional',
  creatorLogoUrl: './berkah-web-solution.png',
  creatorDeskripsi: 'Pengembang solusi perangkat lunak terpercaya untuk sistem manajemen klinik, terapi, dan bisnis modern.',
};
