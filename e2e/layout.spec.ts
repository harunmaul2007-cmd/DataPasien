// Tata letak responsif dan navigasi utama.
// Validates: Requirements 11.1, 11.2, 11.3, 11.6

import { expect, test, type Page } from '@playwright/test';
import { expectCleanLayout, openApp, openDialog, sampleData, seedDb } from './helpers';

const WIDTHS = [360, 414, 768, 1024, 1440, 1920] as const;
const HEIGHT = 800;

const PAGES: { name: string; hash: string; heading: string }[] = [
  { name: 'daftar pasien', hash: '#/', heading: 'Pasien' },
  { name: 'detail pasien', hash: '#/pasien/p-1', heading: 'Siti Nurhaliza' },
  { name: 'jadwal', hash: '#/jadwal', heading: 'Jadwal' },
  { name: 'laporan', hash: '#/laporan', heading: 'Laporan Pemasukan' },
  { name: 'cadangan', hash: '#/cadangan', heading: 'Cadangan' },
];

async function gotoPage(page: Page, hash: string, heading: string): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

test.describe('Tata letak tanpa scroll horizontal dan area sentuh ≥ 44×44', () => {
  for (const width of WIDTHS) {
    test(`lebar ${width}px: semua halaman dan formulir`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await openApp(page);
      await seedDb(page, sampleData());
      // Navigasi hash tidak memuat ulang dokumen; reload agar DataStore membaca data seed.
      await page.reload();

      for (const p of PAGES) {
        await gotoPage(page, p.hash, p.heading);
        await expectCleanLayout(page, `${p.name} @ ${width}px`);
      }

      // Formulir (dialog modal) diperiksa terbatas pada isi dialog.
      await gotoPage(page, '#/', 'Pasien');
      await page.getByRole('button', { name: '+ Tambah Pasien' }).click();
      await expect(openDialog(page)).toBeVisible();
      await expectCleanLayout(page, `formulir pasien @ ${width}px`, 'dialog[open]');
      // Tampilan kesalahan validasi juga tidak boleh merusak tata letak.
      await openDialog(page).getByRole('button', { name: 'Simpan' }).click();
      await expect(openDialog(page).getByText('Nama wajib diisi')).toBeVisible();
      await expectCleanLayout(page, `formulir pasien (error) @ ${width}px`, 'dialog[open]');
      await openDialog(page).getByRole('button', { name: 'Batal' }).click();

      await page.getByRole('button', { name: /^Hapus Siti/ }).click();
      await expect(openDialog(page)).toBeVisible();
      await expectCleanLayout(page, `konfirmasi hapus @ ${width}px`, 'dialog[open]');
      await openDialog(page).getByRole('button', { name: 'Batal' }).click();

      await gotoPage(page, '#/pasien/p-1', 'Siti Nurhaliza');
      await page.getByRole('button', { name: 'Tambah sesi' }).click();
      await expect(openDialog(page)).toBeVisible();
      await expectCleanLayout(page, `formulir sesi @ ${width}px`, 'dialog[open]');
      await openDialog(page).getByRole('button', { name: 'Batal' }).click();

      await gotoPage(page, '#/jadwal', 'Jadwal');
      await page.getByRole('button', { name: '+ Tambah Jadwal' }).click();
      await expect(openDialog(page)).toBeVisible();
      await expectCleanLayout(page, `formulir jadwal @ ${width}px`, 'dialog[open]');
      await openDialog(page).getByRole('button', { name: 'Batal' }).click();
    });
  }
});

test.describe('Navigasi utama: menu bawah (< 768 px) vs sidebar (≥ 768 px)', () => {
  const MENU = [
    { label: 'Pasien', heading: 'Pasien' },
    { label: 'Jadwal', heading: 'Jadwal' },
    { label: 'Laporan', heading: 'Laporan Pemasukan' },
  ];

  for (const width of [360, 414, 767, 768, 1024, 1440, 1920]) {
    const mode = width < 768 ? 'menu bawah' : 'sidebar';
    test(`lebar ${width}px menampilkan ${mode}`, async ({ page }) => {
      await page.setViewportSize({ width, height: HEIGHT });
      await openApp(page);
      const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
      await expect(nav).toBeVisible();

      const box = (await nav.boundingBox())!;
      if (width < 768) {
        // Bilah bawah selebar layar, menempel di dasar viewport.
        expect(box.x).toBeCloseTo(0, 0);
        expect(box.width).toBeCloseTo(width, 0);
        expect(box.y + box.height).toBeCloseTo(HEIGHT, 0);
        expect(box.height).toBeLessThan(120);
      } else {
        // Sidebar kiri setinggi layar.
        expect(box.x).toBeCloseTo(0, 0);
        expect(box.y).toBeCloseTo(0, 0);
        expect(box.height).toBeCloseTo(HEIGHT, 0);
        expect(box.width).toBeLessThan(width / 2);
      }

      // Setiap menu selalu terlihat dan tercapai dengan satu ketukan dari halaman mana pun.
      for (const from of ['#/', '#/pasien/p-x', '#/jadwal', '#/laporan', '#/cadangan']) {
        for (const item of MENU) {
          await page.goto(`/${from}`);
          const link = nav.getByRole('link', { name: item.label });
          await expect(link).toBeVisible();
          await expect(link).toBeInViewport({ ratio: 1 });
          await link.click();
          await expect(page.getByRole('heading', { level: 1, name: item.heading })).toBeVisible();
        }
      }

      // Pada sidebar, navigasi tetap terlihat setelah konten di-scroll.
      if (width >= 768) {
        await page.setViewportSize({ width, height: 400 });
        await page.goto('/#/laporan');
        await page.mouse.wheel(0, 2000);
        for (const item of MENU) await expect(nav.getByRole('link', { name: item.label })).toBeInViewport();
      }
    });
  }
});
