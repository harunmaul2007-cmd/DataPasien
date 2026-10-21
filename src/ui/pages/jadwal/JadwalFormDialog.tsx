// Formulir Jadwal_Kunjungan (tambah & ubah) dalam Dialog (Req 8.1–8.3, 8.7, 8.8, 8.12).
//
// Validasi (wajib isi, waktu tidak lewat, catatan ≤ 500) dilakukan DataStore
// lewat validateJadwal. Jika ditolak atau penyimpanan gagal, dialog tetap
// terbuka dengan isian utuh dan jadwal tersimpan tidak berubah.

import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { FieldErrors, JadwalField, JadwalInput, JadwalKunjungan } from '../../../domain/types';
import { BATAS_CATATAN } from '../../../domain/validator';
import { NotFoundError } from '../../../infra/errors';
import { PESAN_GAGAL_SIMPAN, useDataStore, useDataStoreSelector } from '../../../state/dataStore';
import { Dialog } from '../../components/Dialog';
import { TextAreaField, TextField } from '../../components/Field';
import { NomorWhatsApp } from '../../components/NomorWhatsApp';
import { useToast } from '../../components/Toast';

export const PESAN_JADWAL_TERSIMPAN = 'Jadwal kunjungan berhasil disimpan';
export const PESAN_JADWAL_DIUBAH = 'Perubahan jadwal kunjungan berhasil disimpan';
export const PESAN_JADWAL_TIDAK_DITEMUKAN = 'Jadwal kunjungan tidak ditemukan';

export interface JadwalFormDialogProps {
  /** Dialog dirender hanya saat true; setiap pembukaan memulai isian baru. */
  open: boolean;
  /** Jadwal yang diubah; kosong/null berarti mode tambah. */
  jadwal?: JadwalKunjungan | null;
  /** Nilai awal tanggal pada mode tambah ("YYYY-MM-DD"). */
  initialTanggal?: string;
  /** Dipanggil saat dialog ditutup tanpa menyimpan (Batal, Escape, Tombol_Kembali). */
  onClose: () => void;
  /** Dipanggil setelah berhasil disimpan; pemanggil menutup dialog. Default: onClose. */
  onSaved?: (jadwal: JadwalKunjungan) => void;
}

function nilaiAwal(jadwal: JadwalKunjungan | null | undefined, initialTanggal: string | undefined): JadwalInput {
  if (jadwal) {
    return { pasienId: jadwal.pasienId, tanggal: jadwal.tanggal, jam: jadwal.jam, catatan: jadwal.catatan };
  }
  return { pasienId: '', tanggal: initialTanggal ?? '', jam: '', catatan: '' };
}

export function JadwalFormDialog(props: JadwalFormDialogProps): ReactNode {
  if (!props.open) return null;
  return <JadwalFormDialogContent key={props.jadwal?.id ?? 'baru'} {...props} />;
}

function JadwalFormDialogContent({ jadwal, initialTanggal, onClose, onSaved }: JadwalFormDialogProps): ReactNode {
  const store = useDataStore();
  const toast = useToast();
  const pasienList = useDataStoreSelector((s) => s.selectPasienList());
  const formId = useId();
  const pasienSelectId = `${formId}-pasien`;
  const isEdit = !!jadwal;

  const [values, setValues] = useState<JadwalInput>(() => nilaiAwal(jadwal, initialTanggal));
  const [errors, setErrors] = useState<FieldErrors<JadwalField>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const set = (field: JadwalField) => (e: { target: { value: string } }) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [field]: value }));
  };

  const tutup = () => {
    if (!savingRef.current) onClose();
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const result = isEdit ? await store.updateJadwal(jadwal.id, values) : await store.addJadwal(values);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setErrors({});
      toast.success(isEdit ? PESAN_JADWAL_DIUBAH : PESAN_JADWAL_TERSIMPAN);
      (onSaved ?? onClose)(result.value);
    } catch (err) {
      if (err instanceof NotFoundError) toast.error(PESAN_JADWAL_TIDAK_DITEMUKAN);
      else toast.error(`${PESAN_GAGAL_SIMPAN}, silakan coba lagi`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const pasienErrorId = `${pasienSelectId}-error`;
  const pasienHintId = `${pasienSelectId}-hint`;
  const tanpaPasien = pasienList.length === 0;

  return (
    <Dialog
      open
      title={isEdit ? 'Ubah Jadwal' : 'Tambah Jadwal'}
      onClose={tutup}
      actions={
        <>
          <button type="button" className="btn" onClick={tutup} disabled={saving}>
            Batal
          </button>
          <button type="submit" form={formId} className="btn btn--primary" disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(e) => void submit(e)}>
        <div className="field">
          <label htmlFor={pasienSelectId} className="field__label">
            Pasien
          </label>
          <select
            id={pasienSelectId}
            name="pasienId"
            className="field__input"
            required
            value={values.pasienId}
            onChange={set('pasienId')}
            aria-invalid={errors.pasienId ? true : undefined}
            aria-describedby={
              [tanpaPasien ? pasienHintId : null, errors.pasienId ? pasienErrorId : null].filter(Boolean).join(' ') ||
              undefined
            }
          >
            <option value="">Pilih pasien</option>
            {pasienList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama} ({p.noHp})
              </option>
            ))}
          </select>
          {tanpaPasien ? (
            <span id={pasienHintId} className="field__hint">
              Belum ada data pasien. Tambahkan pasien terlebih dahulu.
            </span>
          ) : null}
          {errors.pasienId ? (
            <span id={pasienErrorId} className="field__error">
              {errors.pasienId}
            </span>
          ) : null}
          {values.pasienId ? (() => {
            const p = store.selectPasien(values.pasienId);
            return p?.noHp ? (
              <div className="jadwal-form__whatsapp" style={{ marginTop: '0.5rem' }}>
                <NomorWhatsApp noHp={p.noHp} nama={p.nama} />
              </div>
            ) : null;
          })() : null}
        </div>
        <TextField
          label="Tanggal"
          type="date"
          name="tanggal"
          required
          value={values.tanggal}
          onChange={set('tanggal')}
          error={errors.tanggal}
        />
        <TextField
          label="Jam"
          type="time"
          name="jam"
          step={60}
          required
          value={values.jam}
          onChange={set('jam')}
          error={errors.jam}
          hint="Format 24 jam (JJ:MM)"
        />
        <TextAreaField
          label="Catatan"
          name="catatan"
          rows={3}
          value={values.catatan}
          onChange={set('catatan')}
          error={errors.catatan}
          hint={`Opsional, maksimal ${BATAS_CATATAN} karakter`}
        />
      </form>
    </Dialog>
  );
}
