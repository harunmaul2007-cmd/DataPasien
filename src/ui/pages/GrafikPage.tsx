// Menu Grafik: grafik garis jumlah pasien yang terapi per hari dalam satu bulan.
// Filter bulan/tahun default ke bulan & tahun berjalan.

import { useId, useState, type ReactNode } from 'react';
import { NAMA_BULAN } from '../../domain/format';
import { skalaSumbuY, type GrafikBulanan } from '../../domain/grafik';
import { pilihanTahun } from '../../domain/laporan';
import { useDataStoreSelector } from '../../state/dataStore';
import './LaporanPage.css';
import './GrafikPage.css';

export const PESAN_GRAFIK_KOSONG = 'Belum ada pasien yang terapi pada bulan ini';
export const PESAN_GRAFIK_GAGAL = 'Grafik gagal dimuat';

export function GrafikPage(): ReactNode {
  const [awal] = useState(() => new Date());
  const [bulan, setBulan] = useState(() => awal.getMonth() + 1);
  const [tahun, setTahun] = useState(() => awal.getFullYear());
  const daftarTahun = pilihanTahun(awal);
  const idBulan = useId();
  const idTahun = useId();
  const idJudul = useId();

  const grafik = useDataStoreSelector((store, state) =>
    state.status === 'ready' ? store.selectGrafikBulanan(bulan, tahun) : null,
  );
  const gagal = useDataStoreSelector((_store, state) => state.status === 'error');
  const namaBulan = NAMA_BULAN[bulan - 1]!;

  return (
    <section className="page grafik" aria-labelledby={idJudul}>
      <h1 id={idJudul}>Grafik Pasien</h1>

      <div className="laporan__filter">
        <div className="field">
          <label htmlFor={idBulan} className="field__label">
            Bulan
          </label>
          <select id={idBulan} className="field__input" value={bulan} onChange={(e) => setBulan(Number(e.target.value))}>
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
          <select id={idTahun} className="field__input" value={tahun} onChange={(e) => setTahun(Number(e.target.value))}>
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
          {PESAN_GRAFIK_GAGAL}
        </p>
      ) : grafik === null ? (
        <p className="laporan__pesan" aria-live="polite">
          Memuat grafik…
        </p>
      ) : (
        <>
          <dl className="laporan__ringkasan" aria-live="polite">
            <div className="laporan__kartu">
              <dt>Pasien terapi</dt>
              <dd data-testid="grafik-total-pasien">{grafik.totalPasien}</dd>
            </div>
            <div className="laporan__kartu">
              <dt>Jumlah sesi</dt>
              <dd data-testid="grafik-total-sesi">{grafik.totalSesi}</dd>
            </div>
            <div className="laporan__kartu">
              <dt>Terbanyak per hari</dt>
              <dd data-testid="grafik-puncak">{grafik.puncak}</dd>
            </div>
          </dl>

          <h2>
            Jumlah pasien per hari, {namaBulan} {tahun}
          </h2>
          <div className="grafik__kanvas">
            <GrafikGaris grafik={grafik} judul={`Jumlah pasien terapi per hari, ${namaBulan} ${tahun}`} />
          </div>
          {grafik.totalSesi === 0 ? <p className="laporan__pesan">{PESAN_GRAFIK_KOSONG}</p> : null}
        </>
      )}
    </section>
  );
}

// Ukuran kanvas SVG (satuan viewBox); diskalakan mengikuti lebar layar.
// Lebar kecil + font 18 agar label sumbu tetap terbaca (~12 px) di layar HP.
const W = 480;
const H = 260;
const PAD = { kiri: 34, kanan: 12, atas: 14, bawah: 30 };

function GrafikGaris({ grafik, judul }: { grafik: GrafikBulanan; judul: string }): ReactNode {
  const { titik } = grafik;
  const { maks, langkah } = skalaSumbuY(grafik.puncak);
  const lebar = W - PAD.kiri - PAD.kanan;
  const tinggi = H - PAD.atas - PAD.bawah;
  const x = (hari: number) => PAD.kiri + ((hari - 1) / Math.max(1, titik.length - 1)) * lebar;
  const y = (v: number) => PAD.atas + tinggi - (v / maks) * tinggi;

  const garisY: number[] = [];
  for (let v = 0; v <= maks; v += langkah) garisY.push(v);
  // Label sumbu X: tanggal 1, kelipatan 5, dan tanggal terakhir.
  const labelX = titik.filter((t) => t.hari === 1 || t.hari % 5 === 0 || t.hari === titik.length);
  const path = titik.map((t, i) => `${i === 0 ? 'M' : 'L'}${x(t.hari).toFixed(1)},${y(t.jumlahPasien).toFixed(1)}`).join(' ');
  const area = `${path} L${x(titik.length).toFixed(1)},${y(0)} L${x(1).toFixed(1)},${y(0)} Z`;

  return (
    <svg
      className="grafik__svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={judul}
      data-testid="grafik-garis"
      preserveAspectRatio="xMidYMid meet"
    >
      <title>{judul}</title>
      {garisY.map((v) => (
        <g key={v}>
          <line className="grafik__grid" x1={PAD.kiri} x2={W - PAD.kanan} y1={y(v)} y2={y(v)} />
          <text className="grafik__label" x={PAD.kiri - 6} y={y(v)} textAnchor="end" dominantBaseline="middle">
            {v}
          </text>
        </g>
      ))}
      {labelX.map((t) => (
        <text key={t.hari} className="grafik__label" x={x(t.hari)} y={H - 6} textAnchor="middle">
          {t.hari}
        </text>
      ))}
      <path className="grafik__area" d={area} />
      <path className="grafik__garis" d={path} />
      {titik.map((t) =>
        t.jumlahPasien > 0 ? (
          <circle key={t.hari} className="grafik__titik" cx={x(t.hari)} cy={y(t.jumlahPasien)} r={3.5}>
            <title>{`Tanggal ${t.hari}: ${t.jumlahPasien} pasien`}</title>
          </circle>
        ) : null,
      )}
    </svg>
  );
}
