// Unit test logika Tombol_Kembali: tiga keadaan (dialog terbuka, bukan
// Halaman_Utama, Halaman_Utama → keluar/batal) plus uji integrasi melalui <App>.
// Requirements: 13.14, 13.15, 13.16, 13.17, 13.18

import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { App } from '../App';
import { Dialog } from '../components/Dialog';
import { createDialogStack, DialogStackProvider } from '../components/DialogStack';
import {
  BackButtonHandler,
  decideBackAction,
  ExitConfirmDialog,
  handleBackButton,
  isHalamanUtama,
} from '../navigation/backButton';
import type { PlatformAdapter } from '../../infra/platform';
import { createDataStore } from '../../state/dataStore';

/** Adapter palsu: menyimpan handler onBack dan memata-matai exitApp. */
function createFakePlatform() {
  let handler: (() => void) | null = null;
  const exitApp = vi.fn();
  const unsubscribe = vi.fn(() => {
    handler = null;
  });
  const platform: PlatformAdapter = {
    isNative: true,
    onBack(h) {
      handler = h;
      return unsubscribe;
    },
    exitApp,
  };
  return {
    platform,
    exitApp,
    unsubscribe,
    hasHandler: () => handler !== null,
    pressBack: () => {
      if (!handler) throw new Error('handler onBack belum terdaftar');
      act(() => handler!());
    },
  };
}

afterEach(() => {
  cleanup();
});

describe('isHalamanUtama', () => {
  it('hanya daftar pasien yang merupakan Halaman_Utama', () => {
    expect(isHalamanUtama('/')).toBe(true);
    expect(isHalamanUtama('')).toBe(true);
    for (const p of ['/jadwal', '/laporan', '/cadangan', '/pasien/abc']) {
      expect(isHalamanUtama(p)).toBe(false);
    }
  });
});

describe('decideBackAction', () => {
  it('dialog terbuka → closeDialog, di halaman mana pun (Req 13.15)', () => {
    expect(decideBackAction({ openDialogs: 1, pathname: '/' })).toBe('closeDialog');
    expect(decideBackAction({ openDialogs: 2, pathname: '/jadwal' })).toBe('closeDialog');
  });

  it('bukan Halaman_Utama tanpa dialog → navigateBack (Req 13.14)', () => {
    expect(decideBackAction({ openDialogs: 0, pathname: '/pasien/x' })).toBe('navigateBack');
    expect(decideBackAction({ openDialogs: 0, pathname: '/laporan' })).toBe('navigateBack');
  });

  it('Halaman_Utama tanpa dialog → confirmExit (Req 13.16)', () => {
    expect(decideBackAction({ openDialogs: 0, pathname: '/' })).toBe('confirmExit');
  });
});

describe('handleBackButton', () => {
  function deps(pathname: string) {
    const stack = createDialogStack();
    return {
      stack,
      navigateBack: vi.fn(),
      showExitConfirm: vi.fn(),
      run() {
        return handleBackButton({
          dialogStack: stack,
          pathname,
          navigateBack: this.navigateBack,
          showExitConfirm: this.showExitConfirm,
        });
      },
    };
  }

  it('dialog terbuka: hanya menutup dialog teratas (Req 13.15)', () => {
    const d = deps('/jadwal');
    const closeBawah = vi.fn();
    const closeAtas = vi.fn();
    d.stack.register({ close: closeBawah });
    d.stack.register({ close: closeAtas });

    expect(d.run()).toBe('closeDialog');
    expect(closeAtas).toHaveBeenCalledTimes(1);
    expect(closeBawah).not.toHaveBeenCalled();
    expect(d.navigateBack).not.toHaveBeenCalled();
    expect(d.showExitConfirm).not.toHaveBeenCalled();
  });

  it('bukan Halaman_Utama: kembali ke halaman sebelumnya (Req 13.14)', () => {
    const d = deps('/pasien/abc');
    expect(d.run()).toBe('navigateBack');
    expect(d.navigateBack).toHaveBeenCalledTimes(1);
    expect(d.showExitConfirm).not.toHaveBeenCalled();
  });

  it('Halaman_Utama: menampilkan konfirmasi keluar (Req 13.16)', () => {
    const d = deps('/');
    expect(d.run()).toBe('confirmExit');
    expect(d.showExitConfirm).toHaveBeenCalledTimes(1);
    expect(d.navigateBack).not.toHaveBeenCalled();
  });
});

describe('ExitConfirmDialog (Req 13.16–13.18)', () => {
  function renderDialog() {
    const onExit = vi.fn();
    const onCancel = vi.fn();
    render(
      <DialogStackProvider>
        <ExitConfirmDialog open onExit={onExit} onCancel={onCancel} />
      </DialogStackProvider>,
    );
    return { onExit, onCancel };
  }

  it('menyediakan tepat dua pilihan: Keluar dan Batal', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Keluar dari Aplikasi?' });
    const names = within(dialog)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names.sort()).toEqual(['Batal', 'Keluar']);
  });

  it('Keluar memanggil onExit; Batal memanggil onCancel', async () => {
    const { onExit, onCancel } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Keluar' }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('tidak dirender saat open=false', () => {
    render(
      <DialogStackProvider>
        <ExitConfirmDialog open={false} onExit={() => {}} onCancel={() => {}} />
      </DialogStackProvider>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('BackButtonHandler dengan MemoryRouter', () => {
  function LocationProbe() {
    return <div data-testid="path">{useLocation().pathname}</div>;
  }

  function FormDialog() {
    const [open, setOpen] = useState(true);
    return <Dialog open={open} title="Formulir Pasien" onClose={() => setOpen(false)} />;
  }

  function setup(entries: string[], withDialog = false) {
    const fake = createFakePlatform();
    const stack = createDialogStack();
    render(
      <DialogStackProvider stack={stack}>
        <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
          <LocationProbe />
          {withDialog ? <FormDialog /> : null}
          <BackButtonHandler platform={fake.platform} />
        </MemoryRouter>
      </DialogStackProvider>,
    );
    return { ...fake, stack };
  }

  it('dialog terbuka: menutup dialog dan tetap di halaman yang sama (Req 13.15)', () => {
    const f = setup(['/', '/jadwal'], true);
    expect(screen.getByRole('dialog', { name: 'Formulir Pasien' })).toBeInTheDocument();
    f.pressBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/jadwal');
    expect(f.stack.size()).toBe(0);
    expect(f.exitApp).not.toHaveBeenCalled();
  });

  it('bukan Halaman_Utama: kembali ke halaman sebelumnya tanpa keluar (Req 13.14)', () => {
    const f = setup(['/', '/pasien/abc']);
    f.pressBack();
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(f.exitApp).not.toHaveBeenCalled();
  });

  it('Halaman_Utama → Keluar memanggil exitApp (Req 13.16, 13.17)', async () => {
    const f = setup(['/']);
    f.pressBack();
    expect(screen.getByRole('dialog', { name: 'Keluar dari Aplikasi?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Keluar' }));
    expect(f.exitApp).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Halaman_Utama → Batal menutup dialog dan tetap di Halaman_Utama (Req 13.18)', async () => {
    const f = setup(['/']);
    f.pressBack();
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/$/);
    expect(f.exitApp).not.toHaveBeenCalled();
    expect(f.stack.size()).toBe(0);
  });

  it('melepas listener onBack saat unmount', () => {
    const f = setup(['/']);
    expect(f.hasHandler()).toBe(true);
    cleanup();
    expect(f.unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('Integrasi <App> dengan adapter platform palsu', () => {
  function renderApp(hash: string) {
    window.location.hash = hash;
    // Store tidak dimuat (status loading); navigasi & Tombol_Kembali tetap aktif.
    const store = createDataStore({ repository: () => new Promise(() => {}) });
    const dialogStack = createDialogStack();
    const fake = createFakePlatform();
    render(<App store={store} dialogStack={dialogStack} platform={fake.platform} />);
    return { ...fake, dialogStack };
  }

  const currentPath = () => window.location.hash.replace(/^#/, '') || '/';

  it('Halaman_Utama: back membuka konfirmasi, back lagi menutupnya seperti Batal (Req 13.16, 13.18)', () => {
    const f = renderApp('#/');
    expect(f.hasHandler()).toBe(true);

    f.pressBack();
    expect(screen.getByRole('dialog', { name: 'Keluar dari Aplikasi?' })).toBeInTheDocument();
    expect(f.dialogStack.size()).toBe(1);

    f.pressBack();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(f.dialogStack.size()).toBe(0);
    expect(f.exitApp).not.toHaveBeenCalled();
    expect(currentPath()).toBe('/');
  });

  it('Halaman_Utama: back lalu Keluar memanggil exitApp sekali (Req 13.17)', async () => {
    const f = renderApp('#/');
    f.pressBack();
    await userEvent.click(screen.getByRole('button', { name: 'Keluar' }));
    expect(f.exitApp).toHaveBeenCalledTimes(1);
  });

  it('dialog terdaftar di DialogStack: back menutupnya tanpa navigasi (Req 13.15)', () => {
    const f = renderApp('#/jadwal');
    const close = vi.fn();
    f.dialogStack.register({ close });
    f.pressBack();
    expect(close).toHaveBeenCalledTimes(1);
    expect(currentPath()).toBe('/jadwal');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('bukan Halaman_Utama: back kembali ke halaman sebelumnya (Req 13.14)', async () => {
    const f = renderApp('#/');
    await userEvent.click(screen.getAllByRole('link', { name: /Jadwal/ })[0]!);
    expect(currentPath()).toBe('/jadwal');

    f.pressBack();
    await vi.waitFor(() => expect(currentPath()).toBe('/'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(f.exitApp).not.toHaveBeenCalled();
  });
});
