// ContactGateway: memilih kontak dari buku telepon perangkat (Req 11).
// - Android APK (Capacitor native): Menggunakan Intent.ACTION_PICK via ContactPickerPlugin
// - Web / PWA: Menggunakan Contact Picker API bawaan peramban (navigator.contacts).

import { Capacitor, registerPlugin } from '@capacitor/core';
import { ContactError } from './errors';

export interface KontakTerpilih {
  nama: string;
  nomor: string[];
}

export interface ContactGateway {
  tersedia(): boolean;
  /** null jika dibatalkan; melempar ContactError bila izin ditolak atau galat sistem. */
  pilih(): Promise<KontakTerpilih | null>;
}

interface NativeContactPickerPlugin {
  pickContact(): Promise<{ name?: string; number?: string } | undefined>;
}

interface NavigatorWithContacts extends Navigator {
  contacts?: {
    getProperties?(): Promise<string[]>;
    select(props: string[], options?: { multiple?: boolean }): Promise<Array<{ name?: string[]; tel?: string[] }>>;
  };
}

export class DefaultContactGateway implements ContactGateway {
  private get nav(): NavigatorWithContacts | undefined {
    return typeof navigator !== 'undefined' ? (navigator as NavigatorWithContacts) : undefined;
  }

  tersedia(): boolean {
    if (Capacitor.isNativePlatform()) {
      return true;
    }
    const nav = this.nav;
    return !!(nav && 'contacts' in nav && typeof nav.contacts?.select === 'function');
  }

  async pilih(): Promise<KontakTerpilih | null> {
    if (Capacitor.isNativePlatform()) {
      try {
        const ContactPicker = registerPlugin<NativeContactPickerPlugin>('ContactPicker');
        const res = await ContactPicker.pickContact();
        if (!res || !res.number) {
          return null; // Dibatalkan oleh pengguna
        }
        return {
          nama: res.name ? res.name.trim() : '',
          nomor: [res.number.trim()],
        };
      } catch (err: unknown) {
        throw new ContactError('Kontak tidak dapat diakses di Android', err);
      }
    }

    const nav = this.nav;
    if (!nav?.contacts?.select) {
      throw new ContactError('Pemilih kontak tidak didukung di perangkat ini');
    }

    try {
      const hasil = await nav.contacts.select(['name', 'tel'], { multiple: false });
      if (!hasil || hasil.length === 0) {
        return null;
      }
      const c = hasil[0];
      if (!c) return null;

      const nama = c.name && c.name[0] ? c.name[0].trim() : '';
      const nomor = (c.tel || []).map((t) => t.trim()).filter((t) => t.length > 0);
      return { nama, nomor };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      throw new ContactError('Kontak tidak dapat diakses', err);
    }
  }
}

export { DefaultContactGateway as WebContactGateway };

export function createContactGateway(): ContactGateway {
  return new DefaultContactGateway();
}
