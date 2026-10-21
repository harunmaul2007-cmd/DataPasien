// InfoPasien: informasi baca-saja Data Pasien pada Formulir Sesi (Req 1).

import type { Pasien } from '../../domain/types';
import { formatJenisKelamin, formatUmur, atauStrip } from '../../domain/format';

export interface InfoPasienProps {
  pasien: Pasien;
}

export function InfoPasien({ pasien }: InfoPasienProps) {
  return (
    <div className="info-pasien-card" data-testid="info-pasien">
      <dl className="info-pasien-list">
        <div className="info-pasien-row">
          <dt>Nama</dt>
          <dd>{pasien.nama}</dd>
        </div>
        <div className="info-pasien-row">
          <dt>Umur</dt>
          <dd>{formatUmur(pasien.umur)}</dd>
        </div>
        <div className="info-pasien-row">
          <dt>Jenis Kelamin</dt>
          <dd>{formatJenisKelamin(pasien.jenisKelamin)}</dd>
        </div>
        <div className="info-pasien-row">
          <dt>Alamat</dt>
          <dd>{atauStrip(pasien.alamat)}</dd>
        </div>
        <div className="info-pasien-row">
          <dt>Nomor HP</dt>
          <dd>{atauStrip(pasien.noHp)}</dd>
        </div>
      </dl>
    </div>
  );
}
