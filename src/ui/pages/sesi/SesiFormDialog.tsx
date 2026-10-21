// Formulir sesi terapi (tambah & ubah) dalam Dialog (Req 1, 2, 4, 13).

import { useReducer, useState, type FormEvent, type ReactNode } from 'react';
import { draftAwal, fotoDraftReducer } from '../../../domain/foto';
import { todayISO } from '../../../domain/tanggal';
import type { FieldErrors, FotoSource, SesiField, SesiInput, SesiTerapi } from '../../../domain/types';
import { NotFoundError } from '../../../infra/errors';
import { PESAN_GAGAL_SIMPAN, useDataStore } from '../../../state/dataStore';
import { Dialog } from '../../components/Dialog';
import { TextAreaField, TextField } from '../../components/Field';
import { FotoStrip } from '../../components/FotoStrip';
import { InfoPasien } from '../../components/InfoPasien';
import { PhotoViewer } from '../../components/PhotoViewer';
import { useToast } from '../../components/Toast';
import { FotoPicker } from './FotoPicker';

export const PESAN_SESI_TERSIMPAN = 'Sesi terapi berhasil disimpan';
export const PESAN_SESI_DIUBAH = 'Perubahan sesi terapi berhasil disimpan';

export interface SesiFormDialogProps {
  /** Dialog dirender hanya saat true; setiap pembukaan memulai isian baru. */
  open: boolean;
  /** Pasien pemilik sesi (dipakai pada mode tambah). */
  pasienId: string;
  /** Sesi yang diubah; kosong/null berarti mode tambah. */
  sesi?: SesiTerapi | null;
  /** Nilai awal tanggal pada mode tambah ("YYYY-MM-DD"); default hari ini. */
  initialTanggal?: string;
  /** Dipanggil saat dialog ditutup tanpa menyimpan (Batal, Escape, Tombol_Kembali). */
  onClose: () => void;
  /** Dipanggil setelah sesi berhasil disimpan; pemanggil menutup dialog. Default: onClose. */
  onSaved?: (sesi: SesiTerapi) => void;
}

function nilaiAwal(sesi: SesiTerapi | null | undefined, initialTanggal: string | undefined): SesiInput {
  if (sesi) {
    return {
      tanggal: sesi.tanggal,
      keluhan: sesi.keluhan,
      polaPenyakit: sesi.polaPenyakit,
      terapi: sesi.terapi,
      hasil: sesi.hasil,
      biaya: String(sesi.biaya),
    };
  }
  return {
    tanggal: initialTanggal ?? todayISO(new Date()),
    keluhan: '',
    polaPenyakit: '',
    terapi: '',
    hasil: '',
    biaya: '',
  };
}

export function SesiFormDialog(props: SesiFormDialogProps): ReactNode {
  if (!props.open) return null;
  return <SesiFormDialogContent key={props.sesi?.id ?? `baru-${props.pasienId}`} {...props} />;
}

function SesiFormDialogContent({
  pasienId,
  sesi,
  initialTanggal,
  onClose,
  onSaved,
}: SesiFormDialogProps): ReactNode {
  const store = useDataStore();
  const toast = useToast();
  const isEdit = !!sesi;
  const formId = isEdit ? `sesi-form-${sesi.id}` : `sesi-form-baru-${pasienId}`;

  // Ambil data pasien (Req 1.4)
  const pasien = store.selectPasien(pasienId);

  const [values, setValues] = useState<SesiInput>(() => nilaiAwal(sesi, initialTanggal));
  const [errors, setErrors] = useState<FieldErrors<SesiField>>({});
  const [saving, setSaving] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Inisialisasi draft foto sesi
  const fotoAwal = isEdit ? store.selectFotoSesi(sesi.id) : [];
  const [draft, dispatch] = useReducer(fotoDraftReducer, fotoAwal, draftAwal);

  const set = (field: SesiField) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
  };

  const tutup = () => {
    if (!saving && !draft.memproses) onClose();
  };

  if (!pasien) {
    return (
      <Dialog
        open
        title={isEdit ? 'Ubah Sesi Terapi' : 'Tambah Sesi Terapi'}
        onClose={onClose}
        actions={
          <button type="button" className="btn" onClick={onClose}>
            Tutup
          </button>
        }
      >
        <p role="alert">Data pasien tidak ditemukan</p>
      </Dialog>
    );
  }

  // Siapkan sumber foto untuk thumbnail & penampil foto
  const fotoSources: FotoSource[] = draft.items.map((item) => {
    if (item.jenis === 'tersimpan') {
      return {
        key: item.meta.id,
        load: () => store.loadFotoBlob(item.meta),
      };
    }
    return {
      key: item.tempId,
      load: async () =>
        new Blob([item.foto.data as unknown as BlobPart], { type: item.foto.mime }),
    };
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || draft.memproses) return;
    setSaving(true);
    try {
      const result = await store.simpanSesi(
        pasienId,
        isEdit ? sesi.id : null,
        values,
        draft,
      );

      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setErrors({});
      toast.success(isEdit ? PESAN_SESI_DIUBAH : PESAN_SESI_TERSIMPAN);
      (onSaved ?? onClose)(result.value);
    } catch (err) {
      if (err instanceof NotFoundError) {
        toast.error(
          err.entity === 'pasien'
            ? 'Data pasien tidak ditemukan'
            : 'Sesi terapi tidak ditemukan',
        );
      } else {
        toast.error(`${PESAN_GAGAL_SIMPAN}, silakan coba lagi`);
      }
    } finally {
      setSaving(false);
    }
  }

  const tombolSimpanDisabled = saving || draft.memproses;

  return (
    <>
      <Dialog
        open
        title={isEdit ? 'Ubah Sesi Terapi' : 'Tambah Sesi Terapi'}
        onClose={tutup}
        actions={
          <>
            <button
              type="button"
              className="btn"
              onClick={tutup}
              disabled={tombolSimpanDisabled}
            >
              Batal
            </button>
            <button
              type="submit"
              form={formId}
              className="btn btn--primary"
              disabled={tombolSimpanDisabled}
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <form id={formId} noValidate onSubmit={(e) => void submit(e)}>
          <InfoPasien pasien={pasien} />

          <TextField
            label="Tanggal terapi"
            type="date"
            name="tanggal"
            value={values.tanggal}
            onChange={set('tanggal')}
            error={errors.tanggal}
            required
          />
          <TextAreaField
            label="Keluhan"
            name="keluhan"
            value={values.keluhan}
            onChange={set('keluhan')}
            error={errors.keluhan}
            required
          />
          <TextAreaField
            label="Diagnosa"
            name="polaPenyakit"
            value={values.polaPenyakit}
            onChange={set('polaPenyakit')}
            error={errors.polaPenyakit}
            hint="Opsional"
          />
          <TextAreaField
            label="Terapi yang diberikan"
            name="terapi"
            value={values.terapi}
            onChange={set('terapi')}
            error={errors.terapi}
            required
          />
          <TextAreaField
            label="Hasil terapi"
            name="hasil"
            value={values.hasil}
            onChange={set('hasil')}
            error={errors.hasil}
            hint="Opsional"
          />
          <TextField
            label="Biaya (Rp)"
            type="text"
            inputMode="numeric"
            name="biaya"
            autoComplete="off"
            value={values.biaya}
            onChange={set('biaya')}
            error={errors.biaya}
            required
          />

          <div className="sesi-foto-section">
            <label className="field__label">Dokumentasi Foto</label>
            <FotoPicker draft={draft} dispatch={dispatch} />
            <FotoStrip
              sources={fotoSources}
              tanggal={values.tanggal}
              onFotoClick={(idx) => setViewerIndex(idx)}
              onHapusFoto={(idx) => {
                const item = draft.items[idx];
                if (item) {
                  dispatch({
                    type: 'hapus',
                    key: item.jenis === 'tersimpan' ? item.meta.id : item.tempId,
                  });
                }
              }}
            />
          </div>
        </form>
      </Dialog>

      {viewerIndex !== null && (
        <PhotoViewer
          sources={fotoSources}
          startIndex={viewerIndex}
          tanggal={values.tanggal}
          onClose={() => setViewerIndex(null)}
        />
      )}
    </>
  );
}
