// Unit test halaman detail pasien dan dialog sesi terapi.
// Requirements: 5.7, 6.5, 6.6, 6.7, 7.6, 7.7, 7.8

import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { todayISO } from '../../../domain/tanggal';
import type { Pasien, SesiInput, SesiTerapi } from '../../../domain/types';
import { DexieRepository, openRepository } from '../../../infra/repository';
import { DataStore, DataStoreProvider } from '../../../state/dataStore';
import { DialogStackProvider } from '../../components/DialogStack';
import { ToastProvider } from '../../components/Toast';
import { PasienDetailPage, PESAN_HISTORI_KOSONG, PESAN_PASIEN_TIDAK_DITEMUKAN } from '../PasienDetailPage';

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

async function freshStore(): Promise<DataStore> {
  const repo = await openRepository(`test-detail-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  const store = new DataStore({ repository: repo });
  await store.load();
  return store;
}

async function seedPasien(store: DataStore, nama = 'Budi Santoso'): Promise<Pasien> {
  const r = await store.addPasien({ nama, alamat: 'Jl. Mawar 1', noHp: '081234567890' });
  if (!r.ok) throw new Error('seed pasien gagal');
  return r.value;
}

async function seedSesi(store: DataStore, pasienId: string, input: Partial<SesiInput> = {}): Promise<SesiTerapi> {
  const r = await store.addSesi(pasienId, {
    tanggal: '2025-01-05',
    keluhan: 'Nyeri punggung',
    polaPenyakit: 'Saraf terjepit',
    terapi: 'Pijat refleksi',
    hasil: 'Membaik',
    biaya: '150000',
    ...input,
  });
  if (!r.ok) throw new Error('seed sesi gagal');
  return r.value;
}

function renderDetail(store: DataStore, id: string) {
  return render(
    <DataStoreProvider store={store}>
      <DialogStackProvider>
        <ToastProvider duration={0}>
          <MemoryRouter initialEntries={[`/pasien/${id}`]}>
            <Routes>
              <Route path="/pasien/:id" element={<PasienDetailPage />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </DialogStackProvider>
    </DataStoreProvider>,
  );
}

const dialog = () => screen.getByRole('dialog');

describe('PasienDetailPage', () => {
  it('pasien tanpa sesi: "Belum ada histori terapi", jumlah 0, total "Rp 0" (Req 7.6)', async () => {
    const store = await freshStore();
    const p = await seedPasien(store);
    renderDetail(store, p.id);

    expect(screen.getByRole('heading', { level: 1, name: 'Budi Santoso' })).toBeInTheDocument();
    expect(screen.getByText(PESAN_HISTORI_KOSONG)).toBeInTheDocument();
    expect(screen.getByTestId('jumlah-sesi')).toHaveTextContent('0');
    expect(screen.getByTestId('total-biaya')).toHaveTextContent('Rp 0');
  });

  it('pasien tidak ditemukan: menampilkan pesan dan tidak menampilkan histori (Req 7.8)', async () => {
    const store = await freshStore();
    const p = await seedPasien(store);
    await seedSesi(store, p.id);
    renderDetail(store, 'tidak-ada');

    expect(screen.getByText(PESAN_PASIEN_TIDAK_DITEMUKAN)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Histori terapi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(screen.queryByText('Nyeri punggung')).not.toBeInTheDocument();
  });

  it('formulir sesi baru berisi tanggal hari ini sebagai nilai awal yang dapat diubah (Req 5.7)', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    const p = await seedPasien(store);
    renderDetail(store, p.id);

    await user.click(screen.getByRole('button', { name: 'Tambah sesi' }));
    const tanggal = within(dialog()).getByLabelText('Tanggal terapi') as HTMLInputElement;
    expect(tanggal.value).toBe(todayISO(new Date()));
    expect(within(dialog()).getByLabelText('Keluhan')).toHaveValue('');
    expect(within(dialog()).getByLabelText('Biaya (Rp)')).toHaveValue('');

    await user.clear(tanggal);
    await user.type(tanggal, '2024-12-31');
    expect(tanggal.value).toBe('2024-12-31');
  });

  it('formulir ubah sesi berisi nilai tersimpan (Req 6.5)', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    const p = await seedPasien(store);
    await seedSesi(store, p.id, { hasil: '' });
    renderDetail(store, p.id);

    await user.click(screen.getByRole('button', { name: 'Ubah sesi 05 Januari 2025' }));
    const d = within(dialog());
    expect(d.getByRole('heading', { name: 'Ubah Sesi Terapi' })).toBeInTheDocument();
    expect(d.getByLabelText('Tanggal terapi')).toHaveValue('2025-01-05');
    expect(d.getByLabelText('Keluhan')).toHaveValue('Nyeri punggung');
    expect(d.getByLabelText('Diagnosa')).toHaveValue('Saraf terjepit');
    expect(d.getByLabelText('Terapi yang diberikan')).toHaveValue('Pijat refleksi');
    expect(d.getByLabelText('Hasil terapi')).toHaveValue('');
    expect(d.getByLabelText('Biaya (Rp)')).toHaveValue('150000');
  });

  it('dialog hapus menyebut nama, tanggal, biaya tanpa menghapus; Batal mempertahankan sesi (Req 6.6, 6.7)', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    const p = await seedPasien(store);
    const s = await seedSesi(store, p.id);
    renderDetail(store, p.id);

    await user.click(screen.getByRole('button', { name: 'Hapus sesi 05 Januari 2025' }));
    const d = dialog();
    expect(within(d).getByRole('heading', { name: 'Hapus Sesi Terapi' })).toBeInTheDocument();
    expect(d).toHaveTextContent('Budi Santoso');
    expect(d).toHaveTextContent('05 Januari 2025');
    expect(d).toHaveTextContent('Rp 150.000');
    // Belum dihapus sebelum konfirmasi.
    expect(store.getState().data.sesi).toHaveLength(1);

    await user.click(within(d).getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().data.sesi).toEqual([s]);
    expect(screen.getByRole('article', { name: 'Sesi terapi 05 Januari 2025' })).toBeInTheDocument();
    expect(screen.getByTestId('jumlah-sesi')).toHaveTextContent('1');
  });

  it('histori, jumlah, dan total diperbarui setelah tambah, ubah, hapus tanpa membuka ulang halaman (Req 7.7)', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    const p = await seedPasien(store);
    await seedSesi(store, p.id);
    renderDetail(store, p.id);

    expect(screen.getByTestId('jumlah-sesi')).toHaveTextContent('1');
    expect(screen.getByTestId('total-biaya')).toHaveTextContent('Rp 150.000');

    // Tambah sesi lewat formulir.
    await user.click(screen.getByRole('button', { name: 'Tambah sesi' }));
    let d = within(dialog());
    const tanggal = d.getByLabelText('Tanggal terapi');
    await user.clear(tanggal);
    await user.type(tanggal, '2025-02-10');
    await user.type(d.getByLabelText('Keluhan'), 'Pusing');
    await user.type(d.getByLabelText('Terapi yang diberikan'), 'Akupresur');
    await user.type(d.getByLabelText('Biaya (Rp)'), '50000');
    await user.click(d.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('jumlah-sesi')).toHaveTextContent('2');
    expect(screen.getByTestId('total-biaya')).toHaveTextContent('Rp 200.000');
    const items = screen.getAllByRole('article');
    expect(items.map((a) => a.getAttribute('aria-label'))).toEqual([
      'Sesi terapi 10 Februari 2025',
      'Sesi terapi 05 Januari 2025',
    ]);

    // Ubah biaya sesi Januari.
    await user.click(screen.getByRole('button', { name: 'Ubah sesi 05 Januari 2025' }));
    d = within(dialog());
    const biaya = d.getByLabelText('Biaya (Rp)');
    await user.clear(biaya);
    await user.type(biaya, '100000');
    await user.click(d.getByRole('button', { name: 'Simpan' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('jumlah-sesi')).toHaveTextContent('2');
    expect(screen.getByTestId('total-biaya')).toHaveTextContent('Rp 150.000');
    expect(screen.getByRole('article', { name: 'Sesi terapi 05 Januari 2025' })).toHaveTextContent('Rp 100.000');

    // Hapus sesi Februari.
    await user.click(screen.getByRole('button', { name: 'Hapus sesi 10 Februari 2025' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Hapus' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('jumlah-sesi')).toHaveTextContent('1');
    expect(screen.getByTestId('total-biaya')).toHaveTextContent('Rp 100.000');
    expect(screen.queryByRole('article', { name: 'Sesi terapi 10 Februari 2025' })).not.toBeInTheDocument();
    expect(store.getState().data.sesi).toHaveLength(1);

    // Hapus sesi terakhir → pesan kosong.
    await user.click(screen.getByRole('button', { name: 'Hapus sesi 05 Januari 2025' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Hapus' }));
    await waitFor(() => expect(screen.getByText(PESAN_HISTORI_KOSONG)).toBeInTheDocument());
    expect(screen.getByTestId('jumlah-sesi')).toHaveTextContent('0');
    expect(screen.getByTestId('total-biaya')).toHaveTextContent('Rp 0');
  });
});
