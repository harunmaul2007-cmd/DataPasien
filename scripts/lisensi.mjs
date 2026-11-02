#!/usr/bin/env node
// Alat pembuat aplikasi untuk kode aktivasi Full Version.
//
//   npm run lisensi -- keygen               Buat pasangan kunci (sekali saja)
//   npm run lisensi -- buat <email>         Terbitkan kode aktivasi untuk email
//
// Setiap kode yang diterbitkan dicatat di lisensi-terbit.csv (folder yang sama
// dengan kunci privat): waktu, email, kode.
//
// Kunci privat disimpan DI LUAR repositori (default
// ~/.datapasien/lisensi-private.pem, atau env DATAPASIEN_LISENSI_KEY).
// JANGAN pernah mengomit / membagikan kunci privat. Jika hilang, kode baru
// tidak dapat diterbitkan untuk aplikasi yang sudah beredar.

import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PREFIKS_KODE = 'DP1';
export const POLA_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function lokasiKunciDefault(env = process.env) {
  return env.DATAPASIEN_LISENSI_KEY || path.join(os.homedir(), '.datapasien', 'lisensi-private.pem');
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/** Normalisasi email: trim + huruf kecil. Melempar bila format tidak valid. */
export function normalisasiEmail(email) {
  const e = String(email ?? '').trim().toLowerCase();
  if (!POLA_EMAIL.test(e)) throw new Error(`Email tidak valid: "${email}"`);
  return e;
}

/**
 * Terbitkan kode "DP1.<payload>.<ttd>" untuk email.
 * @param {string} email
 * @param {import('node:crypto').KeyObject | string} kunciPrivat KeyObject atau PEM
 * @param {Date} [now]
 */
export function buatKode(email, kunciPrivat, now = new Date()) {
  const e = normalisasiEmail(email);
  const t = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const payload = b64url(JSON.stringify({ e, t }));
  const pesan = `${PREFIKS_KODE}.${payload}`;
  const key = typeof kunciPrivat === 'string' ? createPrivateKey(kunciPrivat) : kunciPrivat;
  const ttd = sign('sha256', Buffer.from(pesan, 'ascii'), { key, dsaEncoding: 'ieee-p1363' });
  return `${pesan}.${b64url(ttd)}`;
}

/** Kunci publik dalam bentuk JWK minimal (kty, crv, x, y) untuk ditanam di aplikasi. */
export function jwkPublik(kunciPrivatAtauPublik) {
  const pub = createPublicKey(kunciPrivatAtauPublik);
  const { kty, crv, x, y } = pub.export({ format: 'jwk' });
  return { kty, crv, x, y };
}

/** Riwayat kode terbit (CSV), disimpan di samping kunci privat, di luar repositori. */
export function lokasiRiwayat(lokasiKunci = lokasiKunciDefault()) {
  return path.join(path.dirname(lokasiKunci), 'lisensi-terbit.csv');
}

const csvSel = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Tambahkan satu baris "waktu,email,kode" ke riwayat; buat file + header bila belum ada. */
export function catatRiwayat(file, email, kode, now = new Date()) {
  mkdirSync(path.dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, 'waktu,email,kode\n', 'utf8');
  appendFileSync(file, `${[now.toISOString(), email, kode].map(csvSel).join(',')}\n`, 'utf8');
}

export function buatPasanganKunci() {
  return generateKeyPairSync('ec', { namedCurve: 'P-256' });
}

function main(argv) {
  const [perintah, ...arg] = argv;
  const lokasi = lokasiKunciDefault();

  if (perintah === 'keygen') {
    if (existsSync(lokasi)) {
      console.error(`Kunci sudah ada di ${lokasi}. Tidak ditimpa (kode lama akan tidak berlaku).`);
      return 1;
    }
    const { privateKey } = buatPasanganKunci();
    mkdirSync(path.dirname(lokasi), { recursive: true });
    writeFileSync(lokasi, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    console.log(`Kunci privat disimpan: ${lokasi}`);
    console.log('SIMPAN CADANGANNYA di tempat aman. Jangan dikomit ke git.\n');
    console.log('Tempel kunci publik ini ke src/domain/lisensiKunci.ts:');
    console.log(JSON.stringify(jwkPublik(privateKey), null, 2));
    return 0;
  }

  if (perintah === 'buat') {
    if (!arg[0]) {
      console.error('Pemakaian: npm run lisensi -- buat <email>');
      return 1;
    }
    if (!existsSync(lokasi)) {
      console.error(`Kunci privat tidak ditemukan di ${lokasi}. Jalankan "npm run lisensi -- keygen" dulu.`);
      return 1;
    }
    const email = normalisasiEmail(arg[0]);
    const kode = buatKode(email, readFileSync(lokasi, 'utf8'));
    const riwayat = lokasiRiwayat(lokasi);
    catatRiwayat(riwayat, email, kode);
    console.log(`Email : ${email}`);
    console.log(`Kode  : ${kode}`);
    console.log(`Dicatat di: ${riwayat}\n`);
    console.log('Pesan siap kirim:');
    console.log(
      `Terima kasih telah membeli Full Version E-Data Pasien.\nBuka aplikasi > Pengaturan (atau fitur terkunci), lalu tempel kode aktivasi berikut:\n\n${kode}`,
    );
    return 0;
  }

  console.error('Perintah: keygen | buat <email>');
  return 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
