// FileGateway: menyimpan dan memilih file teks/biner (Req 8, 14).
//
// - Web: `saveText` dan `saveBinary` membuat Blob lalu memicu unduhan (lokasi "folder Unduhan").
// - Android (Capacitor native): `saveText` dan `saveBinary` menulis ke direktori Documents
//   melalui @capacitor/filesystem; lokasi = path file.
// - `pickTextFile` di kedua platform memakai `<input type="file">`.

import { Capacitor } from '@capacitor/core';
import { namaFileUnik } from '../domain/laporanSesi';
import { SaveFileError } from './errors';

export interface FileGateway {
  saveText(fileName: string, content: string): Promise<{ location: string }>;
  /** Isi file terpilih, atau null jika pemilihan dibatalkan (Req 14.12). */
  pickTextFile(): Promise<string | null>;
  /** Simpan file biner (PDF/gambar). Menghasilkan nama file final dan lokasi penyimpanan. */
  saveBinary(fileName: string, data: Uint8Array, mime: string): Promise<{ fileName: string; location: string }>;
}

export const LOKASI_UNDUHAN = 'folder Unduhan';
export const ACCEPT_CADANGAN = '.json,application/json';

/**
 * Konversi Uint8Array ke base64 string secara chunked untuk menghindari call stack limit.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }
  return btoa(chunks.join(''));
}

/**
 * Membuka pemilih file dan membaca isi file terpilih sebagai teks UTF-8.
 * Resolve null bila dibatalkan atau tidak ada file yang dipilih.
 */
export function pickTextFileViaInput(doc: Document = document): Promise<string | null> {
  return new Promise<string | null>((resolve, reject) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_CADANGAN;
    input.style.display = 'none';
    let selesai = false;

    const bersihkan = (): void => {
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      input.remove();
    };
    const akhiri = (fn: () => void): void => {
      if (selesai) return;
      selesai = true;
      bersihkan();
      fn();
    };
    function onCancel(): void {
      akhiri(() => resolve(null));
    }
    function onChange(): void {
      const file = input.files?.[0];
      if (!file) {
        akhiri(() => resolve(null));
        return;
      }
      akhiri(() => {
        file.text().then(resolve, reject);
      });
    }

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    doc.body.appendChild(input);
    input.click();
  });
}

export class WebFileGateway implements FileGateway {
  constructor(private readonly doc: Document = document) {}

  async saveText(fileName: string, content: string): Promise<{ location: string }> {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = this.doc.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    this.doc.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return { location: LOKASI_UNDUHAN };
  }

  async saveBinary(fileName: string, data: Uint8Array, mime: string): Promise<{ fileName: string; location: string }> {
    const blob = new Blob([data as unknown as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = this.doc.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    a.style.display = 'none';
    this.doc.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return { fileName, location: LOKASI_UNDUHAN };
  }

  pickTextFile(): Promise<string | null> {
    return pickTextFileViaInput(this.doc);
  }
}

/** "file:///storage/emulated/0/Documents/x.json" → "/storage/emulated/0/Documents/x.json". */
export function uriKePath(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  try {
    return decodeURIComponent(uri.slice('file://'.length));
  } catch {
    return uri.slice('file://'.length);
  }
}

export class AndroidFileGateway implements FileGateway {
  constructor(private readonly doc: Document = document) {}

  async saveText(fileName: string, content: string): Promise<{ location: string }> {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const result = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    return { location: uriKePath(result.uri) };
  }

  async saveBinary(fileName: string, data: Uint8Array, _mime: string): Promise<{ fileName: string; location: string }> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    // Cek izin penyimpanan jika platform mendukung
    try {
      if (typeof Filesystem.checkPermissions === 'function') {
        const status = await Filesystem.checkPermissions();
        if (status.publicStorage === 'denied' || status.publicStorage === 'prompt-with-rationale') {
          if (typeof Filesystem.requestPermissions === 'function') {
            const req = await Filesystem.requestPermissions();
            if (req.publicStorage === 'denied') {
              throw new SaveFileError('izin', 'Izin penyimpanan ditolak');
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof SaveFileError) throw err;
    }

    // Ambil daftar file di direktori Documents untuk pencegahan bentrok nama
    const terpakai = new Set<string>();
    try {
      const list = await Filesystem.readdir({ directory: Directory.Documents, path: '' });
      for (const f of list.files) {
        terpakai.add(typeof f === 'string' ? f : f.name);
      }
    } catch {
      // Abaikan galat readdir
    }

    let nama = namaFileUnik(fileName, terpakai);
    for (let i = 0; i < 1000; i++) {
      try {
        await Filesystem.stat({ directory: Directory.Documents, path: nama });
        terpakai.add(nama);
        nama = namaFileUnik(fileName, terpakai);
      } catch {
        // File belum ada, nama aman dipakai
        break;
      }
    }

    try {
      const result = await Filesystem.writeFile({
        directory: Directory.Documents,
        path: nama,
        data: uint8ArrayToBase64(data),
        recursive: true,
      });
      return { fileName: nama, location: uriKePath(result.uri) };
    } catch (err) {
      try {
        await Filesystem.deleteFile({ directory: Directory.Documents, path: nama });
      } catch {
        // Abaikan galat saat mencoba menghapus
      }
      throw new SaveFileError('gagal', 'Gagal menyimpan file', err);
    }
  }

  pickTextFile(): Promise<string | null> {
    return pickTextFileViaInput(this.doc);
  }
}

/** FileGateway sesuai platform: Android native → Filesystem, selain itu web. */
export function createFileGateway(isNative: boolean = Capacitor.isNativePlatform()): FileGateway {
  return isNative ? new AndroidFileGateway() : new WebFileGateway();
}
