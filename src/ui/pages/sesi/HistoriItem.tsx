// Satu entri Histori_Terapi (Req 3, 5, 7, 13): tanggal "DD MMMM YYYY", keluhan,
// Diagnosa, terapi, hasil, biaya, foto sesi, dan aksi Buat laporan PDF.

import { useState, type ReactNode } from 'react';
import { atauStrip, formatRupiah, formatTanggal } from '../../../domain/format';
import type { FotoSource, SesiTerapi } from '../../../domain/types';
import { useDataStore } from '../../../state/dataStore';
import { FotoStrip } from '../../components/FotoStrip';
import { PhotoViewer } from '../../components/PhotoViewer';
import { LaporanSesiFlow } from './LaporanSesiFlow';

export interface HistoriItemProps {
  sesi: SesiTerapi;
  onEdit?: (sesi: SesiTerapi) => void;
  onDelete?: (sesi: SesiTerapi) => void;
}

export function HistoriItem({ sesi, onEdit, onDelete }: HistoriItemProps): ReactNode {
  const store = useDataStore();
  const tanggal = formatTanggal(sesi.tanggal);

  const fotoList = store.selectFotoSesi(sesi.id);
  const pasien = store.selectPasien(sesi.pasienId);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [bukaLaporan, setBukaLaporan] = useState(false);

  const fotoSources: FotoSource[] = fotoList.map((meta) => ({
    key: meta.id,
    load: () => store.loadFotoBlob(meta),
  }));

  return (
    <>
      <article className="histori-item" aria-label={`Sesi terapi ${tanggal}`}>
        <header className="histori-item__header">
          <span className="histori-item__tanggal">{tanggal}</span>
          <span className="histori-item__biaya">{formatRupiah(sesi.biaya)}</span>
        </header>

        <dl className="histori-item__detail">
          <dt>Keluhan</dt>
          <dd>{sesi.keluhan}</dd>
          <dt>Diagnosa</dt>
          <dd>{atauStrip(sesi.polaPenyakit)}</dd>
          <dt>Terapi yang diberikan</dt>
          <dd>{sesi.terapi}</dd>
          <dt>Hasil terapi</dt>
          <dd>{atauStrip(sesi.hasil)}</dd>
        </dl>

        {fotoSources.length > 0 && (
          <div className="histori-item__foto">
            <FotoStrip
              sources={fotoSources}
              tanggal={sesi.tanggal}
              showCountBadge
              onFotoClick={(idx) => setViewerIndex(idx)}
            />
          </div>
        )}

        <div className="histori-item__actions">
          {pasien && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setBukaLaporan(true)}
              aria-label={`Buat laporan PDF sesi ${tanggal}`}
              data-testid="btn-laporan-pdf"
            >
              📄 Buat laporan PDF
            </button>
          )}

          {onEdit ? (
            <button
              type="button"
              className="btn"
              onClick={() => onEdit(sesi)}
              aria-label={`Ubah sesi ${tanggal}`}
            >
              Ubah
            </button>
          ) : null}

          {onDelete ? (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onDelete(sesi)}
              aria-label={`Hapus sesi ${tanggal}`}
            >
              Hapus
            </button>
          ) : null}
        </div>
      </article>

      {viewerIndex !== null && (
        <PhotoViewer
          sources={fotoSources}
          startIndex={viewerIndex}
          tanggal={sesi.tanggal}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {bukaLaporan && pasien && (
        <LaporanSesiFlow
          pasien={pasien}
          sesi={sesi}
          fotoList={fotoList}
          onTutup={() => setBukaLaporan(false)}
        />
      )}
    </>
  );
}
