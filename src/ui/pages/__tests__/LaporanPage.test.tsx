// Unit test halaman Laporan_Pemasukan: filter default, bulan kosong, gagal memuat.
// Requirements: 9.1, 9.7, 9.9

import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NAMA_BULAN } from '../../../domain/format';
import { DexieRepository, openRepository } from '../../../infra/repository';
import { createDataStore, DataStoreProvider, type DataStore } from '../../../state/dataStore';
import { DialogStackProvider } from '../../components/DialogStack';
import { ToastProvider } from '../../components/Toast';
import { LaporanPage, PESAN_LAPORAN_GAGAL, PESAN_LAPORAN_KOSONG } from '../LaporanPage';

let counter = 0;
const opened: DexieRepository[] = [];

async function freshRepo(): Promise<DexieRepository> {
  const repo = await openRepository(`test-laporan-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  return repo;
}

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

function renderPage(store: DataStore): void {
  function Wrapper({ children }: { children?: ReactNode }) {
    return (
      <DataStoreProvider store={store}>
        <DialogStackProvider>
          <ToastProvider>{children}</ToastProvider>
        </DialogStackProvider>
      </DataStoreProvider>
    );
  }
  render(<LaporanPage />, { wrapper: Wrapper });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Store siap dengan satu sesi Rp 150.000 pada tanggal 1 bulan berjalan. */
async function readyStoreWithSesiBulanIni(): Promise<{ store: DataStore; bulan: number; tahun: number }> {
  const now = new Date();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  const store = createDataStore({ repository: await freshRepo() });
  await store.load();
  const p = await store.addPasien({ nama: 'Budi Santoso', alamat: 'Jl. Mawar 1', noHp: '081234567890' });
  if (!p.ok) throw new Error('addPasien gagal');
  const s = await store.addSesi(p.value.id, {
    tanggal: `${tahun}-${pad2(bulan)}-01`,
    keluhan: 'Nyeri punggung',
    polaPenyakit: '',
    terapi: 'Bekam',
    hasil: '',
    biaya: '150000',
  });
  if (!s.ok) throw new Error('addSesi gagal');
  return { store, bulan, tahun };
}

describe('LaporanPage', () => {
  it('filter default berisi bulan dan tahun berjalan dan menampilkan laporannya (Req 9.1)', async () => {
    const { store, bulan, tahun } = await readyStoreWithSesiBulanIni();
    renderPage(store);

    const selectBulan = screen.getByLabelText('Bulan');
    const selectTahun = screen.getByLabelText('Tahun');
    expect(selectBulan).toHaveValue(String(bulan));
    expect(selectBulan).toHaveDisplayValue(NAMA_BULAN[bulan - 1]!);
    expect(selectTahun).toHaveValue(String(tahun));

    expect(screen.getByTestId('laporan-total')).toHaveTextContent('Rp 150.000');
    expect(screen.getByTestId('laporan-jumlah-sesi')).toHaveTextContent('1');
    expect(screen.getByTestId('laporan-jumlah-pasien')).toHaveTextContent('1');
    expect(screen.getByRole('list', { name: 'Rincian sesi terapi' })).toHaveTextContent('Budi Santoso');
    expect(screen.queryByText(PESAN_LAPORAN_KOSONG)).not.toBeInTheDocument();
  });

  it('bulan tanpa sesi menampilkan Rp 0, nol, rincian kosong, dan pesan bulan kosong (Req 9.7)', async () => {
    const { store, bulan, tahun } = await readyStoreWithSesiBulanIni();
    renderPage(store);

    // Pilih bulan yang sama pada tahun lain yang pasti tanpa sesi.
    const tahunLain = tahun - 1;
    await userEvent.selectOptions(screen.getByLabelText('Tahun'), String(tahunLain));

    expect(screen.getByLabelText('Bulan')).toHaveValue(String(bulan));
    expect(screen.getByLabelText('Tahun')).toHaveValue(String(tahunLain));
    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/^Rp 0$/);
    expect(screen.getByTestId('laporan-jumlah-sesi')).toHaveTextContent(/^0$/);
    expect(screen.getByTestId('laporan-jumlah-pasien')).toHaveTextContent(/^0$/);
    expect(screen.queryByRole('list', { name: 'Rincian sesi terapi' })).not.toBeInTheDocument();
    expect(screen.getByText(PESAN_LAPORAN_KOSONG)).toBeInTheDocument();
  });

  it('store kosong pada bulan berjalan langsung menampilkan pesan bulan kosong (Req 9.7)', async () => {
    const store = createDataStore({ repository: await freshRepo() });
    await store.load();
    renderPage(store);

    expect(screen.getByTestId('laporan-total')).toHaveTextContent(/^Rp 0$/);
    expect(screen.getByText(PESAN_LAPORAN_KOSONG)).toBeInTheDocument();
  });

  it('pemuatan gagal: pesan gagal, tanpa total/rincian, filter dipertahankan (Req 9.9)', async () => {
    const store = createDataStore({
      repository: () => Promise.reject(new Error('IndexedDB tidak tersedia')),
    });
    await act(async () => {
      await store.load();
    });
    expect(store.getState().status).toBe('error');

    renderPage(store);
    const now = new Date();

    expect(screen.getByRole('alert')).toHaveTextContent(PESAN_LAPORAN_GAGAL);
    expect(screen.queryByTestId('laporan-total')).not.toBeInTheDocument();
    expect(screen.queryByTestId('laporan-jumlah-sesi')).not.toBeInTheDocument();
    expect(screen.queryByTestId('laporan-jumlah-pasien')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Rincian sesi terapi' })).not.toBeInTheDocument();
    expect(screen.queryByText(PESAN_LAPORAN_KOSONG)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Bulan')).toHaveValue(String(now.getMonth() + 1));
    expect(screen.getByLabelText('Tahun')).toHaveValue(String(now.getFullYear()));

    // Pilihan filter tetap dipertahankan dan pesan gagal tetap tampil.
    await userEvent.selectOptions(screen.getByLabelText('Bulan'), '2');
    await userEvent.selectOptions(screen.getByLabelText('Tahun'), '2020');
    expect(screen.getByLabelText('Bulan')).toHaveValue('2');
    expect(screen.getByLabelText('Tahun')).toHaveValue('2020');
    expect(screen.getByRole('alert')).toHaveTextContent(PESAN_LAPORAN_GAGAL);
    expect(screen.queryByTestId('laporan-total')).not.toBeInTheDocument();
  });
});
