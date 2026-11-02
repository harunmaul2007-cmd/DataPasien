// Status lisensi Full Version dan gerbang fitur berbayar.
//
// - Kode aktivasi disimpan di localStorage dan diverifikasi ulang (tanda tangan
//   digital) setiap aplikasi dibuka; kode yang diubah/rusak dianggap tidak ada.
// - Fitur berbayar: Bantuan AI, Laporan PDF, dan Pengaturan.
// - `minta(fitur, lanjut)`: jalankan `lanjut` bila Full Version aktif; bila tidak,
//   tampilkan dialog Full Version (hubungi WhatsApp + masukkan kode aktivasi).

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { verifikasiKode, type HasilVerifikasi, type InfoLisensi } from '../domain/lisensi';
import { KUNCI_PUBLIK_LISENSI } from '../domain/lisensiKunci';
import { FullVersionDialog } from '../ui/components/FullVersionDialog';

export const KUNCI_PENYIMPANAN_LISENSI = 'datapasien-lisensi';

export type StatusLisensi = 'memeriksa' | 'aktif' | 'gratis';

export interface LisensiApi {
  status: StatusLisensi;
  info: InfoLisensi | null;
  /** Verifikasi & simpan kode; status menjadi 'aktif' bila sah. */
  aktivasi: (teks: string) => Promise<HasilVerifikasi>;
  /** Jalankan aksi fitur berbayar, atau tampilkan dialog Full Version. */
  minta: (fitur: string, lanjut?: () => void) => void;
}

type Penyimpanan = Pick<Storage, 'getItem' | 'setItem'>;

function penyimpananDefault(): Penyimpanan | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Tanpa provider: selalu versi gratis dan tidak menampilkan apa pun. */
const LisensiContext = createContext<LisensiApi>({
  status: 'gratis',
  info: null,
  aktivasi: async () => ({ ok: false, alasan: 'Lisensi tidak tersedia' }),
  minta: () => {},
});

export interface LisensiProviderProps {
  children?: ReactNode;
  storage?: Penyimpanan | null;
  kunciPublik?: JsonWebKey;
}

export function LisensiProvider({ children, storage, kunciPublik = KUNCI_PUBLIK_LISENSI }: LisensiProviderProps): ReactNode {
  const [penyimpanan] = useState(() => (storage === undefined ? penyimpananDefault() : storage));
  const [status, setStatus] = useState<StatusLisensi>('memeriksa');
  const [info, setInfo] = useState<InfoLisensi | null>(null);
  const [fiturDiminta, setFiturDiminta] = useState<string | null>(null);

  // Verifikasi kode tersimpan saat aplikasi dibuka.
  useEffect(() => {
    let batal = false;
    let tersimpan: string | null = null;
    try {
      tersimpan = penyimpanan?.getItem(KUNCI_PENYIMPANAN_LISENSI) ?? null;
    } catch {
      tersimpan = null;
    }
    if (!tersimpan) {
      setStatus('gratis');
      return;
    }
    void verifikasiKode(tersimpan, kunciPublik).then((r) => {
      if (batal) return;
      setInfo(r.ok ? r.info : null);
      setStatus(r.ok ? 'aktif' : 'gratis');
    });
    return () => {
      batal = true;
    };
  }, [penyimpanan, kunciPublik]);

  const aktivasi = useCallback(
    async (teks: string) => {
      const r = await verifikasiKode(teks, kunciPublik);
      if (r.ok) {
        try {
          penyimpanan?.setItem(KUNCI_PENYIMPANAN_LISENSI, r.info.kode);
        } catch {
          // Tetap aktif untuk sesi ini meski gagal disimpan.
        }
        setInfo(r.info);
        setStatus('aktif');
      }
      return r;
    },
    [penyimpanan, kunciPublik],
  );

  const minta = useCallback(
    (fitur: string, lanjut?: () => void) => {
      if (status === 'aktif') lanjut?.();
      else setFiturDiminta(fitur);
    },
    [status],
  );

  const api = useMemo<LisensiApi>(() => ({ status, info, aktivasi, minta }), [status, info, aktivasi, minta]);

  return (
    <LisensiContext.Provider value={api}>
      {children}
      {fiturDiminta !== null && (
        <FullVersionDialog fitur={fiturDiminta} aktivasi={aktivasi} onClose={() => setFiturDiminta(null)} />
      )}
    </LisensiContext.Provider>
  );
}

/** Provider dengan status tetap, untuk pengujian komponen. */
export function LisensiTetapProvider({ aktif, children }: { aktif: boolean; children?: ReactNode }): ReactNode {
  const api = useMemo<LisensiApi>(
    () => ({
      status: aktif ? 'aktif' : 'gratis',
      info: aktif ? { email: 'uji@contoh.id', diterbitkan: '2026-01-01', kode: 'DP1.uji.uji' } : null,
      aktivasi: async () => ({ ok: false, alasan: 'tidak didukung' }),
      minta: (_fitur, lanjut) => {
        if (aktif) lanjut?.();
      },
    }),
    [aktif],
  );
  return <LisensiContext.Provider value={api}>{children}</LisensiContext.Provider>;
}

export function useLisensi(): LisensiApi {
  return useContext(LisensiContext);
}
