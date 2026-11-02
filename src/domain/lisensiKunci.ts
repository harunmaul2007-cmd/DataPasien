// Kunci PUBLIK untuk memverifikasi kode aktivasi (aman untuk dikomit).
// Pasangan kunci privatnya hanya ada pada pembuat aplikasi (scripts/lisensi.mjs).
// Mengganti kunci ini membuat seluruh kode aktivasi lama tidak berlaku.

export const KUNCI_PUBLIK_LISENSI: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'uqj-IijwSvfECdh3eMt4OmwHv7lFWgY3QDjBRTkJwxA',
  y: 'IVk9c0y8OCEd2DIVZukBddr7dNGf36UgHDNxfaTyMHQ',
};

/** Kontak pembelian Full Version (pembayaran manual via WhatsApp). */
export const NOMOR_WA_PEMBELIAN = '0895412928467';
