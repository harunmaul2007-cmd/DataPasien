// Halaman detail pasien: data pasien, ringkasan & Histori_Terapi, jadwal
// kunjungan Terjadwal, serta tambah/ubah/hapus sesi terapi.
// Req 5.1, 5.7, 6.1–6.7, 7.1–7.9, 8.11.
//
// Seluruh data dibaca lewat selector DataStore (useSyncExternalStore), sehingga
// histori, jumlah sesi, dan total biaya diperbarui otomatis setelah sesi
// disimpan, diubah, atau dihapus (Req 7.7).

import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatJam, formatJenisKelamin, formatRupiah, formatTanggal, formatUmur } from '../../domain/format';
import type { SesiTerapi } from '../../domain/types';
import { useDataStoreSelector, useDataStoreState } from '../../state/dataStore';
import { NomorWhatsApp } from '../components/NomorWhatsApp';
import { ROUTES } from '../navigation/routes';
import { HapusSesiDialog } from './sesi/HapusSesiDialog';
import { HistoriItem } from './sesi/HistoriItem';
import { SesiFormDialog } from './sesi/SesiFormDialog';
import './PasienDetailPage.css';

export const PESAN_PASIEN_TIDAK_DITEMUKAN = 'Pasien tidak ditemukan';
export const PESAN_HISTORI_KOSONG = 'Belum ada histori terapi';
export const PESAN_HISTORI_GAGAL = 'Histori terapi gagal dimuat';
export const PESAN_JADWAL_KOSONG = 'Belum ada jadwal kunjungan';

type FormState = { mode: 'tambah' } | { mode: 'ubah'; sesi: SesiTerapi } | null;

function KembaliLink(): ReactNode {
  return (
    <Link to={ROUTES.pasienList} className="btn pasien-detail__back">
      ← Daftar pasien
    </Link>
  );
}

export function PasienDetailPage(): ReactNode {
  const { id = '' } = useParams<{ id: string }>();
  const { status } = useDataStoreState();

  if (status === 'error') {
    return (
      <section className="page pasien-detail">
        <KembaliLink />
        <p role="alert" className="pasien-detail__message">
          {PESAN_HISTORI_GAGAL}
        </p>
      </section>
    );
  }

  return <PasienDetailContent pasienId={id} />;
}

function PasienDetailContent({ pasienId }: { pasienId: string }): ReactNode {
  const pasien = useDataStoreSelector((s) => s.selectPasien(pasienId));
  const histori = useDataStoreSelector((s) => s.selectHistori(pasienId));
  const jadwal = useDataStoreSelector((s) => s.selectJadwalTerjadwalPasien(pasienId));

  const [form, setForm] = useState<FormState>(null);
  const [hapus, setHapus] = useState<SesiTerapi | null>(null);

  if (!pasien) {
    return (
      <section className="page pasien-detail">
        <KembaliLink />
        <p role="status" className="pasien-detail__message">
          {PESAN_PASIEN_TIDAK_DITEMUKAN}
        </p>
      </section>
    );
  }

  return (
    <section className="page pasien-detail" aria-labelledby="pasien-detail-nama">
      <KembaliLink />

      <div className="pasien-detail__card">
        <h1 id="pasien-detail-nama">{pasien.nama}</h1>
        <dl className="pasien-detail__info">
          <dt>Umur</dt>
          <dd>{formatUmur(pasien.umur)}</dd>
          <dt>Jenis Kelamin</dt>
          <dd>{formatJenisKelamin(pasien.jenisKelamin)}</dd>
          <dt>Alamat</dt>
          <dd>{pasien.alamat === '' ? '-' : pasien.alamat}</dd>
          <dt>Nomor HP</dt>
          <dd>
            <NomorWhatsApp noHp={pasien.noHp} nama={pasien.nama} />
          </dd>
        </dl>
      </div>

      <div className="pasien-detail__ringkasan" aria-label="Ringkasan terapi">
        <div className="pasien-detail__stat">
          <span className="pasien-detail__stat-label">Jumlah sesi</span>
          <span className="pasien-detail__stat-value" data-testid="jumlah-sesi">
            {histori.jumlah}
          </span>
        </div>
        <div className="pasien-detail__stat">
          <span className="pasien-detail__stat-label">Total biaya</span>
          <span className="pasien-detail__stat-value" data-testid="total-biaya">
            {formatRupiah(histori.totalBiaya)}
          </span>
        </div>
      </div>

      <section className="pasien-detail__section" aria-labelledby="pasien-detail-jadwal">
        <h2 id="pasien-detail-jadwal">Jadwal kunjungan</h2>
        {jadwal.length === 0 ? (
          <p className="pasien-detail__empty">{PESAN_JADWAL_KOSONG}</p>
        ) : (
          <ul className="pasien-detail__jadwal">
            {jadwal.map((j) => (
              <li key={j.id} className="pasien-detail__jadwal-item">
                <span className="pasien-detail__jadwal-waktu">
                  {formatTanggal(j.tanggal)}, {formatJam(j.jam)}
                </span>
                {j.catatan ? <span className="pasien-detail__jadwal-catatan">{j.catatan}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pasien-detail__section" aria-labelledby="pasien-detail-histori">
        <div className="pasien-detail__section-header">
          <h2 id="pasien-detail-histori">Histori terapi</h2>
          <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'tambah' })}>
            Tambah sesi
          </button>
        </div>
        {histori.items.length === 0 ? (
          <p className="pasien-detail__empty">{PESAN_HISTORI_KOSONG}</p>
        ) : (
          <ul className="pasien-detail__histori">
            {histori.items.map((s) => (
              <li key={s.id}>
                <HistoriItem
                  sesi={s}
                  onEdit={(sesi) => setForm({ mode: 'ubah', sesi })}
                  onDelete={(sesi) => setHapus(sesi)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <SesiFormDialog
        open={form !== null}
        pasienId={pasien.id}
        sesi={form?.mode === 'ubah' ? form.sesi : null}
        onClose={() => setForm(null)}
      />

      <HapusSesiDialog sesi={hapus} namaPasien={pasien.nama} onClose={() => setHapus(null)} />
    </section>
  );
}
