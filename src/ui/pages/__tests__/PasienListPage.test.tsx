// Unit test halaman daftar pasien beserta dialog formulir dan hapus pasien.
// Memakai DataStore nyata di atas DexieRepository (fake-indexeddb).
// Requirements: 1.8, 1.9, 2.1, 2.5, 3.1, 3.3, 4.5, 4.8

import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { Pasien } from '../../../domain/types';
import { PESAN } from '../../../domain/validator';
import { DexieRepository, openRepository } from '../../../infra/repository';
import { DataStore, DataStoreProvider, PESAN_GAGAL_SIMPAN } from '../../../state/dataStore';
import { DialogStackProvider } from '../../components/DialogStack';
import { ToastProvider } from '../../components/Toast';
import {
  DEBOUNCE_PENCARIAN_MS,
  PasienListPage,
  PESAN_BELUM_ADA_PASIEN,
  PESAN_PASIEN_TIDAK_DITEMUKAN_CARI,
} from '../PasienListPage';

let counter = 0;
const opened: DexieRepository[] = [];

async function freshRepo(): Promise<DexieRepository> {
  const repo = await openRepository(`test-pasien-list-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  return repo;
}

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

const pasien = (id: string, over: Partial<Pasien> = {}): Pasien => ({
  id,
  nama: 'Budi Santoso',
  alamat: 'Jl. Mawar No. 1',
  noHp: '081234567890',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

async function setup(seed: Pasien[] = [], tweak?: (repo: DexieRepository) => void) {
  const repo = await freshRepo();
  for (const p of seed) await repo.addPasien(p);
  tweak?.(repo);
  const store = new DataStore({ repository: repo });
  await store.load();
  const user = userEvent.setup();
  render(
    <DataStoreProvider store={store}>
      <DialogStackProvider>
        <ToastProvider duration={0}>
          <MemoryRouter initialEntries={['/']}>
            <PasienListPage />
          </MemoryRouter>
        </ToastProvider>
      </DialogStackProvider>
    </DataStoreProvider>,
  );
  return { repo, store, user };
}

const dialog = (name: string) => screen.getByRole('dialog', { name });

describe('PasienListPage: pesan daftar kosong (Req 4.5, 4.8)', () => {
  it('tanpa data pasien menampilkan "Belum ada data pasien", bukan "Pasien tidak ditemukan"', async () => {
    const { user } = await setup();
    expect(screen.getByRole('status')).toHaveTextContent(PESAN_BELUM_ADA_PASIEN);
    expect(screen.queryByText(PESAN_PASIEN_TIDAK_DITEMUKAN_CARI)).not.toBeInTheDocument();

    // Tetap "Belum ada data pasien" meskipun ada kata kunci.
    await user.type(screen.getByRole('searchbox', { name: 'Cari pasien' }), 'xyz');
    // Tunggu melewati debounce pencarian.
    await act(() => new Promise((r) => setTimeout(r, DEBOUNCE_PENCARIAN_MS + 100)));
    expect(screen.getByText(PESAN_BELUM_ADA_PASIEN)).toBeInTheDocument();
    expect(screen.queryByText(PESAN_PASIEN_TIDAK_DITEMUKAN_CARI)).not.toBeInTheDocument();
  });

  it('kata kunci tanpa kecocokan menampilkan daftar kosong dan "Pasien tidak ditemukan"', async () => {
    const { user } = await setup([pasien('p1')]);
    expect(screen.getAllByTestId('pasien-item')).toHaveLength(1);

    await user.type(screen.getByRole('searchbox', { name: 'Cari pasien' }), 'zzz');
    expect(await screen.findByText(PESAN_PASIEN_TIDAK_DITEMUKAN_CARI)).toBeInTheDocument();
    expect(screen.queryAllByTestId('pasien-item')).toHaveLength(0);
    expect(screen.queryByText(PESAN_BELUM_ADA_PASIEN)).not.toBeInTheDocument();
  });
});

describe('PasienFormDialog (Req 1.8, 1.9, 2.1, 2.5)', () => {
  it('formulir ubah terisi nilai tersimpan sama persis karakter demi karakter', async () => {
    const tersimpan = pasien('p1', { nama: 'Siti  Aminah', alamat: 'Jl. Kenanga No. 7, RT 01/02 "Blok A"', noHp: '+6281234567890' });
    const { user } = await setup([tersimpan]);

    // Nama aksesibel dinormalisasi spasinya oleh Testing Library.
    await user.click(screen.getByRole('button', { name: 'Ubah Siti Aminah' }));
    const d = dialog('Ubah Pasien');
    expect(within(d).getByLabelText('Nama')).toHaveValue(tersimpan.nama);
    expect(within(d).getByLabelText('Alamat')).toHaveValue(tersimpan.alamat);
    expect(within(d).getByLabelText('Nomor HP')).toHaveValue(tersimpan.noHp);
  });

  it('menampilkan seluruh pesan kesalahan bersamaan pada isian masing-masing tanpa menyimpan', async () => {
    const { user, store, repo } = await setup();

    await user.click(screen.getByRole('button', { name: '+ Tambah Pasien' }));
    const d = dialog('Tambah Pasien');
    await user.type(within(d).getByLabelText('Alamat'), 'Jl. Melati');
    await user.type(within(d).getByLabelText('Nomor HP'), '12345');
    await user.click(within(d).getByRole('button', { name: 'Simpan' }));

    const nama = within(d).getByLabelText('Nama');
    const noHp = within(d).getByLabelText('Nomor HP');
    expect(await within(d).findByText(PESAN.namaWajib)).toBeInTheDocument();
    expect(within(d).getByText(PESAN.noHpTidakValid)).toBeInTheDocument();
    expect(nama).toHaveAttribute('aria-invalid', 'true');
    expect(noHp).toHaveAttribute('aria-invalid', 'true');
    expect(nama).toHaveAccessibleDescription(expect.stringContaining(PESAN.namaWajib));
    expect(noHp).toHaveAccessibleDescription(expect.stringContaining(PESAN.noHpTidakValid));
    expect(within(d).getByLabelText('Alamat')).not.toHaveAttribute('aria-invalid');
    // Isian dipertahankan, tidak ada data baru.
    expect(within(d).getByLabelText('Alamat')).toHaveValue('Jl. Melati');
    expect(noHp).toHaveValue('12345');
    expect(store.getState().data.pasien).toEqual([]);
    expect((await repo.loadAll()).pasien).toEqual([]);
  });

  it('Repository gagal saat tambah → pesan gagal disimpan, formulir dan isian tetap, daftar tidak bertambah', async () => {
    const { user, store } = await setup([], (repo) => {
      repo.addPasien = () => Promise.reject(new Error('disk penuh'));
    });

    await user.click(screen.getByRole('button', { name: '+ Tambah Pasien' }));
    const d = dialog('Tambah Pasien');
    await user.type(within(d).getByLabelText('Nama'), 'Ani');
    await user.type(within(d).getByLabelText('Alamat'), 'Jl. Melati');
    await user.type(within(d).getByLabelText('Nomor HP'), '081298765432');
    await user.click(within(d).getByRole('button', { name: 'Simpan' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(PESAN_GAGAL_SIMPAN);
    expect(dialog('Tambah Pasien')).toBeInTheDocument();
    expect(within(d).getByLabelText('Nama')).toHaveValue('Ani');
    expect(within(d).getByLabelText('Alamat')).toHaveValue('Jl. Melati');
    expect(within(d).getByLabelText('Nomor HP')).toHaveValue('081298765432');
    expect(within(d).getByRole('button', { name: 'Simpan' })).toBeEnabled();
    expect(store.getState().data.pasien).toEqual([]);
    expect(screen.getByText(PESAN_BELUM_ADA_PASIEN)).toBeInTheDocument();
  });

  it('Repository gagal saat ubah → formulir dan isian yang diubah tetap, data tersimpan tidak berubah', async () => {
    const asli = pasien('p1');
    const { user, store, repo } = await setup([asli], (r) => {
      r.updatePasien = () => Promise.reject(new Error('disk penuh'));
    });

    await user.click(screen.getByRole('button', { name: `Ubah ${asli.nama}` }));
    const d = dialog('Ubah Pasien');
    const nama = within(d).getByLabelText('Nama');
    await user.clear(nama);
    await user.type(nama, 'Budi Baru');
    await user.click(within(d).getByRole('button', { name: 'Simpan' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(PESAN_GAGAL_SIMPAN);
    expect(dialog('Ubah Pasien')).toBeInTheDocument();
    expect(within(d).getByLabelText('Nama')).toHaveValue('Budi Baru');
    expect(store.selectPasien('p1')).toEqual(asli);
    expect((await repo.loadAll()).pasien).toEqual([asli]);
  });

  it('batal pada formulir ubah menutup tanpa menyimpan; dibuka lagi berisi nilai tersimpan', async () => {
    const asli = pasien('p1');
    const { user, store, repo } = await setup([asli]);

    await user.click(screen.getByRole('button', { name: `Ubah ${asli.nama}` }));
    let d = dialog('Ubah Pasien');
    await user.clear(within(d).getByLabelText('Nama'));
    await user.type(within(d).getByLabelText('Nama'), 'Nama Lain');
    await user.click(within(d).getByRole('button', { name: 'Batal' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.selectPasien('p1')).toEqual(asli);
    expect((await repo.loadAll()).pasien).toEqual([asli]);

    await user.click(screen.getByRole('button', { name: `Ubah ${asli.nama}` }));
    d = dialog('Ubah Pasien');
    expect(within(d).getByLabelText('Nama')).toHaveValue(asli.nama);
  });
});

describe('HapusPasienDialog (Req 3.1, 3.3)', () => {
  it('menampilkan nama pasien serta angka 0 untuk sesi dan jadwal, dengan tombol konfirmasi dan batal', async () => {
    const { user } = await setup([pasien('p1', { nama: 'Dewi' })]);

    await user.click(screen.getByRole('button', { name: 'Hapus Dewi' }));
    const d = dialog('Hapus Pasien');
    expect(within(d).getByTestId('hapus-nama')).toHaveTextContent('Dewi');
    expect(within(d).getByTestId('hapus-jumlah-sesi')).toHaveTextContent(/^0$/);
    expect(within(d).getByTestId('hapus-jumlah-jadwal')).toHaveTextContent(/^0$/);
    expect(within(d).getByText(/sesi terapi/)).toHaveTextContent('0 sesi terapi');
    expect(within(d).getByText(/jadwal kunjungan/)).toHaveTextContent('0 jadwal kunjungan');
    expect(within(d).getByRole('button', { name: 'Hapus' })).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Batal' })).toBeInTheDocument();
  });

  it('batal menutup dialog dan mempertahankan data pasien', async () => {
    const dewi = pasien('p1', { nama: 'Dewi' });
    const { user, store, repo } = await setup([dewi]);

    await user.click(screen.getByRole('button', { name: 'Hapus Dewi' }));
    await user.click(within(dialog('Hapus Pasien')).getByRole('button', { name: 'Batal' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('pasien-item')).toHaveLength(1);
    expect(store.getState().data.pasien).toEqual([dewi]);
    expect(await repo.loadAll()).toEqual({ pasien: [dewi], sesi: [], jadwal: [] });
  });
});
