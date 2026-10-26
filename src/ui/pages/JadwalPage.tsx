// Halaman jadwal kunjungan (Req 8.1–8.10, 8.12–8.14).
// - Pemilih tanggal (default hari ini) dan daftar seluruh jadwal pada tanggal
//   tersebut (semua status) urut jam menaik via selectJadwalPadaTanggal.
// - Setiap jadwal menampilkan nama pasien, nomor HP, tanggal, jam (JJ:MM),
//   catatan, dan status. Aksi mengikuti aksiTersedia (Req 8.14).
// - Tandai Selesai → dialog "Catat sesi terapi sekarang?"; jika ya, SesiFormDialog
//   dibuka dengan pasienId dan tanggal jadwal (Req 8.9).

import { useId, useState, type ReactNode } from 'react';
import { formatJam, formatTanggal } from '../../domain/format';
import { aksiTersedia } from '../../domain/jadwal';
import { todayISO } from '../../domain/tanggal';
import type { JadwalKunjungan, Pasien } from '../../domain/types';
import { NotFoundError } from '../../infra/errors';
import { PESAN_GAGAL_SIMPAN, useDataStore, useDataStoreState } from '../../state/dataStore';
import { Dialog } from '../components/Dialog';
import { NomorWhatsApp } from '../components/NomorWhatsApp';
import { useToast } from '../components/Toast';
import { HapusJadwalDialog } from './jadwal/HapusJadwalDialog';
import { JadwalFormDialog, PESAN_JADWAL_TIDAK_DITEMUKAN } from './jadwal/JadwalFormDialog';
import { SesiFormDialog } from './sesi/SesiFormDialog';
import './jadwal/jadwal.css';

export const PESAN_TIDAK_ADA_JADWAL = 'Tidak ada jadwal pada tanggal ini';
export const PESAN_TANDAI_SELESAI = 'Jadwal ditandai Selesai';
export const PESAN_TANDAI_DIBATALKAN = 'Jadwal ditandai Dibatalkan';
export const JUDUL_TAWARAN_SESI = 'Catat sesi terapi sekarang?';

type FormState = { mode: 'tambah' } | { mode: 'ubah'; jadwal: JadwalKunjungan } | null;
type SesiTarget = { pasienId: string; tanggal: string };
type FilterMode = 'semua' | 'tanggal';

export function JadwalPage(): ReactNode {
  const store = useDataStore();
  const toast = useToast();
  // Berlangganan state agar daftar ikut diperbarui setelah setiap perubahan.
  useDataStoreState();
  const baseId = useId();
  const tanggalId = `${baseId}-tanggal`;

  // Default awal adalah 'semua' agar seluruh data jadwal yang sudah ada langsung tampil.
  const [filterMode, setFilterMode] = useState<FilterMode>('semua');
  const [tanggal, setTanggal] = useState(() => todayISO(new Date()));
  const [form, setForm] = useState<FormState>(null);
  const [hapus, setHapus] = useState<JadwalKunjungan | null>(null);
  const [tawaran, setTawaran] = useState<SesiTarget | null>(null);
  const [sesiTarget, setSesiTarget] = useState<SesiTarget | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const semuaJadwalList = store.selectSemuaJadwal();
  const list = filterMode === 'semua' ? semuaJadwalList : store.selectJadwalPadaTanggal(tanggal);
  const namaPasien = (id: string) => store.selectPasien(id)?.nama ?? '-';

  async function ubahStatus(j: JadwalKunjungan, target: 'Selesai' | 'Dibatalkan') {
    if (busyId) return;
    setBusyId(j.id);
    try {
      const hasil = target === 'Selesai' ? await store.tandaiSelesai(j.id) : await store.tandaiDibatalkan(j.id);
      if (!hasil) return; // Status sudah bukan Terjadwal; tidak ada perubahan.
      if (target === 'Selesai') {
        toast.success(PESAN_TANDAI_SELESAI);
        setTawaran({ pasienId: hasil.pasienId, tanggal: hasil.tanggal });
      } else {
        toast.success(PESAN_TANDAI_DIBATALKAN);
      }
    } catch (err) {
      toast.error(err instanceof NotFoundError ? PESAN_JADWAL_TIDAK_DITEMUKAN : `${PESAN_GAGAL_SIMPAN}, silakan coba lagi`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page jadwal-page" aria-labelledby={`${baseId}-title`}>
      <div className="jadwal-page__header">
        <h1 id={`${baseId}-title`}>Jadwal</h1>
        <button type="button" className="btn btn--primary" onClick={() => setForm({ mode: 'tambah' })}>
          + Tambah Jadwal
        </button>
      </div>

      <div className="jadwal-page__filter-wrapper">
        <div className="jadwal-filter-bar" role="group" aria-label="Filter Jadwal">
          <button
            type="button"
            className={`btn${filterMode === 'semua' ? ' btn--primary' : ''}`}
            onClick={() => setFilterMode('semua')}
            data-testid="filter-semua-jadwal"
          >
            Semua Jadwal ({semuaJadwalList.length})
          </button>
          <button
            type="button"
            className={`btn${filterMode === 'tanggal' && tanggal === todayISO(new Date()) ? ' btn--primary' : ''}`}
            onClick={() => {
              setTanggal(todayISO(new Date()));
              setFilterMode('tanggal');
            }}
            data-testid="filter-hari-ini"
          >
            Hari Ini
          </button>
        </div>

        <div className="field jadwal-page__tanggal">
          <label htmlFor={tanggalId} className="field__label">
            Tanggal
          </label>
          <input
            id={tanggalId}
            type="date"
            className="field__input"
            value={tanggal}
            // Input dikosongkan (mis. tombol hapus peramban) → kembali ke hari ini.
            onChange={(e) => {
              setTanggal(e.target.value || todayISO(new Date()));
              setFilterMode('tanggal');
            }}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <p className="jadwal-page__empty" role="status">
          {PESAN_TIDAK_ADA_JADWAL}
        </p>
      ) : (
        <ul className="jadwal-page__items" aria-label="Daftar jadwal">
          {list.map((j) => (
            <JadwalItem
              key={j.id}
              jadwal={j}
              pasien={store.selectPasien(j.pasienId)}
              busy={busyId === j.id}
              onUbah={() => setForm({ mode: 'ubah', jadwal: j })}
              onSelesai={() => void ubahStatus(j, 'Selesai')}
              onBatal={() => void ubahStatus(j, 'Dibatalkan')}
              onHapus={() => setHapus(j)}
            />
          ))}
        </ul>
      )}

      <JadwalFormDialog
        open={form !== null}
        jadwal={form?.mode === 'ubah' ? form.jadwal : null}
        initialTanggal={tanggal}
        onClose={() => setForm(null)}
        onSaved={(j) => {
          setForm(null);
          // Tampilkan tanggal jadwal yang baru disimpan (Req 8.1, 8.7).
          setTanggal(j.tanggal);
          setFilterMode('tanggal');
        }}
      />

      <HapusJadwalDialog
        jadwal={hapus}
        namaPasien={hapus ? namaPasien(hapus.pasienId) : ''}
        onClose={() => setHapus(null)}
      />

      <Dialog
        open={tawaran !== null}
        title={JUDUL_TAWARAN_SESI}
        onClose={() => setTawaran(null)}
        actions={
          <>
            <button type="button" className="btn" onClick={() => setTawaran(null)}>
              Tidak
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setSesiTarget(tawaran);
                setTawaran(null);
              }}
            >
              Ya, catat sesi
            </button>
          </>
        }
      >
        {tawaran ? (
          <p>
            Jadwal <strong>{namaPasien(tawaran.pasienId)}</strong> pada{' '}
            <strong>{formatTanggal(tawaran.tanggal)}</strong> telah ditandai Selesai. Buka formulir sesi terapi
            baru untuk pasien ini?
          </p>
        ) : null}
      </Dialog>

      <SesiFormDialog
        open={sesiTarget !== null}
        pasienId={sesiTarget?.pasienId ?? ''}
        initialTanggal={sesiTarget?.tanggal}
        onClose={() => setSesiTarget(null)}
      />
    </section>
  );
}

interface JadwalItemProps {
  jadwal: JadwalKunjungan;
  pasien: Pasien | undefined;
  busy: boolean;
  onUbah: () => void;
  onSelesai: () => void;
  onBatal: () => void;
  onHapus: () => void;
}

function JadwalItem({ jadwal, pasien, busy, onUbah, onSelesai, onBatal, onHapus }: JadwalItemProps): ReactNode {
  const aksi = aksiTersedia(jadwal);
  const nama = pasien?.nama ?? '-';
  const label = `${nama} ${formatJam(jadwal.jam)}`;
  const statusClass = `jadwal-status jadwal-status--${jadwal.status.toLowerCase()}`;

  return (
    <li className="jadwal-card" data-testid="jadwal-item">
      <div className="jadwal-card__header">
        <span className="jadwal-card__jam">{formatJam(jadwal.jam)}</span>
        <span className="jadwal-card__nama">{nama}</span>
        <span className={statusClass} data-testid="jadwal-status">
          {jadwal.status}
        </span>
      </div>
      <dl className="jadwal-card__meta">
        <div>
          <dt>Nomor HP</dt>
          <dd>
            {pasien?.noHp ? (
              <NomorWhatsApp noHp={pasien.noHp} nama={pasien.nama} />
            ) : (
              '-'
            )}
          </dd>
        </div>
        <div>
          <dt>Tanggal</dt>
          <dd>{formatTanggal(jadwal.tanggal)}</dd>
        </div>
        <div>
          <dt>Catatan</dt>
          <dd>{jadwal.catatan}</dd>
        </div>
      </dl>
      <div className="jadwal-card__actions">
        {aksi.selesai ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={onSelesai}
            disabled={busy}
            aria-label={`Tandai Selesai ${label}`}
          >
            Tandai Selesai
          </button>
        ) : null}
        {aksi.batal ? (
          <button type="button" className="btn" onClick={onBatal} disabled={busy} aria-label={`Tandai Dibatalkan ${label}`}>
            Tandai Dibatalkan
          </button>
        ) : null}
        {aksi.ubah ? (
          <button type="button" className="btn" onClick={onUbah} disabled={busy} aria-label={`Ubah jadwal ${label}`}>
            Ubah
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn--danger"
          onClick={onHapus}
          disabled={busy}
          aria-label={`Hapus jadwal ${label}`}
        >
          Hapus
        </button>
      </div>
    </li>
  );
}
