// Dialog "Bantuan AI" untuk kolom Diagnosa pada formulir sesi terapi.
//
// Alur: ChatGPT dibuka di jendela/aplikasi baru dengan prompt TCM terisi →
// pengguna menekan "Copy" di ChatGPT lalu kembali → jawaban dibaca otomatis dari
// papan klip (atau ditempel manual) → tombol "Copy ke Formulir" mengisi
// kolom Diagnosa dan Terapi.

import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { buildPromptTcm, chatGptUrl, keIsianForm, parseJawabanAi } from '../../../domain/bantuanAi';
import { createClipboardGateway, type ClipboardGateway } from '../../../infra/clipboardGateway';
import { createExternalLinkGateway, type ExternalLinkGateway } from '../../../infra/externalLink';
import { Dialog } from '../../components/Dialog';
import { useToast } from '../../components/Toast';

export const PESAN_JAWABAN_TIDAK_DIKENALI =
  'Format jawaban AI belum dikenali. Pastikan memuat baris "DIAGNOSA TCM:", "POLA:", dan "PRINSIP TERAPI:".';

export interface BantuanAiDialogProps {
  keluhan: string;
  /** Dipanggil saat pengguna menyetujui hasil ("Copy ke Formulir"). */
  onApply: (isian: { polaPenyakit: string; terapi: string }) => void;
  onClose: () => void;
  linkGateway?: ExternalLinkGateway;
  clipboardGateway?: ClipboardGateway;
}

/**
 * Buka ChatGPT dengan prompt TCM dan salin prompt ke papan klip sebagai cadangan.
 * Dipanggil langsung dari klik tombol agar window.open tidak diblokir peramban.
 */
export async function bukaChatGpt(
  keluhan: string,
  linkGw: ExternalLinkGateway,
  clipGw: ClipboardGateway,
): Promise<boolean> {
  const prompt = buildPromptTcm(keluhan);
  // Salin dulu selagi dokumen masih fokus, lalu buka jendela (masih di dalam gesture).
  const disalin = clipGw.writeText(prompt);
  const dibuka = linkGw.open(chatGptUrl(prompt));
  await disalin;
  return dibuka;
}

export function BantuanAiDialog({
  keluhan,
  onApply,
  onClose,
  linkGateway,
  clipboardGateway,
}: BantuanAiDialogProps): ReactNode {
  const toast = useToast();
  const linkGw = useMemo(() => linkGateway ?? createExternalLinkGateway(), [linkGateway]);
  const clipGw = useMemo(() => clipboardGateway ?? createClipboardGateway(), [clipboardGateway]);
  const prompt = useMemo(() => buildPromptTcm(keluhan), [keluhan]);
  const jawabanId = useId();

  const [jawaban, setJawaban] = useState('');
  const hasil = useMemo(() => parseJawabanAi(jawaban), [jawaban]);
  const isian = hasil ? keIsianForm(hasil) : null;

  /** Ambil teks dari papan klip; abaikan bila kosong, sama dengan prompt, atau tidak berformat. */
  const tarikDariClipboard = useCallback(
    async (manual: boolean) => {
      const teks = await clipGw.readText();
      const valid = !!teks && teks.trim() !== prompt.trim() && parseJawabanAi(teks) !== null;
      if (valid) {
        setJawaban(teks.trim());
      } else if (manual) {
        toast.error(teks ? PESAN_JAWABAN_TIDAK_DIKENALI : 'Papan klip kosong atau tidak dapat dibaca. Tempel jawaban secara manual.');
      }
    },
    [clipGw, prompt, toast],
  );

  // Saat pengguna kembali dari ChatGPT, coba baca jawaban dari papan klip otomatis.
  useEffect(() => {
    const onKembali = () => {
      if (document.visibilityState === 'visible') void tarikDariClipboard(false);
    };
    window.addEventListener('focus', onKembali);
    document.addEventListener('visibilitychange', onKembali);
    return () => {
      window.removeEventListener('focus', onKembali);
      document.removeEventListener('visibilitychange', onKembali);
    };
  }, [tarikDariClipboard]);

  const bukaLagi = async () => {
    const ok = await bukaChatGpt(keluhan, linkGw, clipGw);
    if (!ok) toast.error('ChatGPT tidak dapat dibuka');
  };

  const terapkan = () => {
    if (!isian) return;
    onApply(isian);
    toast.success('Diagnosa dan terapi diisi dari Bantuan AI');
  };

  return (
    <Dialog
      open
      title="Bantuan AI (TCM)"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Batal
          </button>
          <button type="button" className="btn btn--primary" onClick={terapkan} disabled={!isian}>
            Copy ke Formulir
          </button>
        </>
      }
    >
      <ol className="bantuan-ai__langkah">
        <li>ChatGPT dibuka di jendela baru dengan pertanyaan berdasarkan keluhan pasien.</li>
        <li>
          Tekan tombol <strong>Copy</strong> di bawah jawaban ChatGPT, lalu kembali ke aplikasi ini.
        </li>
        <li>Periksa hasilnya, lalu tekan <strong>Copy ke Formulir</strong>.</li>
      </ol>
      <p className="field__hint">
        Hanya teks keluhan yang dikirim ke ChatGPT (tanpa nama/kontak pasien). Pertanyaan juga sudah
        disalin ke papan klip bila ChatGPT belum terisi otomatis.
      </p>

      <div className="bantuan-ai__aksi">
        <button type="button" className="btn" onClick={() => void bukaLagi()}>
          Buka ChatGPT lagi
        </button>
        <button type="button" className="btn" onClick={() => void tarikDariClipboard(true)}>
          Tempel dari Clipboard
        </button>
      </div>

      <div className="field">
        <label htmlFor={jawabanId} className="field__label">
          Jawaban AI
        </label>
        <textarea
          id={jawabanId}
          className="field__input"
          rows={5}
          value={jawaban}
          onChange={(e) => setJawaban(e.target.value)}
          placeholder={'DIAGNOSA TCM: …\nPOLA: …\nPRINSIP TERAPI: …'}
          aria-invalid={jawaban.trim() !== '' && !hasil ? true : undefined}
        />
        {jawaban.trim() !== '' && !hasil ? (
          <span className="field__error" role="alert">
            {PESAN_JAWABAN_TIDAK_DIKENALI}
          </span>
        ) : null}
      </div>

      {isian ? (
        <dl className="bantuan-ai__pratinjau" aria-label="Pratinjau isian">
          <dt>Diagnosa</dt>
          <dd>{isian.polaPenyakit || '-'}</dd>
          <dt>Terapi yang diberikan</dt>
          <dd>{isian.terapi || '-'}</dd>
        </dl>
      ) : null}

      <p className="field__hint">
        Saran AI hanya sebagai bahan pertimbangan dan tidak menggantikan penilaian praktisi.
      </p>
    </Dialog>
  );
}
