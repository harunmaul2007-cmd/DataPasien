// Dialog formulir tambah / ubah Data_Pasien (Req 1, 2, 11, 14).

import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { terapkanKontak } from '../../../domain/kontak';
import type { FieldErrors, JenisKelamin, Pasien, PasienField, PasienInput } from '../../../domain/types';
import { BATAS_ALAMAT, BATAS_NAMA } from '../../../domain/validator';
import { createContactGateway, type ContactGateway, type KontakTerpilih } from '../../../infra/contactGateway';
import { NotFoundError } from '../../../infra/errors';
import { PESAN_GAGAL_SIMPAN, useDataStore } from '../../../state/dataStore';
import { Dialog } from '../../components/Dialog';
import { SelectField, TextAreaField, TextField } from '../../components/Field';
import { useToast } from '../../components/Toast';

export const PESAN_PASIEN_TIDAK_DITEMUKAN = 'Data pasien tidak ditemukan';
export const PESAN_PASIEN_TERSIMPAN = 'Data pasien berhasil disimpan';
export const PESAN_PERUBAHAN_TERSIMPAN = 'Perubahan data pasien berhasil disimpan';

export type PasienFormMode = { mode: 'tambah' } | { mode: 'ubah'; pasienId: string };

export interface PasienFormDialogProps {
  open: boolean;
  /** Mode formulir; untuk mode ubah berisi id pasien yang diubah. */
  target: PasienFormMode;
  /** Dipanggil saat dialog ditutup (batal, berhasil disimpan, atau pasien tidak ditemukan). */
  onClose: () => void;
  /** Dipanggil setelah penyimpanan berhasil, sebelum onClose. */
  onSaved?: (pasien: Pasien) => void;
  contactGateway?: ContactGateway;
}

interface FormState {
  nama: string;
  umur: string;
  jenisKelamin: '' | JenisKelamin;
  alamat: string;
  noHp: string;
}

const KOSONG: FormState = {
  nama: '',
  umur: '',
  jenisKelamin: '',
  alamat: '',
  noHp: '',
};

export function PasienFormDialog(props: PasienFormDialogProps): ReactNode {
  if (!props.open) return null;
  const key = props.target.mode === 'ubah' ? `ubah-${props.target.pasienId}` : 'tambah';
  return <PasienFormDialogContent key={key} {...props} />;
}

function PasienFormDialogContent({
  target,
  onClose,
  onSaved,
  contactGateway,
}: PasienFormDialogProps): ReactNode {
  const store = useDataStore();
  const toast = useToast();
  const formId = useId();
  const isUbah = target.mode === 'ubah';
  const contactGw = contactGateway ?? createContactGateway();

  // Snapshot data tersimpan saat dialog dibuka (Req 2.1).
  const [awal] = useState<{ input: FormState; ditemukan: boolean }>(() => {
    if (target.mode === 'tambah') return { input: KOSONG, ditemukan: true };
    const p = store.selectPasien(target.pasienId);
    return p
      ? {
          input: {
            nama: p.nama,
            umur: p.umur !== null && p.umur !== undefined ? String(p.umur) : '',
            jenisKelamin: p.jenisKelamin ?? '',
            alamat: p.alamat,
            noHp: p.noHp,
          },
          ditemukan: true,
        }
      : { input: KOSONG, ditemukan: false };
  });

  const [values, setValues] = useState<FormState>(awal.input);
  const [errors, setErrors] = useState<FieldErrors<PasienField>>({});
  const [tidakDitemukan, setTidakDitemukan] = useState(!awal.ditemukan);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Dialog pemilih nomor ketika kontak memiliki >= 2 nomor
  const [kontakMultiNomor, setKontakMultiNomor] = useState<KontakTerpilih | null>(null);

  const title = isUbah ? 'Ubah Pasien' : 'Tambah Pasien';

  const set = (field: keyof FormState) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  const handleAmbilKontak = async () => {
    try {
      const kontak = await contactGw.pilih();
      if (!kontak) return; // Dibatalkan oleh pengguna

      if (kontak.nomor.length === 0) {
        toast.error('Kontak ini tidak memiliki nomor telepon');
        return;
      }

      if (kontak.nomor.length === 1) {
        const no = kontak.nomor[0]!;
        setValues((v) => ({
          ...v,
          ...terapkanKontak({ nama: v.nama, noHp: v.noHp }, { nama: kontak.nama }, no),
        }));
        return;
      }

      // Kontak memiliki >= 2 nomor
      setKontakMultiNomor(kontak);
    } catch {
      toast.error('Kontak tidak dapat diakses. Nomor HP dapat diisi manual.');
    }
  };

  const handlePilihNomorKontak = (nomor: string) => {
    if (!kontakMultiNomor) return;
    setValues((v) => ({
      ...v,
      ...terapkanKontak({ nama: v.nama, noHp: v.noHp }, { nama: kontakMultiNomor.nama }, nomor),
    }));
    setKontakMultiNomor(null);
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (savingRef.current || tidakDitemukan) return;
    savingRef.current = true;
    setSaving(true);

    const inputData: PasienInput = {
      nama: values.nama,
      umur: values.umur,
      jenisKelamin: values.jenisKelamin === '' ? null : values.jenisKelamin,
      alamat: values.alamat,
      noHp: values.noHp,
    };

    try {
      const result =
        target.mode === 'ubah'
          ? await store.updatePasien(target.pasienId, inputData)
          : await store.addPasien(inputData);
      if (!result.ok) {
        setErrors(result.errors);
        return;
      }
      setErrors({});
      toast.success(isUbah ? PESAN_PERUBAHAN_TERSIMPAN : PESAN_PASIEN_TERSIMPAN);
      onSaved?.(result.value);
      onClose();
    } catch (err) {
      if (err instanceof NotFoundError) {
        setTidakDitemukan(true);
        toast.error(PESAN_PASIEN_TIDAK_DITEMUKAN);
      } else {
        toast.error(`${PESAN_GAGAL_SIMPAN}, silakan coba lagi`);
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (tidakDitemukan) {
    return (
      <Dialog
        open
        title={title}
        onClose={onClose}
        actions={
          <button type="button" className="btn" onClick={onClose}>
            Tutup
          </button>
        }
      >
        <p role="alert">{PESAN_PASIEN_TIDAK_DITEMUKAN}</p>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog
        open
        title={title}
        onClose={onClose}
        actions={
          <>
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" form={formId} className="btn btn--primary" disabled={saving}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
          </>
        }
      >
        <form id={formId} noValidate onSubmit={(e) => void handleSubmit(e)}>
          <TextField
            label="Nama"
            name="nama"
            autoComplete="off"
            required
            value={values.nama}
            error={errors.nama}
            hint={`Wajib diisi, maksimal ${BATAS_NAMA} karakter`}
            onChange={(e) => set('nama')(e.target.value)}
          />

          <TextField
            label="Umur"
            name="umur"
            type="number"
            inputMode="numeric"
            min={0}
            max={150}
            value={values.umur}
            error={errors.umur}
            hint="Opsional, 0–150 tahun"
            onChange={(e) => set('umur')(e.target.value)}
          />

          <SelectField
            label="Jenis Kelamin"
            name="jenisKelamin"
            value={values.jenisKelamin}
            error={errors.jenisKelamin}
            hint="Opsional"
            onChange={(e) => set('jenisKelamin')(e.target.value)}
          >
            <option value="">Pilih jenis kelamin</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Wanita">Wanita</option>
          </SelectField>

          <TextAreaField
            label="Alamat"
            name="alamat"
            rows={3}
            value={values.alamat}
            error={errors.alamat}
            hint={`Opsional, maksimal ${BATAS_ALAMAT} karakter`}
            onChange={(e) => set('alamat')(e.target.value)}
          />

          <div className="field-group-contact">
            <TextField
              label="Nomor HP"
              name="noHp"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              required
              value={values.noHp}
              error={errors.noHp}
              hint="Diawali 08, 628, atau +628; 10–15 digit"
              onChange={(e) => set('noHp')(e.target.value)}
            />

            {contactGw.tersedia() && (
              <button
                type="button"
                className="btn btn-secondary btn-ambil-kontak"
                onClick={handleAmbilKontak}
                aria-label="Ambil dari kontak"
              >
                📇 Ambil dari kontak
              </button>
            )}
          </div>
        </form>
      </Dialog>

      {kontakMultiNomor && (
        <Dialog
          open
          title={`Pilih Nomor (${kontakMultiNomor.nama})`}
          onClose={() => setKontakMultiNomor(null)}
          actions={
            <button type="button" className="btn" onClick={() => setKontakMultiNomor(null)}>
              Batal
            </button>
          }
        >
          <div className="daftar-nomor-kontak" role="list">
            {kontakMultiNomor.nomor.map((nomor, idx) => (
              <button
                key={idx}
                type="button"
                className="btn-nomor-item"
                onClick={() => handlePilihNomorKontak(nomor)}
              >
                {nomor}
              </button>
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
}
