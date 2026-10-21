// Unit test kerangka UI: navigasi utama, DialogStack, dan layar gagal muat.
// Requirements: 10.6, 11.2, 11.6

import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../App';
import { MainNav, isNavActive } from '../navigation/MainNav';
import { MAIN_NAV, ROUTES } from '../navigation/routes';
import { Dialog } from '../components/Dialog';
import { createDialogStack, DialogStackProvider } from '../components/DialogStack';
import { createDataStore } from '../../state/dataStore';

describe('MainNav (Req 11.2, 11.6)', () => {
  it('menampilkan empat menu utama Pasien, Jadwal, Laporan, Pengaturan beserta menu Cadangan', () => {
    render(
      <MemoryRouter initialEntries={['/jadwal']}>
        <MainNav />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Navigasi utama' });
    for (const label of ['Pasien', 'Jadwal', 'Laporan', 'Pengaturan']) {
      expect(within(nav).getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(MAIN_NAV.map((i) => i.label)).toEqual(['Pasien', 'Jadwal', 'Laporan', 'Pengaturan']);
    expect(within(nav).getByRole('link', { name: 'Cadangan' })).toHaveAttribute('href', '/cadangan');
    // Menu aktif sesuai rute.
    expect(within(nav).getByRole('link', { name: /Jadwal/ })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: /Pasien/ })).not.toHaveAttribute('aria-current');
  });

  it('menandai Pasien aktif pada halaman daftar maupun detail pasien', () => {
    const pasien = MAIN_NAV.find((i) => i.to === ROUTES.pasienList)!;
    expect(isNavActive(pasien, '/')).toBe(true);
    expect(isNavActive(pasien, '/pasien/abc')).toBe(true);
    expect(isNavActive(pasien, '/jadwal')).toBe(false);
  });
});

describe('DialogStack (Req 11.6, 13.15)', () => {
  it('closeTop menutup dialog teratas lebih dulu, lalu dialog di bawahnya', () => {
    const stack = createDialogStack();

    function Harness() {
      const [aOpen, setAOpen] = useState(true);
      const [bOpen, setBOpen] = useState(true);
      return (
        <>
          <Dialog open={aOpen} title="Dialog A" onClose={() => setAOpen(false)} />
          <Dialog open={bOpen} title="Dialog B" onClose={() => setBOpen(false)} />
        </>
      );
    }

    render(
      <DialogStackProvider stack={stack}>
        <Harness />
      </DialogStackProvider>,
    );
    expect(stack.size()).toBe(2);
    expect(screen.getByText('Dialog A')).toBeInTheDocument();
    expect(screen.getByText('Dialog B')).toBeInTheDocument();

    act(() => {
      expect(stack.closeTop()).toBe(true);
    });
    expect(screen.queryByText('Dialog B')).not.toBeInTheDocument();
    expect(screen.getByText('Dialog A')).toBeInTheDocument();
    expect(stack.size()).toBe(1);

    act(() => {
      expect(stack.closeTop()).toBe(true);
    });
    expect(screen.queryByText('Dialog A')).not.toBeInTheDocument();
    expect(stack.size()).toBe(0);
    expect(stack.closeTop()).toBe(false);
  });

  it('createDialogStack: melepas pendaftaran bersifat idempoten dan closeTop memanggil entri terakhir', () => {
    const stack = createDialogStack();
    const closeA = vi.fn();
    const closeB = vi.fn();
    stack.register({ close: closeA });
    const unregB = stack.register({ close: closeB });
    unregB();
    unregB();
    expect(stack.size()).toBe(1);
    expect(stack.closeTop()).toBe(true);
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).not.toHaveBeenCalled();
  });
});

describe('Layar gagal muat (Req 10.6)', () => {
  it('menampilkan "Data gagal dimuat" saat load() gagal dan Coba lagi memuat ulang', async () => {
    const factory = vi.fn(() => Promise.reject(new Error('IndexedDB tidak tersedia')));
    const store = createDataStore({ repository: factory });
    window.location.hash = '#/';

    render(<App store={store} />);
    await act(async () => {
      await store.load();
    });

    expect(store.getState().status).toBe('error');
    expect(await screen.findByRole('alert')).toHaveTextContent('Data gagal dimuat');
    // Navigasi tetap tersedia, halaman tidak dirender.
    expect(screen.getByRole('navigation', { name: 'Navigasi utama' })).toBeInTheDocument();
    expect(factory).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    await vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Data gagal dimuat')).toBeInTheDocument();
  });
});
