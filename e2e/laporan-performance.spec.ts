// Laporan_Pemasukan tampil < 2 detik dengan 5.000 Sesi_Terapi.
// Validates: Requirements 9.1, 9.2

import { expect, test } from '@playwright/test';
import { openApp, rupiah, seedDb, waitForPasienList, type SeedData, type SeedSesi } from './helpers';

const JUMLAH_SESI = 5000;
const JUMLAH_PASIEN = 200;
const BATAS_MS = 2000;

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const p2 = (n: number) => String(n).padStart(2, '0');

/**
 * 5.000 sesi: separuh pada bulan berjalan (kasus terberat untuk rincian),
 * seperempat pada bulan sebelumnya, sisanya tersebar di tahun-tahun lalu.
 */
function buatData(today: Date): SeedData {
  const now = Date.now();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const pasien = Array.from({ length: JUMLAH_PASIEN }, (_, i) => ({
    id: `p-${i}`,
    nama: `Pasien ${p2(Math.floor(i / 100))}${p2(i % 100)}`,
    alamat: `Alamat ${i}`,
    noHp: `0812${10_000_000 + i}`,
    createdAt: now,
    updatedAt: now,
  }));
  const sesi: SeedSesi[] = Array.from({ length: JUMLAH_SESI }, (_, i) => {
    const [tahun, bulan] =
      i % 2 === 0 ? [y, m] : i % 4 === 1 ? [prevY, prevM] : [y - 2 - (i % 3), (i % 12) + 1];
    return {
      id: `s-${i}`,
      pasienId: `p-${(i * 7) % JUMLAH_PASIEN}`,
      tanggal: `${tahun}-${p2(bulan)}-${p2((i % 28) + 1)}`,
      keluhan: `Keluhan ${i}`,
      polaPenyakit: '',
      terapi: `Terapi ${i % 13}`,
      hasil: '',
      biaya: (i % 10) * 25_000, // termasuk biaya 0
      createdAt: now + i,
      updatedAt: now + i,
    };
  });
  return { pasien, sesi, jadwal: [] };
}

function harapan(sesi: SeedSesi[], bulan: number, tahun: number) {
  const prefix = `${tahun}-${p2(bulan)}-`;
  const lolos = sesi.filter((s) => s.tanggal.startsWith(prefix));
  return {
    total: lolos.reduce((a, s) => a + s.biaya, 0),
    sesi: lolos.length,
    pasien: new Set(lolos.map((s) => s.pasienId)).size,
  };
}

test('laporan bulan berjalan dan pergantian filter tampil < 2 detik dengan 5.000 sesi', async ({ page }) => {
  const now = new Date();
  const data = buatData(now);
  const bulanIni = harapan(data.sesi, now.getMonth() + 1, now.getFullYear());
  const prevM = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const bulanLalu = harapan(data.sesi, prevM, prevY);

  await openApp(page);
  await seedDb(page, data);
  await page.reload();
  await waitForPasienList(page);
  await expect(page.getByTestId('pasien-item')).toHaveCount(JUMLAH_PASIEN);

  // Req 9.1: membuka halaman laporan → laporan bulan & tahun berjalan tampil.
  const t0 = Date.now();
  await page.getByRole('navigation').getByRole('link', { name: 'Laporan' }).click();
  await expect(page.getByTestId('laporan-total')).toHaveText(rupiah(bulanIni.total), { timeout: BATAS_MS });
  await expect(page.locator('.laporan__item')).toHaveCount(bulanIni.sesi, { timeout: BATAS_MS });
  const bukaMs = Date.now() - t0;
  console.log(`Laporan dibuka dalam ${bukaMs} ms (${bulanIni.sesi} rincian)`);
  expect(bukaMs).toBeLessThan(BATAS_MS);
  await expect(page.getByTestId('laporan-jumlah-sesi')).toHaveText(String(bulanIni.sesi));
  await expect(page.getByTestId('laporan-jumlah-pasien')).toHaveText(String(bulanIni.pasien));

  // Filter default = bulan & tahun berjalan.
  await expect(page.getByLabel('Bulan')).toHaveValue(String(now.getMonth() + 1));
  await expect(page.getByLabel('Tahun')).toHaveValue(String(now.getFullYear()));

  // Req 9.2: mengganti filter memperbarui laporan < 2 detik.
  const t1 = Date.now();
  await page.getByLabel('Tahun').selectOption(String(prevY));
  await page.getByLabel('Bulan').selectOption({ label: NAMA_BULAN[prevM - 1]! });
  await expect(page.getByTestId('laporan-total')).toHaveText(rupiah(bulanLalu.total), { timeout: BATAS_MS });
  await expect(page.locator('.laporan__item')).toHaveCount(bulanLalu.sesi, { timeout: BATAS_MS });
  const filterMs = Date.now() - t1;
  console.log(`Filter diperbarui dalam ${filterMs} ms (${bulanLalu.sesi} rincian)`);
  expect(filterMs).toBeLessThan(BATAS_MS);
  await expect(page.getByTestId('laporan-jumlah-pasien')).toHaveText(String(bulanLalu.pasien));
});
