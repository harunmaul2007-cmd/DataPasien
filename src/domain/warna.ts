// Definisi warna dan rasio kontras WCAG untuk Laporan PDF (Requirement 6.5).

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return { r, g, b };
}

export const WARNA = {
  teksUtama: hexToRgb('#1F2937'),
  latarPutih: hexToRgb('#FFFFFF'),
  judulBagian: hexToRgb('#134E4A'),
  latarAksenMuda: hexToRgb('#E6F4F1'),
  teksFooter: hexToRgb('#4B5563'),
  garisAksen: hexToRgb('#0F766E'),
  bingkaiPlaceholder: hexToRgb('#9CA3AF'),
} as const;

function luminanceChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(rgb: Rgb): number {
  return (
    0.2126 * luminanceChannel(rgb.r) +
    0.7152 * luminanceChannel(rgb.g) +
    0.0722 * luminanceChannel(rgb.b)
  );
}

export function rasioKontras(fg: Rgb, bg: Rgb): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}
