// Utilitas format dan tautan WhatsApp (Requirement 12).

/**
 * Nomor_WhatsApp: nomor HP dalam format internasional tanpa awalan "+".
 * - "081234567890"  → "6281234567890"
 * - "+6281234567890" → "6281234567890"
 * - "6281234567890"  → "6281234567890"
 */
export function nomorWhatsApp(noHp: string): string {
  const cleaned = noHp.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+62')) {
    return cleaned.slice(1);
  }
  if (cleaned.startsWith('0')) {
    return `62${cleaned.slice(1)}`;
  }
  return cleaned;
}

/**
 * Tautan_WhatsApp: "https://wa.me/{Nomor_WhatsApp}" untuk membuka chat langsung.
 */
export function tautanWhatsApp(noHp: string): string {
  return `https://wa.me/${nomorWhatsApp(noHp)}`;
}
