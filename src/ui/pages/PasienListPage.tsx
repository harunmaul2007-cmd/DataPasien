// Halaman daftar pasien (Halaman_Utama), Req 1–4.
// - Daftar terurut nama berisi nama, alamat, nomor HP, dan tanggal terapi terakhir ("-" bila belum ada).
// - Pencarian maksimal 100 karakter dengan debounce 200 ms (< 500 ms Req 4.3).
// - Tombol tambah, ubah, dan hapus membuka dialog formulir / konfirmasi.

import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatTanggal } from '../../domain/format';
import type { Pasien } from '../../domain/types';
import { useDataStore, useDataStoreState } from '../../state/dataStore';
import { pasienDetailPath } from '../navigation/routes';
import { NomorWhatsApp } from '../components/NomorWhatsApp';
import { HapusPasienDialog } from './pasien/HapusPasienDialog';
import { PasienFormDialog, type PasienFormMode } from './pasien/PasienFormDialog';
import './pasien/pasien.css';

export const BATAS_KATA_KUNCI = 100;
export const DEBOUNCE_PENCARIAN_MS = 200;
export const PESAN_BELUM_ADA_PASIEN = 'Belum ada data pasien';
export const PESAN_PASIEN_TIDAK_DITEMUKAN_CARI = 'Pasien tidak ditemukan';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function PasienListPage(): ReactNode {
  const store = useDataStore();
  // Berlangganan state agar daftar & tanggal terapi terakhir ikut diperbarui.
  const { data } = useDataStoreState();
  const searchId = useId();

  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebounced(keyword, DEBOUNCE_PENCARIAN_MS);
  const [form, setForm] = useState<PasienFormMode | null>(null);
  const [hapusId, setHapusId] = useState<string | null>(null);

  const list = store.selectPasienList(debouncedKeyword);
  const totalPasien = data.pasien.length;

  let emptyMessage: string | null = null;
  if (totalPasien === 0) emptyMessage = PESAN_BELUM_ADA_PASIEN;
  else if (list.length === 0 && debouncedKeyword.trim() !== '') emptyMessage = PESAN_PASIEN_TIDAK_DITEMUKAN_CARI;

  return (
    <section className="page pasien-list" aria-labelledby={`${searchId}-title`}>
      <div className="pasien-list__header">
        <h1 id={`${searchId}-title`}>Pasien</h1>
        <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'tambah' })}>
          + Tambah Pasien
        </button>
      </div>

      <div className="field pasien-list__search" role="search">
        <label htmlFor={searchId} className="field__label">
          Cari pasien
        </label>
        <input
          id={searchId}
          type="search"
          className="field__input"
          placeholder="Nama atau nomor HP"
          autoComplete="off"
          maxLength={BATAS_KATA_KUNCI}
          value={keyword}
          // Potong juga secara eksplisit (mis. tempel teks) agar tidak lebih dari 100 karakter (Req 4.6).
          onChange={(e) => setKeyword(e.target.value.slice(0, BATAS_KATA_KUNCI))}
        />
      </div>

      {emptyMessage ? (
        <p className="pasien-list__empty" role="status">
          {emptyMessage}
        </p>
      ) : (
        <ul className="pasien-list__items" aria-label="Daftar pasien">
          {list.map((p) => (
            <PasienItem
              key={p.id}
              pasien={p}
              terakhir={store.selectLastTherapyDate(p.id)}
              onUbah={() => setForm({ mode: 'ubah', pasienId: p.id })}
              onHapus={() => setHapusId(p.id)}
            />
          ))}
        </ul>
      )}

      <PasienFormDialog open={form !== null} target={form ?? { mode: 'tambah' }} onClose={() => setForm(null)} />
      <HapusPasienDialog pasienId={hapusId} onClose={() => setHapusId(null)} />
    </section>
  );
}

interface PasienItemProps {
  pasien: Pasien;
  terakhir: string | null;
  onUbah: () => void;
  onHapus: () => void;
}

function PasienItem({ pasien, terakhir, onUbah, onHapus }: PasienItemProps): ReactNode {
  return (
    <li className="pasien-card" data-testid="pasien-item">
      <div className="pasien-card__info">
        <Link to={pasienDetailPath(pasien.id)} className="pasien-card__nama">
          {pasien.nama}
        </Link>
        <dl className="pasien-card__meta">
          <div>
            <dt>Alamat</dt>
            <dd>{pasien.alamat || '-'}</dd>
          </div>
          <div>
            <dt>Nomor HP</dt>
            <dd>
              <NomorWhatsApp noHp={pasien.noHp} nama={pasien.nama} />
            </dd>
          </div>
          <div>
            <dt>Terapi terakhir</dt>
            <dd data-testid="pasien-terakhir">{terakhir ? formatTanggal(terakhir) : '-'}</dd>
          </div>
        </dl>
      </div>
      <div className="pasien-card__actions">
        <button type="button" className="btn" onClick={onUbah} aria-label={`Ubah ${pasien.nama}`}>
          Ubah
        </button>
        <button type="button" className="btn btn--danger" onClick={onHapus} aria-label={`Hapus ${pasien.nama}`}>
          Hapus
        </button>
      </div>
    </li>
  );
}
