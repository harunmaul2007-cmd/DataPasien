import { describe, expect, it } from 'vitest';
// @ts-expect-error modul .mjs tanpa deklarasi tipe
import { buatKode, buatPasanganKunci, jwkPublik } from '../../scripts/lisensi.mjs';
import {
  ekstrakKode,
  PESAN_KODE_TIDAK_DIKENALI,
  PESAN_KODE_TIDAK_VALID,
  verifikasiKode,
} from './lisensi';
import { KUNCI_PUBLIK_LISENSI } from './lisensiKunci';

const { privateKey } = buatPasanganKunci();
const kunciPublik = jwkPublik(privateKey) as JsonWebKey;
const kodeSah: string = buatKode('  Klinik@Contoh.ID ', privateKey, new Date(2026, 9, 26));

describe('verifikasiKode', () => {
  it('kode sah diterima; email dinormalisasi dan tanggal terbit terbaca', async () => {
    const r = await verifikasiKode(kodeSah, kunciPublik);
    expect(r).toEqual({ ok: true, info: { email: 'klinik@contoh.id', diterbitkan: '2026-10-26', kode: kodeSah } });
  });

  it('toleran terhadap teks di sekitar kode dan pemotongan baris WhatsApp', async () => {
    const terpotong = `Kode aktivasi Anda:\n${kodeSah.slice(0, 40)}\n${kodeSah.slice(40)} \nTerima kasih`;
    const r = await verifikasiKode(terpotong, kunciPublik);
    expect(r.ok).toBe(true);
  });

  it('payload diubah (mis. email lain) → tidak valid', async () => {
    const [prefiks, , ttd] = kodeSah.split('.');
    const payloadLain = Buffer.from(JSON.stringify({ e: 'lain@contoh.id', t: '2026-10-26' })).toString('base64url');
    const r = await verifikasiKode(`${prefiks}.${payloadLain}.${ttd}`, kunciPublik);
    expect(r).toEqual({ ok: false, alasan: PESAN_KODE_TIDAK_VALID });
  });

  it('kode dari kunci lain → tidak valid', async () => {
    const lain = buatPasanganKunci();
    const kodeLain: string = buatKode('klinik@contoh.id', lain.privateKey);
    expect(await verifikasiKode(kodeLain, kunciPublik)).toEqual({ ok: false, alasan: PESAN_KODE_TIDAK_VALID });
    // Kunci publik bawaan aplikasi juga menolak kode dari kunci uji.
    expect((await verifikasiKode(kodeSah, KUNCI_PUBLIK_LISENSI)).ok).toBe(false);
  });

  it('teks acak / format salah → tidak dikenali', async () => {
    const ttd86 = 'A'.repeat(86);
    for (const teks of ['', 'halo', 'DP1.', 'DP1.abc', 'DP1.!!!.xyz', 'DP1.YWJj.c2ln', `DP1.YWJj.${ttd86}`]) {
      expect(await verifikasiKode(teks, kunciPublik)).toEqual({ ok: false, alasan: PESAN_KODE_TIDAK_DIKENALI });
    }
  });

  it('ekstrakKode membuang spasi dan mengambil kode lengkap', () => {
    expect(ekstrakKode(`  ${kodeSah.replace(/(.{20})/g, '$1 ')}  `)?.kode).toBe(kodeSah);
  });
});
