// Konfigurasi dan pengelolaan tema visual aplikasi.

import { useEffect, useState } from 'react';

export interface ThemeInfo {
  id: string;
  nama: string;
  deskripsi: string;
  isDark: boolean;
  preview: {
    bg: string;
    surface: string;
    primary: string;
    text: string;
    border: string;
  };
}

export const THEMES: readonly ThemeInfo[] = [
  {
    id: 'medis-biru',
    nama: 'Biru Medis',
    deskripsi: 'Tema standar bernuansa biru klinis yang bersih dan profesional.',
    isDark: false,
    preview: {
      bg: '#f6f7f9',
      surface: '#ffffff',
      primary: '#0b5cad',
      text: '#1b1f24',
      border: '#d0d5dc',
    },
  },
  {
    id: 'emerald-sehat',
    nama: 'Hijau Sehat',
    deskripsi: 'Nuansa herbal dan kesegaran alami dengan aksen hijau emerald.',
    isDark: false,
    preview: {
      bg: '#f0fdf4',
      surface: '#ffffff',
      primary: '#0d9488',
      text: '#0f172a',
      border: '#bbf7d0',
    },
  },
  {
    id: 'midnight-dark',
    nama: 'Midnight Dark',
    deskripsi: 'Mode gelap elegan bernuansa slate yang nyaman untuk mata di kondisi redup.',
    isDark: true,
    preview: {
      bg: '#0f172a',
      surface: '#1e293b',
      primary: '#38bdf8',
      text: '#f8fafc',
      border: '#334155',
    },
  },
  {
    id: 'amethyst-ungu',
    nama: 'Ungu Elegan',
    deskripsi: 'Sentuhan warna violet kerajaan yang mewah dan menenangkan.',
    isDark: false,
    preview: {
      bg: '#faf5ff',
      surface: '#ffffff',
      primary: '#7c3aed',
      text: '#1e1b4b',
      border: '#e9d5ff',
    },
  },
  {
    id: 'sunset-hangat',
    nama: 'Sunset Krem',
    deskripsi: 'Kombinasi warna krem hangat dan terracotta yang ramah dan bersahabat.',
    isDark: false,
    preview: {
      bg: '#fff7ed',
      surface: '#ffffff',
      primary: '#ea580c',
      text: '#27272a',
      border: '#fed7aa',
    },
  },
  {
    id: 'cyber-dark',
    nama: 'Obsidian OLED',
    deskripsi: 'Mode gelap pekat dengan kontras tajam dan aksen hijau neon.',
    isDark: true,
    preview: {
      bg: '#000000',
      surface: '#121214',
      primary: '#10b981',
      text: '#fafafa',
      border: '#27272a',
    },
  },
];

export const THEME_STORAGE_KEY = 'datapasien-theme';
export const DEFAULT_THEME_ID = 'medis-biru';

export function getSavedTheme(): string {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && THEMES.some((t) => t.id === saved)) {
      return saved;
    }
  } catch {
    // Abaikan jika localStorage tidak dapat diakses (mis. private mode ketat)
  }
  return DEFAULT_THEME_ID;
}

export function applyTheme(themeId: string): void {
  const targetTheme = THEMES.some((t) => t.id === themeId) ? themeId : DEFAULT_THEME_ID;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', targetTheme);
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, targetTheme);
  } catch {
    // Abaikan kesalahan penulisan localStorage
  }
  // Notifikasi perubahan tema jika ada listener kustom
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: targetTheme }));
  }
}

/** Hook React untuk membaca dan mengganti tema aplikasi */
export function useAppTheme(): {
  currentTheme: string;
  setTheme: (id: string) => void;
  themes: readonly ThemeInfo[];
} {
  const [theme, setCurrentThemeState] = useState<string>(() => getSavedTheme());

  useEffect(() => {
    // Sinkronkan tema awal ke DOM
    applyTheme(theme);

    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail && customEvent.detail !== theme) {
        setCurrentThemeState(customEvent.detail);
      }
    };

    window.addEventListener('app-theme-changed', handleThemeChange);
    return () => {
      window.removeEventListener('app-theme-changed', handleThemeChange);
    };
  }, [theme]);

  const setTheme = (id: string) => {
    setCurrentThemeState(id);
    applyTheme(id);
  };

  return {
    currentTheme: theme,
    setTheme,
    themes: THEMES,
  };
}
