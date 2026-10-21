// Kelas kesalahan yang dipakai lapisan infrastruktur dan DataStore.

export type EntityKind = 'pasien' | 'sesi' | 'jadwal' | 'foto' | 'pengaturan';

/** Dilempar saat rekaman yang ingin diubah tidak ditemukan. */
export class NotFoundError extends Error {
  readonly entity: EntityKind;
  readonly id: string;

  constructor(entity: EntityKind, id: string) {
    super(`Data ${entity} dengan id "${id}" tidak ditemukan`);
    this.name = 'NotFoundError';
    this.entity = entity;
    this.id = id;
  }
}

/** Dilempar DataStore saat penulisan ke Repository gagal ("Data gagal disimpan"). */
export class SaveError extends Error {
  override readonly cause: unknown;

  constructor(cause?: unknown, message = 'Data gagal disimpan') {
    super(message);
    this.name = 'SaveError';
    this.cause = cause;
  }
}

export type AlasanSaveFile = 'izin' | 'gagal';

/** Dilempar saat penyimpanan file biner gagal. */
export class SaveFileError extends Error {
  readonly alasan: AlasanSaveFile;
  override readonly cause?: unknown;

  constructor(alasan: AlasanSaveFile = 'gagal', message = 'Gagal menyimpan file', cause?: unknown) {
    super(message);
    this.name = 'SaveFileError';
    this.alasan = alasan;
    this.cause = cause;
  }
}

/** Dilempar saat operasi berbagi file gagal. */
export class ShareError extends Error {
  override readonly cause?: unknown;

  constructor(message = 'Gagal membagikan file', cause?: unknown) {
    super(message);
    this.name = 'ShareError';
    this.cause = cause;
  }
}

/** Dilempar saat akses kontak perangkat gagal. */
export class ContactError extends Error {
  override readonly cause?: unknown;

  constructor(message = 'Gagal mengakses kontak', cause?: unknown) {
    super(message);
    this.name = 'ContactError';
    this.cause = cause;
  }
}
