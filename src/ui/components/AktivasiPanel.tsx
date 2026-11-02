// Panel aktivasi Full Version: hubungi pembuat aplikasi via WhatsApp untuk
// pembayaran manual, lalu tempel kode aktivasi yang diterima.

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { APP_INFO } from '../../domain/appInfo';
import type { HasilVerifikasi } from '../../domain/lisensi';
import { NOMOR_WA_PEMBELIAN } from '../../domain/lisensiKunci';
import { tautanWhatsApp } from '../../domain/whatsapp';
import { createExternalLinkGateway, type ExternalLinkGateway } from '../../infra/externalLink';
import { useToast } from './Toast';

export const PESAN_FULL_VERSION_AKTIF = 'Full Version aktif. Terima kasih!';

/** Tautan WhatsApp pembelian dengan pesan pembuka. */
export function tautanPembelian(fitur?: string): string {
  const pesan =
    `Halo ${APP_INFO.creatorNama}, saya ingin membeli Full Version aplikasi ${APP_INFO.namaAplikasi} ` +
    `(v${APP_INFO.versionName})${fitur ? ` untuk fitur ${fitur}` : ''}. Email saya: `;
  return `${tautanWhatsApp(NOMOR_WA_PEMBELIAN)}?text=${encodeURIComponent(pesan)}`;
}

export interface AktivasiPanelProps {
  /** Nama fitur yang diminta (untuk teks penjelasan & pesan WhatsApp). */
  fitur?: string;
  aktivasi: (teks: string) => Promise<HasilVerifikasi>;
  /** Dipanggil setelah kode sah. */
  onAktif?: () => void;
  linkGateway?: ExternalLinkGateway;
}

export function AktivasiPanel({ fitur, aktivasi, onAktif, linkGateway }: AktivasiPanelProps): ReactNode {
  const toast = useToast();
  const [linkGw] = useState(() => linkGateway ?? createExternalLinkGateway());
  const kodeId = useId();
  const errorId = `${kodeId}-error`;
  const [kode, setKode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [memeriksa, setMemeriksa] = useState(false);

  const hubungiWa = async () => {
    const ok = await linkGw.open(tautanPembelian(fitur));
    if (!ok) toast.error(`WhatsApp tidak dapat dibuka. Hubungi ${NOMOR_WA_PEMBELIAN}`);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (memeriksa) return;
    if (kode.trim() === '') {
      setError('Masukkan kode aktivasi');
      return;
    }
    setMemeriksa(true);
    try {
      const r = await aktivasi(kode);
      if (r.ok) {
        setError(null);
        toast.success(PESAN_FULL_VERSION_AKTIF);
        onAktif?.();
      } else {
        setError(r.alasan);
      }
    } finally {
      setMemeriksa(false);
    }
  };

  return (
    <div className="aktivasi-panel">
      <p>
        {fitur ? (
          <>
            <strong>{fitur}</strong> hanya tersedia di <strong>Full Version</strong>.
          </>
        ) : (
          <>
            Fitur ini hanya tersedia di <strong>Full Version</strong>.
          </>
        )}{' '}
        Fitur Full Version: Bantuan AI, Laporan PDF, dan Pengaturan.
      </p>
      <p className="field__hint">
        Pembayaran manual: hubungi WhatsApp {NOMOR_WA_PEMBELIAN}. Setelah pembayaran, Anda akan menerima kode
        aktivasi.
      </p>
      <div className="aktivasi-panel__wa">
        <button type="button" className="btn btn--primary" onClick={() => void hubungiWa()}>
          💬 Hubungi via WhatsApp
        </button>
      </div>

      <form className="aktivasi-panel__form" noValidate onSubmit={(e) => void submit(e)}>
        <div className="field">
          <label htmlFor={kodeId} className="field__label">
            Kode aktivasi
          </label>
          <textarea
            id={kodeId}
            className="field__input aktivasi-panel__kode"
            rows={3}
            value={kode}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            placeholder="DP1.…"
            onChange={(e) => {
              setKode(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {error ? (
            <span id={errorId} className="field__error" role="alert">
              {error}
            </span>
          ) : null}
        </div>
        <button type="submit" className="btn" disabled={memeriksa}>
          {memeriksa ? 'Memeriksa…' : 'Aktifkan'}
        </button>
      </form>
    </div>
  );
}
