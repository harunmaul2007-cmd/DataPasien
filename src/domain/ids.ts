// Pembangkit identitas unik rekaman (UUID v4).

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Menghasilkan UUID v4 baru via `crypto.randomUUID`. */
export function newId(): string {
  return crypto.randomUUID();
}

/** True jika `s` adalah UUID v4 yang sah. */
export function isUuidV4(s: string): boolean {
  return UUID_V4.test(s);
}
