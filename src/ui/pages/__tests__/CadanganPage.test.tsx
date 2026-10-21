// Unit test halaman Cadangan: pemilihan file dibatalkan, file rusak, batal
// impor, ekspor gagal, dan impor gagal yang mempertahankan data.
// Requirements: 14.3, 14.5, 14.6, 14.7, 14.11, 14.12

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CadanganPage } from '../CadanganPage';
import { DialogStackProvider } from '../../components/DialogStack';
import { ToastProvider } from '../../components/Toast';
import { serializeBackup } from '../../../domain/cadangan';
import type { AppData } from '../../../domain/types';
import type { FileGateway } from '../../../infra/fileGateway';
import { DexieRepository, openRepository } from '../../../infra/repository';
import { DataStore, DataStoreProvider, PESAN_GAGAL_EKSPOR, PESAN_GAGAL_IMPOR } from '../../../state/dataStore';

/** FileGateway palsu: isi file berikutnya dan mode gagal dapat diatur per tes. */
class FakeFileGateway implements FileGateway {
  next: string | null = null;
  failSave = false;
  saved: string[] = [];
  pickCalls = 0;
  async saveText(fileName: string, content: string): Promise<{ location: string }> {
    if (this.failSave) throw new Error('penyimpanan penuh');
    this.saved.push(content);
    return { location: `/Documents/${fileName}` };
  }
  async saveBinary(fileName: string, _data: Uint8Array, _mime: string): Promise<{ fileName: string; location: string }> {
    if (this.failSave) throw new Error('penyimpanan penuh');
    return { fileName, location: `/Documents/${fileName}` };
  }
  async pickTextFile(): Promise<string | null> {
    this.pickCalls++;
    return this.next;
  }
}

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

const fileData: AppData = {
  pasien: [
    { id: 'p1', nama: 'Budi', alamat: 'Jl. Mawar', noHp: '081234567890', createdAt: 1, updatedAt: 1 },
    { id: 'p2', nama: 'Sari', alamat: 'Jl. Melati', noHp: '081298765432', createdAt: 2, updatedAt: 2 },
  ],
  sesi: [
    {
      id: 's1', pasienId: 'p1', tanggal: '2024-02-29', keluhan: 'Pegal', polaPenyakit: '',
      terapi: 'Pijat', hasil: '', biaya: 150000, createdAt: 3, updatedAt: 3,
    },
  ],
  jadwal: [
    {
      id: 'j1', pasienId: 'p2', tanggal: '2024-03-01', jam: '09:30', catatan: '',
      status: 'Terjadwal', createdAt: 4, updatedAt: 4,
    },
  ],
};

async function setup() {
  const repo = await openRepository(`test-cadangan-page-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  const gw = new FakeFileGateway();
  const store = new DataStore({ repository: repo, fileGateway: gw, now: () => new Date(2025, 0, 5, 9, 30) });
  await store.load();
  await store.addPasien({ nama: 'Lama', alamat: 'Jl. Lama', noHp: '081200000000' });
  const user = userEvent.setup();
  render(
    <DataStoreProvider store={store}>
      <DialogStackProvider>
        <ToastProvider duration={0}>
          <CadanganPage />
        </ToastProvider>
      </DialogStackProvider>
    </DataStoreProvider>,
  );
  return { repo, gw, store, user };
}

const imporButton = () => screen.getByRole('button', { name: 'Impor data' });

describe('CadanganPage', () => {
  it('pemilihan file dibatalkan: tanpa pesan maupun dialog, data tetap (Req 14.12)', async () => {
    const { gw, store, user } = await setup();
    const before = store.getState().data;
    gw.next = null;

    await user.click(imporButton());

    await waitFor(() => expect(imporButton()).toBeEnabled());
    expect(gw.pickCalls).toBe(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(store.getState().data).toBe(before);
  });

  it('file rusak: pesan alasan ditampilkan tanpa dialog konfirmasi (Req 14.6)', async () => {
    const { gw, store, repo, user } = await setup();
    const before = store.getState().data;
    const stored = await repo.loadAll();
    gw.next = '{ ini bukan json';

    await user.click(imporButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/^Impor ditolak: .+/);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(store.getState().data).toBe(before);
    expect(await repo.loadAll()).toEqual(stored);
  });

  it('file valid menampilkan konfirmasi berisi jumlah dan peringatan; batal mempertahankan data (Req 14.3, 14.5)', async () => {
    const { gw, store, repo, user } = await setup();
    const before = store.getState().data;
    const stored = await repo.loadAll();
    gw.next = serializeBackup(fileData, new Date(2025, 0, 1));

    await user.click(imporButton());

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('File berisi 2 pasien, 1 sesi terapi, dan 1 jadwal kunjungan.');
    expect(dialog).toHaveTextContent(/seluruh data yang ada saat ini akan diganti/);

    await user.click(screen.getByRole('button', { name: 'Batal' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(store.getState().data).toBe(before);
    expect(await repo.loadAll()).toEqual(stored);
  });

  it('ekspor gagal: hanya pesan gagal, tanpa pesan berhasil (Req 14.11)', async () => {
    const { gw, user } = await setup();
    gw.failSave = true;

    await user.click(screen.getByRole('button', { name: 'Ekspor data' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(PESAN_GAGAL_EKSPOR);
    expect(screen.queryByText(/Ekspor berhasil/)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(gw.saved).toHaveLength(0);
  });

  it('impor gagal: pesan gagal, data di memori dan penyimpanan tetap seperti sebelum impor (Req 14.7)', async () => {
    const { gw, store, repo, user } = await setup();
    const before = store.getState().data;
    const stored = await repo.loadAll();
    gw.next = serializeBackup(fileData, new Date(2025, 0, 1));
    // Simulasikan kegagalan penulisan transaksi replaceAll.
    vi.spyOn(repo, 'replaceAll').mockRejectedValueOnce(new Error('disk penuh'));

    await user.click(imporButton());
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Impor' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(PESAN_GAGAL_IMPOR);
    expect(screen.queryByText(/Impor berhasil/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(store.getState().data).toBe(before);
    expect(await repo.loadAll()).toEqual(stored);
  });
});
