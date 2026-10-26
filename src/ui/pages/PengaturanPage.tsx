// Halaman Pengaturan Praktik dan Kop Laporan (Requirement 7, 10),
// ditambah pilihan tema tampilan dan informasi aplikasi.

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { DraftLogo, FieldErrors, PengaturanField, PengaturanInput } from '../../domain/types';
import { useDataStore } from '../../state/dataStore';
import { AppCreatorInfo } from '../components/AppCreatorInfo';
import { TextAreaField, TextField } from '../components/Field';
import { ThemePicker } from '../components/ThemePicker';
import { useToast } from '../components/Toast';
import { LogoPicker } from './pengaturan/LogoPicker';

export function PengaturanPage(): ReactNode {
  const store = useDataStore();
  const toast = useToast();
  const savedPengaturan = store.selectPengaturan();

  const [values, setValues] = useState<PengaturanInput>(() => ({
    namaPraktik: savedPengaturan?.namaPraktik ?? 'Data Pasien',
    alamatPraktik: savedPengaturan?.alamatPraktik ?? '',
    noHpPraktik: savedPengaturan?.noHpPraktik ?? '',
  }));

  const [draftLogo, setDraftLogo] = useState<DraftLogo>({ jenis: 'tetap' });
  const [memprosesLogo, setMemprosesLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<PengaturanField>>({});

  useEffect(() => {
    if (savedPengaturan) {
      setValues({
        namaPraktik: savedPengaturan.namaPraktik,
        alamatPraktik: savedPengaturan.alamatPraktik ?? '',
        noHpPraktik: savedPengaturan.noHpPraktik ?? '',
      });
    }
  }, [savedPengaturan]);

  const handleBatal = () => {
    setValues({
      namaPraktik: savedPengaturan?.namaPraktik ?? 'Data Pasien',
      alamatPraktik: savedPengaturan?.alamatPraktik ?? '',
      noHpPraktik: savedPengaturan?.noHpPraktik ?? '',
    });
    setDraftLogo({ jenis: 'tetap' });
    setErrors({});
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || memprosesLogo) return;

    setSaving(true);
    try {
      const res = await store.simpanPengaturan(values, draftLogo);
      if (!res.ok) {
        setErrors(res.errors);
        return;
      }
      setErrors({});
      setDraftLogo({ jenis: 'tetap' });
      toast.success('Pengaturan berhasil disimpan');
    } catch {
      toast.error('Pengaturan gagal disimpan, silakan coba lagi');
    } finally {
      setSaving(false);
    }
  };

  const isDisabled = saving || memprosesLogo;

  return (
    <section className="page pengaturan-page" aria-labelledby="pengaturan-judul">
      <h1 id="pengaturan-judul">Pengaturan Praktik</h1>

      <form className="pengaturan-form" onSubmit={handleSubmit} noValidate>
        <div className="card pengaturan-card">
          <TextField
            label="Nama Praktik"
            name="namaPraktik"
            required
            autoComplete="off"
            value={values.namaPraktik}
            error={errors.namaPraktik}
            hint="Ditampilkan paling besar pada kop laporan (maksimal 100 karakter)"
            onChange={(e) => setValues({ ...values, namaPraktik: e.target.value })}
          />

          <TextAreaField
            label="Alamat Praktik"
            name="alamatPraktik"
            rows={3}
            value={values.alamatPraktik}
            error={errors.alamatPraktik}
            hint="Opsional, ditampilkan di kop laporan (maksimal 255 karakter)"
            onChange={(e) => setValues({ ...values, alamatPraktik: e.target.value })}
          />

          <TextField
            label="Nomor HP Praktik"
            name="noHpPraktik"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={values.noHpPraktik}
            error={errors.noHpPraktik}
            hint="Opsional, diawali 08, 628, atau +628; 10–15 digit"
            onChange={(e) => setValues({ ...values, noHpPraktik: e.target.value })}
          />

          <div className="field">
            <label className="field__label">Logo Praktik</label>
            <LogoPicker
              draftLogo={draftLogo}
              onDraftLogoChange={setDraftLogo}
              logoTersimpan={savedPengaturan?.logo ?? null}
              memproses={memprosesLogo}
              onMemprosesChange={setMemprosesLogo}
            />
            <span className="field__hint">
              Opsional, foto maksimal 5 MB. Ditampilkan di sisi kiri kop laporan.
            </span>
          </div>
        </div>

        <div className="pengaturan-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isDisabled}
            onClick={handleBatal}
          >
            Batal
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={isDisabled}
            data-testid="btn-simpan-pengaturan"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>

      <div className="pengaturan-section" style={{ marginTop: 'var(--space-6)' }}>
        <h2 id="tema-judul">Tema Tampilan Aplikasi</h2>
        <ThemePicker />
      </div>

      <div className="pengaturan-section" style={{ marginTop: 'var(--space-6)' }}>
        <h2 id="creator-judul">Tentang Aplikasi</h2>
        <AppCreatorInfo />
      </div>
    </section>
  );
}
