// Unit test halaman jadwal kunjungan.
// Requirements: 8.5, 8.9, 8.13, 8.14

import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JadwalKunjungan, Pasien } from '../../../domain/types';
import { DexieRepository, openRepository } from '../../../infra/repository';
import { DataStore, DataStoreProvider } from '../../../state/dataStore';
import { DialogStackProvider } from '../../components/DialogStack';
import { ToastProvider } from '../../components/Toast';
import { JadwalPage, JUDUL_TAWARAN_SESI, PESAN_TIDAK_ADA_JADWAL } from '../JadwalPage';

// Waktu tetap untuk validasi jadwal; jadwal uji berada setelah waktu ini.
const NOW = new Date(2025, 0, 1, 8, 0, 0);
const TANGGAL = '2025-03-10';

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

async function freshStore(): Promise<DataStore> {
  const repo = await openRepository(`test-jadwal-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  const store = new DataStore({ repository: repo, now: () => NOW });
  await store.load();
  return store;
}

async function seedPasien(store: DataStore, nama = 'Budi Santoso'): Promise<Pasien> {
  const r = await store.addPasien({ nama, alamat: 'Jl. Mawar 1', noHp: '081234567890' });
  if (!r.ok) throw new Error('seed pasien gagal');
  return r.value;
}

async function seedJadwal(store: DataStore, pasienId: string, jam = '09:30', tanggal = TANGGAL): Promise<JadwalKunjungan> {
  const r = await store.addJadwal({ pasienId, tanggal, jam, catatan: 'Kontrol' });
  if (!r.ok) throw new Error('seed jadwal gagal');
  return r.value;
}

function renderPage(store: DataStore) {
  return render(
    <DataStoreProvider store={store}>
      <DialogStackProvider>
        <ToastProvider duration={0}>
          <JadwalPage />
        </ToastProvider>
      </DialogStackProvider>
    </DataStoreProvider>,
  );
}

/** Field "Tanggal" milik halaman (bukan milik dialog formulir). */
function pilihTanggal(tanggal: string) {
  const section = screen.getByRole('region', { name: 'Jadwal' });
  const input = within(section).getAllByLabelText('Tanggal').find((el) => !el.closest('[role="dialog"]'))!;
  fireEvent.change(input, { target: { value: tanggal } });
}

const dialog = () => screen.getByRole('dialog');

describe('JadwalPage', () => {
  it('menampilkan pesan kosong bila tidak ada jadwal pada tanggal terpilih (Req 8.5)', async () => {
    const store = await freshStore();
    const p = await seedPasien(store);
    await seedJadwal(store, p.id);
    renderPage(store);

    pilihTanggal('2025-03-11');
    expect(screen.getByText(PESAN_TIDAK_ADA_JADWAL)).toBeInTheDocument();
    expect(screen.queryAllByTestId('jadwal-item')).toHaveLength(0);

    pilihTanggal(TANGGAL);
    expect(screen.queryByText(PESAN_TIDAK_ADA_JADWAL)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('jadwal-item')).toHaveLength(1);
  });

  it('Tandai Selesai → tawaran sesi; "Ya, catat sesi" membuka formulir sesi dengan tanggal jadwal (Req 8.9)', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    const p = await seedPasien(store);
    const j = await seedJadwal(store, p.id);
    renderPage(store);
    pilihTanggal(TANGGAL);

    await user.click(screen.getByRole('button', { name: 'Tandai Selesai Budi Santoso 09:30' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: JUDUL_TAWARAN_SESI })).toBeInTheDocument());
    expect(store.getState().data.jadwal.find((x) => x.id === j.id)?.status).toBe('Selesai');
    expect(screen.getByTestId('jadwal-status')).toHaveTextContent('Selesai');

    await user.click(within(dialog()).getByRole('button', { name: 'Ya, catat sesi' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Tambah Sesi Terapi' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: JUDUL_TAWARAN_SESI })).not.toBeInTheDocument();
    expect(within(dialog()).getByLabelText('Tanggal terapi')).toHaveValue(TANGGAL);

    // Mengisi dan menyimpan formulir mencatat sesi untuk pasien jadwal tersebut.
    const d = within(dialog());
    await user.type(d.getByLabelText('Keluhan'), 'Nyeri');
    await user.type(d.getByLabelText('Terapi yang diberikan'), 'Pijat');
    await user.type(d.getByLabelText('Biaya (Rp)'), '100000');
    await user.click(d.getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const sesi = store.getState().data.sesi;
    expect(sesi).toHaveLength(1);
    expect(sesi[0]).toMatchObject({ pasienId: p.id, tanggal: TANGGAL });
  });

  it('Tandai Selesai → "Tidak" menutup tawaran tanpa membuka formulir sesi (Req 8.9)', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    const p = await seedPasien(store);
    await seedJadwal(store, p.id);
    renderPage(store);
    pilihTanggal(TANGGAL);

    await user.click(screen.getByRole('button', { name: 'Tandai Selesai Budi Santoso 09:30' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: JUDUL_TAWARAN_SESI })).toBeInTheDocument());

    await user.click(within(dialog()).getByRole('button', { name: 'Tidak' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Tambah Sesi Terapi' })).not.toBeInTheDocument();
    expect(store.getState().data.sesi).toHaveLength(0);
    expect(screen.getByTestId('jadwal-status')).toHaveTextContent('Selesai');
  });

  it('jadwal Selesai/Dibatalkan hanya menyediakan Hapus; Terjadwal menyediakan semua aksi (Req 8.14)', async () => {
    const store = await freshStore();
    const p = await seedPasien(store);
    const selesai = await seedJadwal(store, p.id, '08:00');
    const batal = await seedJadwal(store, p.id, '10:00');
    await seedJadwal(store, p.id, '12:00');
    await store.tandaiSelesai(selesai.id);
    await store.tandaiDibatalkan(batal.id);
    renderPage(store);
    pilihTanggal(TANGGAL);

    for (const jam of ['08:00', '10:00']) {
      const label = `Budi Santoso ${jam}`;
      expect(screen.queryByRole('button', { name: `Tandai Selesai ${label}` })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `Tandai Dibatalkan ${label}` })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: `Ubah jadwal ${label}` })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Hapus jadwal ${label}` })).toBeInTheDocument();
    }

    const label = 'Budi Santoso 12:00';
    expect(screen.getByRole('button', { name: `Tandai Selesai ${label}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Tandai Dibatalkan ${label}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Ubah jadwal ${label}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Hapus jadwal ${label}` })).toBeInTheDocument();

    expect(screen.getAllByTestId('jadwal-status').map((el) => el.textContent)).toEqual([
      'Selesai',
      'Dibatalkan',
      'Terjadwal',
    ]);
  });

  it('dialog hapus menyebut nama, tanggal, jam; Batal mempertahankan jadwal (Req 8.13)', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    const p = await seedPasien(store);
    const j = await seedJadwal(store, p.id);
    renderPage(store);
    pilihTanggal(TANGGAL);

    await user.click(screen.getByRole('button', { name: 'Hapus jadwal Budi Santoso 09:30' }));
    const d = dialog();
    expect(within(d).getByRole('heading', { name: 'Hapus Jadwal' })).toBeInTheDocument();
    expect(d).toHaveTextContent('Budi Santoso');
    expect(d).toHaveTextContent('10 Maret 2025');
    expect(d).toHaveTextContent('09:30');
    expect(store.getState().data.jadwal).toHaveLength(1);

    await user.click(within(d).getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().data.jadwal).toEqual([j]);
    expect(screen.getAllByTestId('jadwal-item')).toHaveLength(1);
    expect(screen.getByTestId('jadwal-status')).toHaveTextContent('Terjadwal');
  });

  it('secara default data yang tampil awal adalah jadwal yang sudah ada (Req user #3)', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    const p1 = await seedPasien(store, 'Pasien Satu');
    const p2 = await seedPasien(store, 'Pasien Dua');
    // Jadwal tanggal berbeda (bukan hari ini)
    await seedJadwal(store, p1.id, '09:00', '2025-05-20');
    await seedJadwal(store, p2.id, '14:00', '2025-06-15');

    renderPage(store);

    // Tanpa harus memilih tanggal, kedua jadwal yang sudah ada langsung tampil
    const items = screen.getAllByTestId('jadwal-item');
    expect(items).toHaveLength(2);
    expect(screen.getByText('Pasien Satu')).toBeInTheDocument();
    expect(screen.getByText('Pasien Dua')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Semua Jadwal (2)' })).toBeInTheDocument();

    // Memilih Hari Ini (saat tidak ada jadwal pada hari ini) menampilkan pesan kosong
    await user.click(screen.getByTestId('filter-hari-ini'));
    expect(screen.getByText(PESAN_TIDAK_ADA_JADWAL)).toBeInTheDocument();
    expect(screen.queryAllByTestId('jadwal-item')).toHaveLength(0);

    // Mengklik kembali "Semua Jadwal" menampilkan kembali seluruh jadwal
    await user.click(screen.getByTestId('filter-semua-jadwal'));
    expect(screen.getAllByTestId('jadwal-item')).toHaveLength(2);
  });
});
