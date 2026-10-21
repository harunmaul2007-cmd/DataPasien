// ContactGateway: memilih kontak dari buku telepon perangkat (Req 11).
// Menggunakan Contact Picker API bawaan peramban/WebView (navigator.contacts).

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

interface NavigatorWithContacts extends Navigator {
  contacts?: {
    getProperties?(): Promise<string[]>;
    select(props: string[], options?: { multiple?: boolean }): Promise<Array<{ name?: string[]; tel?: string[] }>>;
  };
}

export class WebContactGateway implements ContactGateway {
  private get nav(): NavigatorWithContacts | undefined {
    return typeof navigator !== 'undefined' ? (navigator as NavigatorWithContacts) : undefined;
  }

  tersedia(): boolean {
    const nav = this.nav;
    return !!(nav && 'contacts' in nav && typeof nav.contacts?.select === 'function');
  }

  async pilih(): Promise<KontakTerpilih | null> {
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

      const nama = (c.name && c.name[0]) ? c.name[0].trim() : '';
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

export function createContactGateway(): ContactGateway {
  return new WebContactGateway();
}
