// Persistensi IndexedDB dan mode offline dengan service worker.
// Validates: Requirements 10.2, 11.5, 11.8

import { expect, test, type Page } from '@playwright/test';
import { countDb, isoDate, openApp, openDialog, waitForPasienList } from './helpers';

const NAMA = 'Dewi Lestari Ñandú';
const NAMA_UBAH = 'Dewi Lestari Ñandú (ubah)';

async function tambahPasien(page: Page, nama: string, noHp: string): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Pasien' }).click();
  await page.getByRole('button', { name: '+ Tambah Pasien' }).click();
  const dlg = openDialog(page);
  await dlg.getByLabel('Nama').fill(nama);
  await dlg.getByLabel('Alamat').fill('Jl. Melati No. 7, Yogyakarta');
  await dlg.getByLabel('Nomor HP').fill(noHp);
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Data pasien berhasil disimpan').last()).toBeVisible();
  await expect(dlg).toHaveCount(0);
}

async function tambahSesi(page: Page, nama: string, biaya: string): Promise<void> {
  await page.getByRole('link', { name: nama, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: nama })).toBeVisible();
  await page.getByRole('button', { name: 'Tambah sesi' }).click();
  const dlg = openDialog(page);
  await dlg.getByLabel('Keluhan').fill('Pusing dan pegal');
  await dlg.getByLabel('Terapi yang diberikan').fill('Bekam');
  await dlg.getByLabel('Biaya (Rp)').fill(biaya);
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Sesi terapi berhasil disimpan').last()).toBeVisible();
  await expect(dlg).toHaveCount(0);
}

/** Pilih opsi pasien berdasarkan awalan nama (label opsi: "Nama (noHp)"). */
async function pilihPasien(page: Page, nama: string): Promise<void> {
  const select = openDialog(page).getByLabel('Pasien');
  const value = await select.locator('option').evaluateAll(
    (opts, n) => (opts as HTMLOptionElement[]).find((o) => o.textContent?.startsWith(`${n} (`))?.value ?? '',
    nama,
  );
  expect(value).not.toBe('');
  await select.selectOption(value);
}

async function tambahJadwalUntuk(page: Page, nama: string, jam: string): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Jadwal' }).click();
  await page.getByRole('button', { name: '+ Tambah Jadwal' }).click();
  const dlg = openDialog(page);
  await pilihPasien(page, nama);
  // Besok, agar tidak ditolak sebagai waktu yang sudah lewat.
  const besok = new Date();
  besok.setDate(besok.getDate() + 1);
  await dlg.getByLabel('Tanggal').fill(isoDate(besok));
  await dlg.getByLabel('Jam').fill(jam);
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Jadwal kunjungan berhasil disimpan').last()).toBeVisible();
  await expect(dlg).toHaveCount(0);
}

async function hapusPasien(page: Page, nama: string): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Pasien' }).click();
  await page.getByRole('button', { name: `Hapus ${nama}`, exact: true }).click();
  await openDialog(page).getByRole('button', { name: 'Hapus', exact: true }).click();
  await expect(page.getByText('Data pasien berhasil dihapus').last()).toBeVisible();
}

async function ubahPasien(page: Page, nama: string, namaBaru: string): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'Pasien' }).click();
  await page.getByRole('button', { name: `Ubah ${nama}`, exact: true }).click();
  const dlg = openDialog(page);
  await dlg.getByLabel('Nama').fill(namaBaru);
  await dlg.getByRole('button', { name: 'Simpan' }).click();
  await expect(page.getByText('Perubahan data pasien berhasil disimpan').last()).toBeVisible();
}

/** Menunggu service worker aktif dan mengendalikan halaman (precache selesai). */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => navigator.serviceWorker.controller !== null))) {
    await page.reload();
  }
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test.describe('Persistensi data setelah reload (Req 10.2)', () => {
  test('tambah, ubah, hapus tetap tercermin setelah muat ulang', async ({ page }) => {
    await openApp(page);
    await waitForPasienList(page);
    await expect(page.getByText('Belum ada data pasien')).toBeVisible();

    await tambahPasien(page, NAMA, '081298765432');
    await tambahPasien(page, 'Agus Salim', '6281311112222');
    await tambahSesi(page, NAMA, '150000');
    await tambahJadwalUntuk(page, NAMA, '10:15');

    // Reload mempertahankan hash (#/jadwal); kembali ke Halaman_Utama setelahnya.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Jadwal' })).toBeVisible();
    await page.getByRole('navigation').getByRole('link', { name: 'Pasien' }).click();
    await waitForPasienList(page);
    await expect(page.getByTestId('pasien-item')).toHaveCount(2);
    await expect(page.getByRole('link', { name: NAMA, exact: true })).toBeVisible();
    expect(await countDb(page)).toEqual({ pasien: 2, sesi: 1, jadwal: 1 });

    await page.getByRole('link', { name: NAMA, exact: true }).click();
    await expect(page.getByTestId('jumlah-sesi')).toHaveText('1');
    await expect(page.getByTestId('total-biaya')).toHaveText('Rp 150.000');
    await expect(page.getByText(/10:15/)).toBeVisible();

    // Ubah lalu hapus; setelah reload perubahan tetap dan rekaman terhapus tidak muncul lagi.
    await ubahPasien(page, NAMA, NAMA_UBAH);
    await hapusPasien(page, 'Agus Salim');
    await page.reload();
    await waitForPasienList(page);
    await expect(page.getByTestId('pasien-item')).toHaveCount(1);
    await expect(page.getByRole('link', { name: NAMA_UBAH, exact: true })).toBeVisible();
    await expect(page.getByText('Agus Salim')).toHaveCount(0);
    expect(await countDb(page)).toEqual({ pasien: 1, sesi: 1, jadwal: 1 });

    // Hapus pasien beserta sesi & jadwalnya, lalu reload: semua kosong.
    await hapusPasien(page, NAMA_UBAH);
    await page.reload();
    await waitForPasienList(page);
    await expect(page.getByText('Belum ada data pasien')).toBeVisible();
    expect(await countDb(page)).toEqual({ pasien: 0, sesi: 0, jadwal: 0 });
  });
});

test.describe('Mode offline setelah service worker terpasang (Req 11.5, 11.8)', () => {
  test('aplikasi terbuka dan CRUD berjalan tanpa internet, data utuh saat online kembali', async ({ page, context }) => {
    await openApp(page);
    await waitForServiceWorker(page);
    await tambahPasien(page, 'Pasien Online', '081200000001');

    await context.setOffline(true);
    // Muat ulang tanpa jaringan: dokumen & aset disajikan dari precache.
    await page.reload();
    await waitForPasienList(page);
    await expect(page.getByRole('link', { name: 'Pasien Online', exact: true })).toBeVisible();

    // Setiap halaman dapat dibuka langsung saat offline.
    for (const [hash, heading] of [
      ['#/jadwal', 'Jadwal'],
      ['#/laporan', 'Laporan Pemasukan'],
      ['#/cadangan', 'Cadangan'],
      ['#/', 'Pasien'],
    ] as const) {
      await page.goto(`/${hash}`);
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    }

    // Tambah, ubah, hapus saat offline.
    await tambahPasien(page, NAMA, '081298765432');
    await tambahSesi(page, NAMA, '75000');
    await tambahJadwalUntuk(page, NAMA, '13:45');
    await ubahPasien(page, NAMA, NAMA_UBAH);
    await hapusPasien(page, 'Pasien Online');

    // Tidak ada pesan kesalahan koneksi / gagal di mana pun.
    await expect(page.getByText(/koneksi|offline|gagal/i)).toHaveCount(0);

    await page.reload();
    await waitForPasienList(page);
    await expect(page.getByTestId('pasien-item')).toHaveCount(1);

    // Kembali online: seluruh perubahan tetap ada, tanpa hilang atau ganda.
    await context.setOffline(false);
    await page.reload();
    await waitForPasienList(page);
    await expect(page.getByTestId('pasien-item')).toHaveCount(1);
    await expect(page.getByRole('link', { name: NAMA_UBAH, exact: true })).toBeVisible();
    await expect(page.getByText('Pasien Online')).toHaveCount(0);
    expect(await countDb(page)).toEqual({ pasien: 1, sesi: 1, jadwal: 1 });

    await page.getByRole('link', { name: NAMA_UBAH, exact: true }).click();
    await expect(page.getByTestId('jumlah-sesi')).toHaveText('1');
    await expect(page.getByTestId('total-biaya')).toHaveText('Rp 75.000');
  });
});
