// Feature: patient-therapy-management, Property 12: Tampilan item histori memuat seluruh field
//
// **Validates: Requirements 7.4**
//
// Untuk sesi valid apa pun, hasil render HistoriItem memuat formatTanggal(tanggal),
// keluhan, terapi, formatRupiah(biaya), serta pola penyakit dan hasil, atau "-"
// untuk masing-masing jika kosong.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cleanup, render, screen, within } from '@testing-library/react';
import { HistoriItem } from '../pages/sesi/HistoriItem';
import { formatRupiah, formatTanggal } from '../../domain/format';
import { sesiArb, trimmedText, BATAS } from '../../domain/__tests__/arbitraries';
import type { SesiTerapi } from '../../domain/types';

import { DataStore, DataStoreProvider } from '../../state/dataStore';

/** Teks pada <dd> yang mengikuti <dt> berlabel `label` (dibandingkan persis, tanpa normalisasi). */
function nilaiDetail(article: HTMLElement, label: string): string | null {
  const dt = within(article).getByText(label, { selector: 'dt' });
  const dd = dt.nextElementSibling;
  expect(dd?.tagName).toBe('DD');
  return dd?.textContent ?? null;
}

// Sesi valid; pola penyakit & hasil diberi peluang besar untuk kosong.
const opsionalArb = fc.oneof(fc.constant(''), trimmedText(0, BATAS.teksSesi));
const sesiTampilArb: fc.Arbitrary<SesiTerapi> = fc
  .tuple(sesiArb(), opsionalArb, opsionalArb)
  .map(([s, polaPenyakit, hasil]) => ({ ...s, polaPenyakit, hasil }));

const mockRepo = {
  loadAll: async () => ({ pasien: [], sesi: [], jadwal: [] }),
  loadAllFoto: async () => [],
  loadPengaturan: async () => null,
} as any;

describe('Property 12: Tampilan item histori memuat seluruh field', () => {
  it('render memuat tanggal, keluhan, diagnosa, terapi, hasil, dan biaya (atau "-")', async () => {
    const store = new DataStore({ repository: mockRepo });
    await store.load();

    fc.assert(
      fc.property(sesiTampilArb, (sesi) => {
        try {
          render(
            <DataStoreProvider store={store}>
              <HistoriItem sesi={sesi} />
            </DataStoreProvider>,
          );
          const tanggal = formatTanggal(sesi.tanggal);
          const article = screen.getByRole('article', { name: `Sesi terapi ${tanggal}` });

          const tanggalEl = article.querySelector('.histori-item__tanggal');
          const biayaEl = article.querySelector('.histori-item__biaya');
          expect(tanggalEl?.textContent).toBe(tanggal);
          expect(biayaEl?.textContent).toBe(formatRupiah(sesi.biaya));

          expect(nilaiDetail(article, 'Keluhan')).toBe(sesi.keluhan);
          expect(nilaiDetail(article, 'Terapi yang diberikan')).toBe(sesi.terapi);
          expect(nilaiDetail(article, 'Diagnosa')).toBe(sesi.polaPenyakit === '' ? '-' : sesi.polaPenyakit);
          expect(nilaiDetail(article, 'Hasil terapi')).toBe(sesi.hasil === '' ? '-' : sesi.hasil);
        } finally {
          cleanup();
        }
      }),
      { numRuns: 100 },
    );
  });
});
