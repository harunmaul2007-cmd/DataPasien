import type { ReactNode } from 'react';
import { useAppTheme } from '../theme';
import { useToast } from './Toast';

export function ThemePicker(): ReactNode {
  const { currentTheme, setTheme, themes } = useAppTheme();
  const toast = useToast();

  const handleSelect = (id: string, nama: string) => {
    setTheme(id);
    toast.success(`Tema "${nama}" berhasil diterapkan`);
  };

  return (
    <div className="theme-picker-grid" role="radiogroup" aria-label="Pilihan Tema Aplikasi">
      {themes.map((t) => {
        const isActive = t.id === currentTheme;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={`theme-card${isActive ? ' theme-card--active' : ''}`}
            onClick={() => handleSelect(t.id, t.nama)}
            style={{
              backgroundColor: t.preview.surface,
              borderColor: isActive ? t.preview.primary : t.preview.border,
            }}
          >
            <div className="theme-card__header">
              <span className="theme-card__nama" style={{ color: t.preview.text }}>
                {t.nama}
              </span>
              {isActive && <span className="theme-card__badge">Aktif</span>}
            </div>
            <p className="theme-card__desc" style={{ color: t.isDark ? '#94a3b8' : '#64748b' }}>
              {t.deskripsi}
            </p>
            <div
              className="theme-card__preview"
              style={{
                backgroundColor: t.preview.bg,
                borderColor: t.preview.border,
              }}
            >
              <span
                className="theme-swatch"
                title="Latar Belakang"
                style={{ backgroundColor: t.preview.bg }}
              />
              <span
                className="theme-swatch"
                title="Permukaan / Kartu"
                style={{ backgroundColor: t.preview.surface }}
              />
              <span
                className="theme-swatch"
                title="Warna Utama"
                style={{ backgroundColor: t.preview.primary }}
              />
              <span
                className="theme-swatch"
                title="Warna Teks"
                style={{ backgroundColor: t.preview.text }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
