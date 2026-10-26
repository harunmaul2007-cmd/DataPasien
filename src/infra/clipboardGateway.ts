// ClipboardGateway: baca/tulis teks papan klip.
//
// - Android: @capacitor/clipboard (navigator.clipboard.readText tidak diizinkan di WebView).
// - Web: navigator.clipboard (butuh konteks aman & izin peramban).
// Seluruh kegagalan dikembalikan sebagai null/false, tidak melempar.

import { Capacitor } from '@capacitor/core';

export interface ClipboardGateway {
  readText(): Promise<string | null>;
  writeText(text: string): Promise<boolean>;
}

export class WebClipboardGateway implements ClipboardGateway {
  async readText(): Promise<string | null> {
    try {
      if (!navigator.clipboard?.readText) return null;
      return await navigator.clipboard.readText();
    } catch {
      return null;
    }
  }

  async writeText(text: string): Promise<boolean> {
    try {
      if (!navigator.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
}

export class AndroidClipboardGateway implements ClipboardGateway {
  async readText(): Promise<string | null> {
    try {
      const { Clipboard } = await import('@capacitor/clipboard');
      const res = await Clipboard.read();
      return typeof res.value === 'string' ? res.value : null;
    } catch {
      return null;
    }
  }

  async writeText(text: string): Promise<boolean> {
    try {
      const { Clipboard } = await import('@capacitor/clipboard');
      await Clipboard.write({ string: text });
      return true;
    } catch {
      return false;
    }
  }
}

export function createClipboardGateway(isNative: boolean = Capacitor.isNativePlatform()): ClipboardGateway {
  return isNative ? new AndroidClipboardGateway() : new WebClipboardGateway();
}
