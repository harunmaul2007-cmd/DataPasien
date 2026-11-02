// Splash screen (#splash di index.html): dilepas setelah data selesai dimuat
// (berhasil maupun gagal) dan sudah tampil minimal `minimumMs`, lalu memudar.

export const SPLASH_MINIMUM_MS = 1000;
export const SPLASH_FADE_MS = 300;

export interface SembunyikanSplashOptions {
  /** Selesai saat aplikasi siap (hasil/galat diabaikan). */
  siap: Promise<unknown>;
  minimumMs?: number;
  fadeMs?: number;
  doc?: Document;
  /** Waktu mulai tampil (ms, performance.now()); default saat ini. */
  mulai?: number;
  now?: () => number;
}

export async function sembunyikanSplash({
  siap,
  minimumMs = SPLASH_MINIMUM_MS,
  fadeMs = SPLASH_FADE_MS,
  doc = document,
  now = () => performance.now(),
  mulai = now(),
}: SembunyikanSplashOptions): Promise<void> {
  const el = doc.getElementById('splash');
  if (!el) return;
  await siap.catch(() => undefined);
  const sisa = minimumMs - (now() - mulai);
  if (sisa > 0) await new Promise((r) => setTimeout(r, sisa));
  el.classList.add('splash--keluar');
  await new Promise((r) => setTimeout(r, fadeMs));
  el.remove();
}
