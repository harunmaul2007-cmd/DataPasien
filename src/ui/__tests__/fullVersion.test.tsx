// Gerbang Full Version: Pengaturan, Bantuan AI, dan Laporan PDF terkunci pada
// versi gratis; dialog menawarkan WhatsApp dan kode aktivasi.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
// @ts-expect-error modul .mjs tanpa deklarasi tipe
import { buatKode, buatPasanganKunci, jwkPublik } from '../../../scripts/lisensi.mjs';
import { PESAN_KODE_TIDAK_DIKENALI } from '../../domain/lisensi';
import { DexieRepository, openRepository } from '../../infra/repository';
import { DataStore, DataStoreProvider } from '../../state/dataStore';
import { KUNCI_PENYIMPANAN_LISENSI, LisensiProvider } from '../../state/lisensi';
import { AppShell } from '../App';
import { DialogStackProvider } from '../components/DialogStack';
import { ToastProvider } from '../components/Toast';

const { privateKey } = buatPasanganKunci();
const kunciPublik = jwkPublik(privateKey) as JsonWebKey;
const KODE: string = buatKode('klinik@contoh.id', privateKey);

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

function memStorage(awal: Record<string, string> = {}) {
  const m = new Map(Object.entries(awal));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}

async function setup(opts: { path?: string; storage?: ReturnType<typeof memStorage>; sesi?: boolean } = {}) {
  const repo = await openRepository(`test-full-version-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  const store = new DataStore({ repository: repo });
  await store.load();
  const p = await store.addPasien({ nama: 'Budi Santoso', alamat: 'Jl. Mawar 1', noHp: '081234567890' });
  if (!p.ok) throw new Error('seed gagal');
  if (opts.sesi) {
    await store.addSesi(p.value.id, {
      tanggal: '2025-01-05',
      keluhan: 'Nyeri punggung',
      polaPenyakit: '',
      terapi: 'Pijat',
      hasil: '',
      biaya: '100000',
    });
  }
  const storage = opts.storage ?? memStorage();
  const path = opts.path === 'detail' ? `/pasien/${p.value.id}` : (opts.path ?? '/');
  render(
    <DataStoreProvider store={store}>
      <DialogStackProvider>
        <ToastProvider duration={0}>
          <LisensiProvider storage={storage} kunciPublik={kunciPublik}>
            <MemoryRouter initialEntries={[path]}>
              <AppShell />
            </MemoryRouter>
          </LisensiProvider>
        </ToastProvider>
      </DialogStackProvider>
    </DataStoreProvider>,
  );
  return { storage };
}

const nav = () => screen.getByRole('navigation', { name: 'Navigasi utama' });

describe('Full Version', () => {
  it('versi gratis: klik Pengaturan menampilkan dialog dengan tombol WhatsApp ke nomor pembelian', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    await setup();

    await user.click(within(nav()).getByRole('link', { name: /Pengaturan/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Fitur Full Version' });
    expect(screen.queryByRole('heading', { level: 1, name: 'Pengaturan Praktik' })).not.toBeInTheDocument();
    expect(within(dialog).getByText('Pengaturan')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Hubungi via WhatsApp/ }));
    const url = new URL(open.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://wa.me/62895412928467');
    expect(url.searchParams.get('text')).toContain('Full Version');
  });

  it('akses langsung ke rute Pengaturan pada versi gratis menampilkan panel aktivasi', async () => {
    await setup({ path: '/pengaturan' });
    expect(await screen.findByRole('heading', { level: 1, name: /Pengaturan/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Kode aktivasi')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-simpan-pengaturan')).not.toBeInTheDocument();
  });

  it('kode salah ditolak; kode sah mengaktifkan Full Version dan disimpan', async () => {
    const user = userEvent.setup();
    const { storage } = await setup({ path: '/pengaturan' });
    const input = await screen.findByLabelText('Kode aktivasi');

    await user.type(input, 'kode-asal');
    await user.click(screen.getByRole('button', { name: 'Aktifkan' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(PESAN_KODE_TIDAK_DIKENALI);

    await user.clear(input);
    await user.click(input);
    await user.paste(KODE);
    await user.click(screen.getByRole('button', { name: 'Aktifkan' }));

    expect(await screen.findByTestId('btn-simpan-pengaturan')).toBeInTheDocument();
    expect(screen.getByTestId('info-lisensi')).toHaveTextContent('klinik@contoh.id');
    expect(storage.m.get(KUNCI_PENYIMPANAN_LISENSI)).toBe(KODE);
  });

  it('kode tersimpan yang sah langsung membuka Pengaturan; kode rusak tetap terkunci', async () => {
    await setup({ path: '/pengaturan', storage: memStorage({ [KUNCI_PENYIMPANAN_LISENSI]: KODE }) });
    expect(await screen.findByTestId('btn-simpan-pengaturan')).toBeInTheDocument();
  });

  it('kode tersimpan yang diubah tidak membuka Pengaturan', async () => {
    const rusak = KODE.slice(0, -4) + 'AAAA';
    await setup({ path: '/pengaturan', storage: memStorage({ [KUNCI_PENYIMPANAN_LISENSI]: rusak }) });
    expect(await screen.findByLabelText('Kode aktivasi')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-simpan-pengaturan')).not.toBeInTheDocument();
  });

  it('versi gratis: Laporan PDF dan Bantuan AI menampilkan dialog Full Version', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    await setup({ path: 'detail', sesi: true });

    await user.click(await screen.findByTestId('btn-laporan-pdf'));
    let dialog = await screen.findByRole('dialog', { name: 'Fitur Full Version' });
    expect(within(dialog).getByText('Laporan PDF')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Tutup' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fitur Full Version' })).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Tambah sesi' }));
    const form = screen.getByRole('dialog', { name: 'Tambah Sesi Terapi' });
    await user.type(within(form).getByLabelText('Keluhan'), 'Pusing');
    await user.click(within(form).getByRole('button', { name: 'Bantuan AI' }));

    dialog = await screen.findByRole('dialog', { name: 'Fitur Full Version' });
    expect(within(dialog).getByText('Bantuan AI')).toBeInTheDocument();
    expect(open).not.toHaveBeenCalled(); // ChatGPT tidak dibuka
  });
});
