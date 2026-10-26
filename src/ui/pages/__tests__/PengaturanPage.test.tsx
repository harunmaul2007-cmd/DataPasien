import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { APP_INFO } from '../../../domain/appInfo';
import { DexieRepository, openRepository } from '../../../infra/repository';
import { DataStore, DataStoreProvider } from '../../../state/dataStore';
import { DialogStackProvider } from '../../components/DialogStack';
import { ToastProvider } from '../../components/Toast';
import { THEMES } from '../../theme';
import { PengaturanPage } from '../PengaturanPage';

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

async function freshStore(): Promise<DataStore> {
  const repo = await openRepository(`test-pengaturan-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  const store = new DataStore({ repository: repo });
  await store.load();
  return store;
}

function renderPage(store: DataStore) {
  return render(
    <DataStoreProvider store={store}>
      <DialogStackProvider>
        <ToastProvider duration={0}>
          <PengaturanPage />
        </ToastProvider>
      </DialogStackProvider>
    </DataStoreProvider>,
  );
}

describe('PengaturanPage', () => {
  it('menampilkan informasi creator dan versi aplikasi (Req user #1)', async () => {
    const store = await freshStore();
    renderPage(store);

    expect(screen.getByRole('heading', { name: 'Tentang Aplikasi' })).toBeInTheDocument();
    expect(screen.getByText(APP_INFO.creatorNama)).toBeInTheDocument();
    expect(screen.getByText(APP_INFO.creatorTagline)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Versi ${APP_INFO.versionName}`))).toBeInTheDocument();

    const logo = screen.getByAltText(`Logo ${APP_INFO.creatorNama}`);
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', APP_INFO.creatorLogoUrl);
  });

  it('menampilkan pilihan tema dan dapat mengubah tema aplikasi (Req user #2)', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    renderPage(store);

    expect(screen.getByRole('heading', { name: 'Tema Tampilan Aplikasi' })).toBeInTheDocument();

    // Seluruh tema terdaftar
    for (const t of THEMES) {
      expect(screen.getByText(t.nama)).toBeInTheDocument();
    }

    // Mengklik tema Midnight Dark
    const midnightBtn = screen.getByRole('radio', { name: /Midnight Dark/ });
    await user.click(midnightBtn);

    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight-dark');
    expect(localStorage.getItem('datapasien-theme')).toBe('midnight-dark');

    // Mengklik tema Hijau Sehat
    const emeraldBtn = screen.getByRole('radio', { name: /Hijau Sehat/ });
    await user.click(emeraldBtn);

    expect(document.documentElement.getAttribute('data-theme')).toBe('emerald-sehat');
    expect(localStorage.getItem('datapasien-theme')).toBe('emerald-sehat');
  });

  it('dapat mengubah dan menyimpan pengaturan nama praktik', async () => {
    const user = userEvent.setup();
    const store = await freshStore();
    renderPage(store);

    const inputNama = screen.getByLabelText(/Nama Praktik/);
    await user.clear(inputNama);
    await user.type(inputNama, 'Klinik Berkah Sehat');

    await user.click(screen.getByTestId('btn-simpan-pengaturan'));

    await waitFor(() => {
      expect(store.selectPengaturan()?.namaPraktik).toBe('Klinik Berkah Sehat');
    });
  });
});
