// Halaman Laporan_Pemasukan per bulan (Requirement 9).
// Filter bulan/tahun default ke bulan & tahun berjalan; data laporan dihitung
// lewat selector DataStore yang ter-memoize (buildLaporan).

import { useId, useState, type ReactNode } from 'react';
import { NAMA_BULAN, formatRupiah, formatTanggal } from '../../domain/format';
import { pilihanTahun } from '../../domain/laporan';
import { useDataStoreSelector } from '../../state/dataStore';
import './LaporanPage.css';

export const PESAN_LAPORAN_KOSONG = 'Tidak ada pemasukan pada bulan ini';
export const PESAN_LAPORAN_GAGAL = 'Laporan gagal dimuat';

export function LaporanPage(): ReactNode {
  // Nilai awal dihitung sekali saat halaman dibuka (Req 9.1).
  const [awal] = useState(() => new Date());
  const [bulan, setBulan] = useState(() => awal.getMonth() + 1);
  const [tahun, setTahun] = useState(() => awal.getFullYear());
  const daftarTahun = pilihanTahun(awal);

  const idBulan = useId();
  const idTahun = useId();
  const idJudul = useId();

  // Saat penyimpanan gagal dimuat, laporan tidak disusun (Req 9.9).
  const laporan = useDataStoreSelector((store, state) =>
    state.status === 'ready' ? store.selectLaporan(bulan, tahun) : null,
  );
  const gagal = useDataStoreSelector((_store, state) => state.status === 'error');

  return (
    <section className="page laporan" aria-labelledby={idJudul}>
      <h1 id={idJudul}>Laporan Pemasukan</h1>

      <div className="laporan__filter">
        <div className="field">
          <label htmlFor={idBulan} className="field__label">
            Bulan
          </label>
          <select
            id={idBulan}
            className="field__input"
            value={bulan}
            onChange={(e) => setBulan(Number(e.target.value))}
          >
            {NAMA_BULAN.map((nama, i) => (
              <option key={nama} value={i + 1}>
                {nama}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor={idTahun} className="field__label">
            Tahun
          </label>
          <select
            id={idTahun}
            className="field__input"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value))}
          >
            {daftarTahun.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {gagal ? (
        <p role="alert" className="laporan__pesan laporan__pesan--error">
          {PESAN_LAPORAN_GAGAL}
        </p>
      ) : laporan === null ? (
        <p className="laporan__pesan" aria-live="polite">
          Memuat laporan…
        </p>
      ) : (
        <>
          <dl className="laporan__ringkasan" aria-live="polite">
            <div className="laporan__kartu">
              <dt>Total pemasukan</dt>
              <dd data-testid="laporan-total">{formatRupiah(laporan.total)}</dd>
            </div>
            <div className="laporan__kartu">
              <dt>Jumlah sesi</dt>
              <dd data-testid="laporan-jumlah-sesi">{laporan.jumlahSesi}</dd>
            </div>
            <div className="laporan__kartu">
              <dt>Jumlah pasien</dt>
              <dd data-testid="laporan-jumlah-pasien">{laporan.jumlahPasien}</dd>
            </div>
          </dl>

          <h2>Rincian</h2>
          {laporan.rincian.length === 0 ? (
            <p className="laporan__pesan">{PESAN_LAPORAN_KOSONG}</p>
          ) : (
            <ul className="laporan__rincian" aria-label="Rincian sesi terapi">
              {laporan.rincian.map((r) => (
                <li key={r.id} className="laporan__item">
                  <span className="laporan__item-nama">{r.namaPasien}</span>
                  <span className="laporan__item-meta">{formatTanggal(r.tanggal)}</span>
                  <span className="laporan__item-meta">{r.terapi}</span>
                  <span className="laporan__item-biaya">{formatRupiah(r.biaya)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
