// ShareGateway: berbagi file PDF/laporan (Req 8).
//
// - Web: Web Share API Level 2 (navigator.canShare + navigator.share).
// - Android: @capacitor/share dengan file disimpan di Directory.Cache.

import { Capacitor } from '@capacitor/core';
import { ShareError } from './errors';
import { uint8ArrayToBase64 } from './fileGateway';

export interface ShareGateway {
  canShareFile(mime: string): Promise<boolean>;
  /** 'dibagikan' | 'dibatalkan'; melempar ShareError untuk kegagalan lain. */
  shareFile(fileName: string, data: Uint8Array, mime: string, title: string): Promise<'dibagikan' | 'dibatalkan'>;
  /** Bersihkan file sementara di cache (folder laporan/ pada Android). */
  bersihkanCache(): Promise<void>;
}

export class WebShareGateway implements ShareGateway {
  async canShareFile(mime: string): Promise<boolean> {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
      return false;
    }
    try {
      const fileUji = new File([], 'test.pdf', { type: mime });
      return navigator.canShare({ files: [fileUji] });
    } catch {
      return false;
    }
  }

  async shareFile(fileName: string, data: Uint8Array, mime: string, title: string): Promise<'dibagikan' | 'dibatalkan'> {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      throw new ShareError('Fitur berbagi file tidak didukung pada peramban ini');
    }

    const file = new File([data as unknown as BlobPart], fileName, { type: mime });
    try {
      await navigator.share({
        files: [file],
        title,
      });
      return 'dibagikan';
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'dibatalkan';
      }
      throw new ShareError('Gagal membagikan file', err);
    }
  }

  async bersihkanCache(): Promise<void> {
    // Pada web tidak ada file cache fisik yang perlu dihapus
  }
}

export class AndroidShareGateway implements ShareGateway {
  async canShareFile(_mime: string): Promise<boolean> {
    try {
      const { Share } = await import('@capacitor/share');
      const res = await Share.canShare();
      return res.value;
    } catch {
      return false;
    }
  }

  async shareFile(fileName: string, data: Uint8Array, _mime: string, title: string): Promise<'dibagikan' | 'dibatalkan'> {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    const cachePath = `laporan/${fileName}`;
    try {
      await Filesystem.writeFile({
        directory: Directory.Cache,
        path: cachePath,
        data: uint8ArrayToBase64(data),
        recursive: true,
      });

      const uriResult = await Filesystem.getUri({
        directory: Directory.Cache,
        path: cachePath,
      });

      await Share.share({
        title,
        dialogTitle: title,
        files: [uriResult.uri],
      });
      return 'dibagikan';
    } catch (err: unknown) {
      const pesan = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (pesan.includes('cancel') || pesan.includes('batal')) {
        return 'dibatalkan';
      }
      throw new ShareError('Gagal membagikan file', err);
    }
  }

  async bersihkanCache(): Promise<void> {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.rmdir({
        directory: Directory.Cache,
        path: 'laporan',
        recursive: true,
      });
    } catch {
      // Abaikan galat pembersihan cache
    }
  }
}

export function createShareGateway(isNative: boolean = Capacitor.isNativePlatform()): ShareGateway {
  return isNative ? new AndroidShareGateway() : new WebShareGateway();
}
