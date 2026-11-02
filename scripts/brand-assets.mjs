#!/usr/bin/env node
// Bangun aset merek dari satu logo: assets/logo-splash.png (logo lengkap,
// latar transparan, tulisan "E-Data Pasien" di bawah gambar).
//
// Keluaran:
// - assets/icon-only.png, icon-foreground.png, icon-background.png,
//   splash.png, splash-dark.png  → masukan `capacitor-assets generate --android`
// - public/icons/icon-192.png, icon-512.png, icon-maskable-512.png,
//   public/apple-touch-icon.png  → ikon PWA
// - public/splash-logo.png      → logo splash screen web
//
// Ikon hanya memakai bagian gambar (tanpa tulisan) agar tetap terbaca di
// ukuran kecil; splash memakai logo lengkap.
//
// Pemakaian: npm run brand:assets  (lalu npm run android:icons)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets', 'logo-splash.png');
const PUTIH = { r: 255, g: 255, b: 255, alpha: 1 };
const BENING = { r: 0, g: 0, b: 0, alpha: 0 };

/** Batas atas tulisan pada logo sumber (px); di atasnya hanya gambar. */
const BATAS_TULISAN = 735;

const out = (...p) => path.join(ROOT, ...p);

async function trimPng(input) {
  return sharp(await sharp(input).png().toBuffer()).trim({ threshold: 20 }).png().toBuffer();
}

/** Tempatkan gambar di tengah kanvas persegi `size` dengan skala `isi` (0–1). */
async function kanvas(gambar, size, isi, latar) {
  const target = Math.round(size * isi);
  const diskala = await sharp(gambar).resize(target, target, { fit: 'inside' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: latar } })
    .composite([{ input: diskala, gravity: 'center' }])
    .png({ compressionLevel: 9 });
}

async function main() {
  const meta = await sharp(SRC).metadata();
  const logoPenuh = await trimPng(SRC);
  const gambar = await trimPng(
    await sharp(SRC).extract({ left: 0, top: 0, width: meta.width, height: BATAS_TULISAN }).png().toBuffer(),
  );

  // Masukan @capacitor/assets (Android). Foreground adaptif: area aman ~66%.
  await (await kanvas(gambar, 1024, 0.86, PUTIH)).toFile(out('assets', 'icon-only.png'));
  await (await kanvas(gambar, 1024, 0.62, BENING)).toFile(out('assets', 'icon-foreground.png'));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: PUTIH } })
    .png()
    .toFile(out('assets', 'icon-background.png'));
  await (await kanvas(logoPenuh, 2732, 0.42, PUTIH)).toFile(out('assets', 'splash.png'));
  await (await kanvas(logoPenuh, 2732, 0.42, PUTIH)).toFile(out('assets', 'splash-dark.png'));

  // Ikon PWA.
  await (await kanvas(gambar, 192, 0.86, PUTIH)).toFile(out('public', 'icons', 'icon-192.png'));
  await (await kanvas(gambar, 512, 0.86, PUTIH)).toFile(out('public', 'icons', 'icon-512.png'));
  await (await kanvas(gambar, 512, 0.66, PUTIH)).toFile(out('public', 'icons', 'icon-maskable-512.png'));
  await (await kanvas(gambar, 180, 0.86, PUTIH)).toFile(out('public', 'apple-touch-icon.png'));

  // Logo splash web (lebar 640 px cukup tajam untuk layar 3x pada lebar tampil ~200 px).
  await sharp(logoPenuh)
    .resize({ width: 640 })
    .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
    .toFile(out('public', 'splash-logo.png'));

  console.log('Aset merek dibuat. Jalankan "npm run android:icons" untuk ikon & splash Android.');
}

/**
 * Pasca `capacitor-assets`: hapus splash mode gelap (isinya sama dengan mode
 * terang; Android otomatis memakai drawable biasa) dan kompres splash tersisa
 * dengan palet warna agar APK lebih kecil.
 */
async function rapikanSplashAndroid() {
  const { readdirSync, rmSync, statSync, writeFileSync } = await import('node:fs');
  const res = out('android', 'app', 'src', 'main', 'res');
  let sebelum = 0;
  let sesudah = 0;
  for (const dir of readdirSync(res)) {
    const file = path.join(res, dir, 'splash.png');
    let ukuran;
    try {
      ukuran = statSync(file).size;
    } catch {
      continue;
    }
    sebelum += ukuran;
    if (dir.includes('-night')) {
      rmSync(path.join(res, dir), { recursive: true, force: true });
      continue;
    }
    const buf = await sharp(file).png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 }).toBuffer();
    if (buf.length < ukuran) writeFileSync(file, buf);
    sesudah += Math.min(buf.length, ukuran);
  }
  console.log(`Splash Android: ${Math.round(sebelum / 1024)} KB -> ${Math.round(sesudah / 1024)} KB`);
}

if (process.argv.includes('--android-pasca')) await rapikanSplashAndroid();
else await main();
