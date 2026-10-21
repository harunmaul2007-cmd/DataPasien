// DataStore: salinan AppData di memori + aksi tulis + selector ter-memoize.
//
// Pola setiap aksi tulis (Req 10.1, 10.4, 10.5):
//   validasi → tulis via Repository (transaksi) → perbarui memori → resolve.
// - Input ditolak Validator → resolve `{ ok: false, errors }`, tidak ada penulisan.
// - Repository gagal → lempar SaveError (atau NotFoundError), memori tidak berubah.
// - Saat status bukan 'ready' (memuat / gagal memuat) seluruh operasi tulis
//   ditolak dengan StoreNotReadyError agar data tersimpan tidak tertimpa (Req 10.6).
//
// Integrasi React memakai context + useSyncExternalStore. Snapshot state
// bersifat immutable: setiap perubahan menghasilkan objek/array baru, sehingga
// selector dapat di-memoize berdasarkan referensi array.

import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { buildHistori, type Histori } from '../domain/histori';
import { newId as defaultNewId } from '../domain/ids';
import { aksiTersedia, jadwalPadaTanggal, jadwalTerjadwalPasien, transisiStatus } from '../domain/jadwal';
import { buildLaporan, type Laporan } from '../domain/laporan';
import { deletionSummary, searchPasien } from '../domain/pasienQuery';
import { backupFileName, parseBackup, serializeBackup, type ParseBackupResult } from '../domain/cadangan';
import { diffDraft, type FotoDraft } from '../domain/foto';
import type {
  AppData,
  Counts,
  DraftLogo,
  FieldErrors,
  FotoMeta,
  JadwalField,
  JadwalInput,
  JadwalKunjungan,
  LogoMeta,
  Pasien,
  PasienField,
  PasienInput,
  PengaturanInput,
  PengaturanLaporan,
  SesiField,
  SesiInput,
  SesiTerapi,
} from '../domain/types';
import { validateJadwal, validatePasien, validatePengaturan, validateSesi } from '../domain/validator';
import { NotFoundError, SaveError } from '../infra/errors';
import { createFileGateway, type FileGateway } from '../infra/fileGateway';
import type { Repository } from '../infra/repository';

// ---------------------------------------------------------------------------
// Tipe publik
// ---------------------------------------------------------------------------

export type DataStoreStatus = 'loading' | 'ready' | 'error';

export interface DataStoreState {
  readonly status: DataStoreStatus;
  /** Kosong selama memuat atau bila pemuatan gagal. */
  readonly data: AppData;
  readonly foto: readonly FotoMeta[];
  readonly pengaturan: PengaturanLaporan | null;
  /** Penyebab kegagalan memuat (hanya saat status 'error'). */
  readonly error: unknown;
}

/** Hasil aksi tambah/ubah: rekaman tersimpan, atau kesalahan validasi per field. */
export type ActionResult<T, K extends string> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors<K> };

/** Dilempar saat operasi tulis dicoba sebelum data berhasil dimuat. */
export class StoreNotReadyError extends SaveError {
  constructor() {
    super(undefined, 'Data belum dimuat');
    this.name = 'StoreNotReadyError';
  }
}

export const PESAN_GAGAL_SIMPAN = 'Data gagal disimpan';
export const PESAN_GAGAL_HAPUS = 'Penghapusan gagal';

export interface DataStoreOptions {
  /**
   * Repository, atau fabrik asinkron yang membukanya. Fabrik dipanggil di
   * dalam `load()` sehingga kegagalan membuka basis data menjadi status
   * 'error' dan dapat dicoba lagi.
   */
  repository: Repository | (() => Promise<Repository>);
  /** Sumber waktu (default `() => new Date()`); dipakai validasi jadwal dan stempel waktu. */
  now?: () => Date;
  /** Pembangkit id (default UUID v4). */
  newId?: () => string;
  /**
   * FileGateway untuk ekspor/pemilihan file cadangan. Default dibuat malas
   * sesuai platform (`createFileGateway`) saat pertama kali dibutuhkan.
   */
  fileGateway?: FileGateway;
}

export const PESAN_GAGAL_EKSPOR = 'Ekspor data gagal';
export const PESAN_GAGAL_IMPOR = 'Impor data gagal';

/** Hasil ekspor berhasil (Req 14.1, 14.10). */
export interface ExportBackupResult {
  fileName: string;
  location: string;
  counts: Counts;
}

/** Dilempar saat pembuatan atau penyimpanan File_Cadangan gagal (Req 14.11). */
export class ExportError extends Error {
  override readonly cause: unknown;

  constructor(cause?: unknown, message = PESAN_GAGAL_EKSPOR) {
    super(message);
    this.name = 'ExportError';
    this.cause = cause;
  }
}

/** Dilempar saat penulisan data impor gagal; data tersimpan tidak berubah (Req 14.7). */
export class ImportError extends SaveError {
  constructor(cause?: unknown, message = PESAN_GAGAL_IMPOR) {
    super(cause, message);
    this.name = 'ImportError';
  }
}

function hitung(data: AppData): Counts {
  return { pasien: data.pasien.length, sesi: data.sesi.length, jadwal: data.jadwal.length };
}

const EMPTY_DATA: AppData = Object.freeze({
  pasien: Object.freeze([]) as unknown as Pasien[],
  sesi: Object.freeze([]) as unknown as SesiTerapi[],
  jadwal: Object.freeze([]) as unknown as JadwalKunjungan[],
});

const EMPTY_FOTO: readonly FotoMeta[] = Object.freeze([]) as unknown as FotoMeta[];

// ---------------------------------------------------------------------------
// Memoisasi selector berdasarkan referensi array + kunci string
// ---------------------------------------------------------------------------

class RefMemo<R> {
  private cache = new WeakMap<object, Map<string, R>>();

  get(refs: readonly object[], key: string, compute: () => R): R {
    // Rantai WeakMap per referensi; level terakhir menyimpan Map kunci → hasil.
    let level: WeakMap<object, unknown> = this.cache as WeakMap<object, unknown>;
    for (let i = 0; i < refs.length - 1; i++) {
      const ref = refs[i]!;
      let next = level.get(ref) as WeakMap<object, unknown> | undefined;
      if (!next) {
        next = new WeakMap();
        level.set(ref, next);
      }
      level = next;
    }
    const last = refs[refs.length - 1]!;
    let byKey = level.get(last) as Map<string, R> | undefined;
    if (!byKey) {
      byKey = new Map();
      level.set(last, byKey);
    }
    if (byKey.has(key)) return byKey.get(key) as R;
    const value = compute();
    byKey.set(key, value);
    return value;
  }
}

// ---------------------------------------------------------------------------
// DataStore
// ---------------------------------------------------------------------------

export class DataStore {
  private state: DataStoreState = {
    status: 'loading',
    data: EMPTY_DATA,
    foto: EMPTY_FOTO,
    pengaturan: null,
    error: undefined,
  };
  private readonly listeners = new Set<() => void>();
  private repo: Repository | null;
  private readonly repoFactory: (() => Promise<Repository>) | null;
  private readonly now: () => Date;
  private readonly makeId: () => string;
  private lastStamp = 0;
  private loadSeq = 0;
  private gateway: FileGateway | null;

  // Memo selector
  private readonly memoPasienList = new RefMemo<Pasien[]>();
  private readonly memoPasienById = new RefMemo<Map<string, Pasien>>();
  private readonly memoLastTherapy = new RefMemo<Map<string, string>>();
  private readonly memoHistori = new RefMemo<Histori>();
  private readonly memoJadwalTanggal = new RefMemo<JadwalKunjungan[]>();
  private readonly memoJadwalPasien = new RefMemo<JadwalKunjungan[]>();
  private readonly memoLaporan = new RefMemo<Laporan>();
  private readonly memoSummary = new RefMemo<{ jumlahSesi: number; jumlahJadwal: number; jumlahFoto: number }>();
  private readonly memoFotoSesi = new RefMemo<FotoMeta[]>();

  constructor(options: DataStoreOptions) {
    if (typeof options.repository === 'function') {
      this.repo = null;
      this.repoFactory = options.repository;
    } else {
      this.repo = options.repository;
      this.repoFactory = null;
    }
    this.now = options.now ?? (() => new Date());
    this.makeId = options.newId ?? defaultNewId;
    this.gateway = options.fileGateway ?? null;
  }

  // ----- Langganan (useSyncExternalStore) -----------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): DataStoreState => this.state;

  private setState(next: DataStoreState): void {
    this.state = next;
    for (const l of [...this.listeners]) l();
  }

  /** Memperbarui data di memori berdasarkan data terkini (hanya saat ready). */
  private commit(update: (d: AppData) => AppData): void {
    if (this.state.status !== 'ready') return;
    this.setState({
      status: 'ready',
      data: update(this.state.data),
      foto: this.state.foto,
      pengaturan: this.state.pengaturan,
      error: undefined,
    });
  }

  // ----- Pemuatan -------------------------------------------------------------

  /**
   * Membaca seluruh data dari Repository ke memori. Tidak pernah menulis.
   * Gagal → status 'error' dengan data kosong (Req 10.6); basis data kosong →
   * status 'ready' dengan daftar kosong (Req 10.7). Tidak melempar.
   */
  async load(): Promise<void> {
    const seq = ++this.loadSeq;
    this.setState({ status: 'loading', data: EMPTY_DATA, foto: EMPTY_FOTO, pengaturan: null, error: undefined });
    try {
      if (!this.repo) {
        if (!this.repoFactory) throw new Error('Repository tidak tersedia');
        this.repo = await this.repoFactory();
      }
      const [loaded, foto, pengaturan] = await Promise.all([
        this.repo.loadAll(),
        this.repo.loadAllFoto(),
        this.repo.loadPengaturan(),
      ]);
      if (seq !== this.loadSeq) return; // pemuatan yang lebih baru sedang berjalan
      this.setState({
        status: 'ready',
        data: { pasien: [...loaded.pasien], sesi: [...loaded.sesi], jadwal: [...loaded.jadwal] },
        foto: [...foto],
        pengaturan,
        error: undefined,
      });
    } catch (error) {
      if (seq !== this.loadSeq) return;
      this.setState({ status: 'error', data: EMPTY_DATA, foto: EMPTY_FOTO, pengaturan: null, error });
    }
  }

  // ----- Utilitas internal ----------------------------------------------------

  private requireRepo(): Repository {
    if (this.state.status !== 'ready' || !this.repo) throw new StoreNotReadyError();
    return this.repo;
  }

  /** Stempel waktu epoch ms yang selalu naik, agar urutan "lebih akhir disimpan" terjaga. */
  private stamp(): number {
    const t = Math.max(this.now().getTime(), this.lastStamp + 1);
    this.lastStamp = t;
    return t;
  }

  /** Jalankan penulisan; NotFoundError diteruskan, galat lain dibungkus SaveError. */
  private async write(op: () => Promise<void>, message = PESAN_GAGAL_SIMPAN): Promise<void> {
    try {
      await op();
    } catch (e) {
      if (e instanceof NotFoundError || e instanceof SaveError) throw e;
      throw new SaveError(e, message);
    }
  }

  private findPasien(id: string): Pasien | undefined {
    return this.state.data.pasien.find((p) => p.id === id);
  }

  // ----- Aksi pasien ----------------------------------------------------------

  async addPasien(input: PasienInput): Promise<ActionResult<Pasien, PasienField>> {
    const repo = this.requireRepo();
    const v = validatePasien(input);
    if (!v.ok) return v;
    const t = this.stamp();
    const pasien: Pasien = { id: this.makeId(), ...v.value, createdAt: t, updatedAt: t };
    await this.write(() => repo.addPasien(pasien));
    this.commit((d) => ({ ...d, pasien: [...d.pasien, pasien] }));
    return { ok: true, value: pasien };
  }

  /** NotFoundError jika pasien sudah tidak ada (Req 2.4). */
  async updatePasien(id: string, input: PasienInput): Promise<ActionResult<Pasien, PasienField>> {
    const repo = this.requireRepo();
    const existing = this.findPasien(id);
    if (!existing) throw new NotFoundError('pasien', id);
    const v = validatePasien(input);
    if (!v.ok) return v;
    const pasien: Pasien = { ...existing, ...v.value, id: existing.id, updatedAt: this.stamp() };
    await this.write(() => repo.updatePasien(pasien));
    this.commit((d) => ({ ...d, pasien: d.pasien.map((p) => (p.id === id ? pasien : p)) }));
    return { ok: true, value: pasien };
  }

  /** Hapus pasien beserta seluruh sesi, jadwal, dan fotonya dalam satu transaksi (Req 3.2, 3.6, 4.4). */
  async deletePasien(id: string): Promise<void> {
    const repo = this.requireRepo();
    await this.write(() => repo.deletePasienCascade(id), PESAN_GAGAL_HAPUS);
    const sesiIds = new Set(this.state.data.sesi.filter((s) => s.pasienId === id).map((s) => s.id));
    this.setState({
      status: 'ready',
      data: {
        pasien: this.state.data.pasien.filter((p) => p.id !== id),
        sesi: this.state.data.sesi.filter((s) => s.pasienId !== id),
        jadwal: this.state.data.jadwal.filter((j) => j.pasienId !== id),
      },
      foto: this.state.foto.filter((f) => !sesiIds.has(f.sesiId)),
      pengaturan: this.state.pengaturan,
      error: undefined,
    });
  }

  // ----- Aksi sesi terapi -----------------------------------------------------

  /** NotFoundError jika pasien tidak ada. */
  async addSesi(pasienId: string, input: SesiInput): Promise<ActionResult<SesiTerapi, SesiField>> {
    const repo = this.requireRepo();
    if (!this.findPasien(pasienId)) throw new NotFoundError('pasien', pasienId);
    const v = validateSesi(input);
    if (!v.ok) return v;
    const t = this.stamp();
    const sesi: SesiTerapi = { id: this.makeId(), pasienId, ...v.value, createdAt: t, updatedAt: t };
    await this.write(() => repo.addSesi(sesi));
    this.commit((d) => ({ ...d, sesi: [...d.sesi, sesi] }));
    return { ok: true, value: sesi };
  }

  /** pasienId dan createdAt dipertahankan (Req 6.1). NotFoundError jika sesi tidak ada. */
  async updateSesi(id: string, input: SesiInput): Promise<ActionResult<SesiTerapi, SesiField>> {
    const repo = this.requireRepo();
    const existing = this.state.data.sesi.find((s) => s.id === id);
    if (!existing) throw new NotFoundError('sesi', id);
    const v = validateSesi(input);
    if (!v.ok) return v;
    const sesi: SesiTerapi = {
      ...existing,
      ...v.value,
      id: existing.id,
      pasienId: existing.pasienId,
      updatedAt: this.stamp(),
    };
    await this.write(() => repo.updateSesi(sesi));
    this.commit((d) => ({ ...d, sesi: d.sesi.map((s) => (s.id === id ? sesi : s)) }));
    return { ok: true, value: sesi };
  }

  /**
   * Simpan sesi terapi beserta foto secara atomik (Req 2.12, 2.13, 2.15).
   * mode tambah: sesiId null, mode ubah: sesiId string.
   */
  async simpanSesi(
    pasienId: string,
    sesiId: string | null,
    input: SesiInput,
    draft: FotoDraft,
  ): Promise<ActionResult<SesiTerapi, SesiField>> {
    const repo = this.requireRepo();
    if (!this.findPasien(pasienId)) throw new NotFoundError('pasien', pasienId);
    const v = validateSesi(input);
    if (!v.ok) return v;

    if (sesiId === null) {
      // Tambah baru
      const t = this.stamp();
      const sesi: SesiTerapi = { id: this.makeId(), pasienId, ...v.value, createdAt: t, updatedAt: t };
      const diff = diffDraft([], draft);
      let savedMetas: FotoMeta[] = [];
      await this.write(async () => {
        savedMetas = await repo.saveSesiDenganFoto(sesi, 'tambah', diff);
      });
      this.setState({
        status: 'ready',
        data: { ...this.state.data, sesi: [...this.state.data.sesi, sesi] },
        foto: [...this.state.foto, ...savedMetas],
        pengaturan: this.state.pengaturan,
        error: undefined,
      });
      return { ok: true, value: sesi };
    } else {
      // Ubah sesi yang ada
      const existing = this.state.data.sesi.find((s) => s.id === sesiId);
      if (!existing) throw new NotFoundError('sesi', sesiId);
      const sesi: SesiTerapi = {
        ...existing,
        ...v.value,
        id: existing.id,
        pasienId: existing.pasienId,
        updatedAt: this.stamp(),
      };
      const fotoAwal = this.state.foto.filter((f) => f.sesiId === sesiId).sort((a, b) => a.urutan - b.urutan);
      const diff = diffDraft(fotoAwal, draft);
      let savedMetas: FotoMeta[] = [];
      await this.write(async () => {
        savedMetas = await repo.saveSesiDenganFoto(sesi, 'ubah', diff);
      });
      this.setState({
        status: 'ready',
        data: { ...this.state.data, sesi: this.state.data.sesi.map((s) => (s.id === sesiId ? sesi : s)) },
        foto: [...this.state.foto.filter((f) => f.sesiId !== sesiId), ...savedMetas],
        pengaturan: this.state.pengaturan,
        error: undefined,
      });
      return { ok: true, value: sesi };
    }
  }

  async deleteSesi(id: string): Promise<void> {
    const repo = this.requireRepo();
    await this.write(() => repo.deleteSesi(id), PESAN_GAGAL_HAPUS);
    this.setState({
      status: 'ready',
      data: { ...this.state.data, sesi: this.state.data.sesi.filter((s) => s.id !== id) },
      foto: this.state.foto.filter((f) => f.sesiId !== id),
      pengaturan: this.state.pengaturan,
      error: undefined,
    });
  }

  // ----- Aksi pengaturan laporan ----------------------------------------------

  /**
   * Simpan pengaturan laporan beserta logo praktik secara atomik (Req 7.2, 7.7, 7.10, 10.9).
   */
  async simpanPengaturan(
    input: PengaturanInput,
    logoDraft: DraftLogo,
  ): Promise<ActionResult<PengaturanLaporan, 'namaPraktik' | 'alamatPraktik' | 'noHpPraktik'>> {
    const repo = this.requireRepo();
    const v = validatePengaturan(input);
    if (!v.ok) return v;

    let logoMeta: LogoMeta | null = null;
    let logoData: ArrayBuffer | null | undefined = undefined;

    if (logoDraft.jenis === 'tetap') {
      logoMeta = this.state.pengaturan?.logo ?? null;
      logoData = undefined;
    } else if (logoDraft.jenis === 'hapus') {
      logoMeta = null;
      logoData = null;
    } else if (logoDraft.jenis === 'baru') {
      logoMeta = {
        mime: logoDraft.foto.mime,
        lebar: logoDraft.foto.lebar,
        tinggi: logoDraft.foto.tinggi,
        ukuran: logoDraft.foto.ukuran,
        diperbaruiPada: this.stamp(),
      };
      logoData = logoDraft.foto.data;
    }

    const pengaturanBaru: PengaturanLaporan = {
      namaPraktik: v.value.namaPraktik,
      alamatPraktik: v.value.alamatPraktik,
      noHpPraktik: v.value.noHpPraktik,
      logo: logoMeta,
    };

    await this.write(() => repo.savePengaturan(pengaturanBaru, logoData));
    this.setState({
      ...this.state,
      pengaturan: pengaturanBaru,
    });
    return { ok: true, value: pengaturanBaru };
  }

  async loadLogoBlob(): Promise<Blob | null> {
    const repo = this.requireRepo();
    const logoMeta = this.state.pengaturan?.logo;
    if (!logoMeta) return null;
    const data = await repo.loadLogoData();
    if (!data) return null;
    return new Blob([data], { type: logoMeta.mime });
  }

  // ----- Aksi jadwal kunjungan ------------------------------------------------

  private pasienIds(): Set<string> {
    return new Set(this.state.data.pasien.map((p) => p.id));
  }

  /** Jadwal baru selalu berstatus Terjadwal (Req 8.1). */
  async addJadwal(input: JadwalInput): Promise<ActionResult<JadwalKunjungan, JadwalField>> {
    const repo = this.requireRepo();
    const v = validateJadwal(input, this.now(), this.pasienIds());
    if (!v.ok) return v;
    const t = this.stamp();
    const jadwal: JadwalKunjungan = {
      id: this.makeId(),
      ...v.value,
      status: 'Terjadwal',
      createdAt: t,
      updatedAt: t,
    };
    await this.write(() => repo.addJadwal(jadwal));
    this.commit((d) => ({ ...d, jadwal: [...d.jadwal, jadwal] }));
    return { ok: true, value: jadwal };
  }

  /** Status dipertahankan (Req 8.7). NotFoundError jika jadwal tidak ada. */
  async updateJadwal(id: string, input: JadwalInput): Promise<ActionResult<JadwalKunjungan, JadwalField>> {
    const repo = this.requireRepo();
    const existing = this.state.data.jadwal.find((j) => j.id === id);
    if (!existing) throw new NotFoundError('jadwal', id);
    const v = validateJadwal(input, this.now(), this.pasienIds());
    if (!v.ok) return v;
    const jadwal: JadwalKunjungan = {
      ...existing,
      ...v.value,
      id: existing.id,
      status: existing.status,
      updatedAt: this.stamp(),
    };
    await this.write(() => repo.updateJadwal(jadwal));
    this.commit((d) => ({ ...d, jadwal: d.jadwal.map((j) => (j.id === id ? jadwal : j)) }));
    return { ok: true, value: jadwal };
  }

  /**
   * Tandai jadwal Selesai/Dibatalkan via `transisiStatus` (Req 8.9, 8.10).
   * Mengembalikan null tanpa menulis apa pun jika status awal bukan Terjadwal
   * (Req 8.14). NotFoundError jika jadwal tidak ada.
   */
  async ubahStatusJadwal(id: string, target: 'Selesai' | 'Dibatalkan'): Promise<JadwalKunjungan | null> {
    const repo = this.requireRepo();
    const existing = this.state.data.jadwal.find((j) => j.id === id);
    if (!existing) throw new NotFoundError('jadwal', id);
    if (!aksiTersedia(existing).selesai) return null;
    const jadwal = transisiStatus(existing, target, this.stamp());
    if (!jadwal) return null;
    await this.write(() => repo.updateJadwal(jadwal));
    this.commit((d) => ({ ...d, jadwal: d.jadwal.map((j) => (j.id === id ? jadwal : j)) }));
    return jadwal;
  }

  tandaiSelesai(id: string): Promise<JadwalKunjungan | null> {
    return this.ubahStatusJadwal(id, 'Selesai');
  }

  tandaiDibatalkan(id: string): Promise<JadwalKunjungan | null> {
    return this.ubahStatusJadwal(id, 'Dibatalkan');
  }

  async deleteJadwal(id: string): Promise<void> {
    const repo = this.requireRepo();
    await this.write(() => repo.deleteJadwal(id), PESAN_GAGAL_HAPUS);
    this.commit((d) => ({ ...d, jadwal: d.jadwal.filter((j) => j.id !== id) }));
  }

  // ----- Cadangan (ekspor / impor) ------------------------------------------------

  private fileGateway(): FileGateway {
    if (!this.gateway) this.gateway = createFileGateway();
    return this.gateway;
  }

  /**
   * Ekspor seluruh data di memori (snapshot saat ekspor dimulai) ke satu
   * File_Cadangan (Req 14.1, 14.2, 14.10). Tidak mengubah data tersimpan.
   * Gagal membuat/menyimpan file → ExportError (Req 14.11).
   */
  async exportBackup(): Promise<ExportBackupResult> {
    this.requireRepo();
    const data = this.state.data;
    const counts = hitung(data);
    try {
      const waktu = this.now();
      const fileName = backupFileName(waktu);
      const content = serializeBackup(data, waktu);
      const { location } = await this.fileGateway().saveText(fileName, content);
      return { fileName, location, counts };
    } catch (e) {
      if (e instanceof ExportError) throw e;
      throw new ExportError(e);
    }
  }

  /**
   * Membuka pemilih file lalu memvalidasi isinya dengan `parseBackup`.
   * null jika pemilihan dibatalkan (Req 14.12). Tidak menulis apa pun;
   * pemanggil menampilkan konfirmasi lalu memanggil `importBackup`.
   */
  async pickBackupFile(): Promise<ParseBackupResult | null> {
    const text = await this.fileGateway().pickTextFile();
    if (text === null) return null;
    return parseBackup(text);
  }

  /**
   * Mengganti seluruh data dengan `data` dalam satu transaksi `replaceAll`
   * (Req 14.4, 14.9). Memori diperbarui hanya setelah transaksi berhasil;
   * kegagalan → ImportError dan memori/penyimpanan tetap seperti semula (Req 14.7).
   */
  async importBackup(data: AppData): Promise<Counts> {
    const repo = this.requireRepo();
    const next: AppData = { pasien: [...data.pasien], sesi: [...data.sesi], jadwal: [...data.jadwal] };
    try {
      await repo.replaceAll(next);
    } catch (e) {
      throw new ImportError(e);
    }
    const sesiIds = new Set(next.sesi.map((s) => s.id));
    if (this.state.status === 'ready') {
      this.setState({
        status: 'ready',
        data: next,
        foto: this.state.foto.filter((f) => sesiIds.has(f.sesiId)),
        pengaturan: this.state.pengaturan,
        error: undefined,
      });
    }
    return hitung(next);
  }

  // ----- Selector ter-memoize ---------------------------------------------------
  // Hasil stabil (referensi sama) selama array sumber tidak berubah, sehingga
  // aman dipakai langsung sebagai snapshot useSyncExternalStore.

  /** Daftar pasien terurut, difilter kata kunci (kosong → semua). Req 4.2–4.4 */
  selectPasienList(keyword = ''): Pasien[] {
    const { pasien } = this.state.data;
    return this.memoPasienList.get([pasien], keyword, () => searchPasien(pasien, keyword));
  }

  selectPasien(id: string): Pasien | undefined {
    const { pasien } = this.state.data;
    return this.memoPasienById.get([pasien], '', () => new Map(pasien.map((p) => [p.id, p]))).get(id);
  }

  /** Tanggal sesi terakhir per pasien; null jika belum ada sesi (Req 4.1, 4.7). */
  selectLastTherapyDate(pasienId: string): string | null {
    const { sesi } = this.state.data;
    const map = this.memoLastTherapy.get([sesi], '', () => {
      const m = new Map<string, string>();
      for (const s of sesi) {
        const cur = m.get(s.pasienId);
        if (cur === undefined || s.tanggal > cur) m.set(s.pasienId, s.tanggal);
      }
      return m;
    });
    return map.get(pasienId) ?? null;
  }

  selectHistori(pasienId: string): Histori {
    const { sesi } = this.state.data;
    return this.memoHistori.get([sesi], pasienId, () => buildHistori(pasienId, sesi));
  }

  selectJadwalPadaTanggal(tanggal: string): JadwalKunjungan[] {
    const { jadwal } = this.state.data;
    return this.memoJadwalTanggal.get([jadwal], tanggal, () => jadwalPadaTanggal(tanggal, jadwal));
  }

  selectJadwalTerjadwalPasien(pasienId: string): JadwalKunjungan[] {
    const { jadwal } = this.state.data;
    return this.memoJadwalPasien.get([jadwal], pasienId, () => jadwalTerjadwalPasien(pasienId, jadwal));
  }

  selectLaporan(bulan: number, tahun: number): Laporan {
    const { sesi, pasien } = this.state.data;
    return this.memoLaporan.get([sesi, pasien], `${tahun}-${bulan}`, () =>
      buildLaporan(bulan, tahun, sesi, pasien),
    );
  }

  /** Jumlah sesi, jadwal & foto yang ikut terhapus bersama pasien (Req 3.1, 4.5, 4.6). */
  selectDeletionSummary(pasienId: string): { jumlahSesi: number; jumlahJadwal: number; jumlahFoto: number } {
    const { sesi, jadwal } = this.state.data;
    const foto = this.state.foto;
    return this.memoSummary.get([sesi, jadwal, foto], pasienId, () =>
      deletionSummary(pasienId, sesi, jadwal, foto),
    );
  }

  /** Foto-foto milik sesi tertentu, terurut berdasarkan urutan menaik. */
  selectFotoSesi(sesiId: string): FotoMeta[] {
    const foto = this.state.foto;
    return this.memoFotoSesi.get([foto], sesiId, () =>
      foto.filter((f) => f.sesiId === sesiId).sort((a, b) => a.urutan - b.urutan),
    );
  }

  /** Total jumlah foto di seluruh sesi milik pasien. */
  selectJumlahFotoPasien(pasienId: string): number {
    const sesiIds = new Set(this.state.data.sesi.filter((s) => s.pasienId === pasienId).map((s) => s.id));
    return this.state.foto.filter((f) => sesiIds.has(f.sesiId)).length;
  }

  /** Pengaturan laporan dan logo praktik terkini di memori. */
  selectPengaturan(): PengaturanLaporan | null {
    return this.state.pengaturan;
  }

  /** Memuat byte gambar foto dari basis data dan mengembalikan Blob. */
  async loadFotoBlob(meta: FotoMeta): Promise<Blob> {
    const repo = this.requireRepo();
    const data = await repo.loadFotoData(meta.id);
    return new Blob([data], { type: meta.mime });
  }
}

export function createDataStore(options: DataStoreOptions): DataStore {
  return new DataStore(options);
}

// ---------------------------------------------------------------------------
// Integrasi React
// ---------------------------------------------------------------------------

const DataStoreContext = createContext<DataStore | null>(null);

export function DataStoreProvider(props: { store: DataStore; children?: ReactNode }): ReactNode {
  return createElement(DataStoreContext.Provider, { value: props.store }, props.children);
}

/** Instance DataStore dari context; melempar jika di luar DataStoreProvider. */
export function useDataStore(): DataStore {
  const store = useContext(DataStoreContext);
  if (!store) throw new Error('useDataStore harus dipakai di dalam DataStoreProvider');
  return store;
}

/** Snapshot state terkini; komponen re-render setiap kali data berubah. */
export function useDataStoreState(): DataStoreState {
  const store = useDataStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

/**
 * Berlangganan hasil selector. Selector harus mengembalikan referensi stabil
 * untuk state yang sama (gunakan selector bawaan DataStore yang ter-memoize).
 */
export function useDataStoreSelector<T>(selector: (store: DataStore, state: DataStoreState) => T): T {
  const store = useDataStore();
  const get = (): T => selector(store, store.getState());
  return useSyncExternalStore(store.subscribe, get, get);
}
