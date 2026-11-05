// Unit test halaman Grafik: default bulan berjalan, ringkasan, dan ganti filter.

import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NAMA_BULAN } from '../../../domain/format';
import { todayISO } from '../../../domain/tanggal';
import { DexieRepository, openRepository } from '../../../infra/repository';
import { DataStore, DataStoreProvider } from '../../../state/dataStore';
import { GrafikPage, PESAN_GRAFIK_KOSONG } from '../GrafikPage';

let counter = 0;
const opened: DexieRepository[] = [];

afterEach(async () => {
  const repos = opened.splice(0);
  for (const r of repos) r.close();
  for (const r of repos) await r.db.delete();
});

async function setup() {
  const repo = await openRepository(`test-grafik-${Date.now()}-${counter++}`, { requestPersist: false });
  opened.push(repo);
  const store = new DataStore({ repository: repo });
  await store.load();
  const a = await store.addPasien({ nama: 'Ani', alamat: 'Jl. 1', noHp: '081234567890' });
  const b = await store.addPasien({ nama: 'Budi', alamat: 'Jl. 2', noHp: '081234567891' });
  if (!a.ok || !b.ok) throw new Error('seed gagal');
  const sesi = { keluhan: 'Pusing', polaPenyakit: '', terapi: 'Pijat', hasil: '', biaya: '50000' };
  const hariIni = todayISO(new Date());
  await store.addSesi(a.value.id, { ...sesi, tanggal: hariIni });
  await store.addSesi(b.value.id, { ...sesi, tanggal: hariIni });
  await store.addSesi(a.value.id, { ...sesi, tanggal: hariIni });
  await store.addSesi(a.value.id, { ...sesi, tanggal: '2020-06-15' });
  render(
    <DataStoreProvider store={store}>
      <GrafikPage />
    </DataStoreProvider>,
  );
}

describe('GrafikPage', () => {
  it('default bulan & tahun berjalan; menampilkan grafik dan ringkasan pasien', async () => {
    await setup();
    const now = new Date();
    expect(screen.getByLabelText('Bulan')).toHaveValue(String(now.getMonth() + 1));
    expect(screen.getByLabelText('Tahun')).toHaveValue(String(now.getFullYear()));
    expect(screen.getByTestId('grafik-total-pasien')).toHaveTextContent('2');
    expect(screen.getByTestId('grafik-total-sesi')).toHaveTextContent('3');
    expect(screen.getByTestId('grafik-puncak')).toHaveTextContent('2');
    expect(
      screen.getByRole('img', { name: `Jumlah pasien terapi per hari, ${NAMA_BULAN[now.getMonth()]} ${now.getFullYear()}` }),
    ).toBeInTheDocument();
    expect(screen.queryByText(PESAN_GRAFIK_KOSONG)).not.toBeInTheDocument();
  });

  it('mengganti bulan/tahun memperbarui grafik; bulan kosong menampilkan pesan', async () => {
    const user = userEvent.setup();
    await setup();
    await user.selectOptions(screen.getByLabelText('Tahun'), '2020');
    await user.selectOptions(screen.getByLabelText('Bulan'), '6');
    expect(screen.getByTestId('grafik-total-pasien')).toHaveTextContent('1');
    expect(screen.getByTestId('grafik-total-sesi')).toHaveTextContent('1');

    await user.selectOptions(screen.getByLabelText('Bulan'), '7');
    expect(screen.getByTestId('grafik-total-sesi')).toHaveTextContent('0');
    expect(screen.getByText(PESAN_GRAFIK_KOSONG)).toBeInTheDocument();
    expect(screen.getByTestId('grafik-garis')).toBeInTheDocument();
  });
});
