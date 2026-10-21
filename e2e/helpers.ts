// Utilitas bersama uji E2E: menunggu aplikasi siap, mengisi IndexedDB
// langsung lewat page.evaluate, serta pemeriksaan tata letak (Req 11.1, 11.3).

import { expect, type Locator, type Page } from '@playwright/test';

export const DB_NAME = 'datapasien';
export const MIN_TOUCH = 44;

export interface SeedPasien {
  id: string;
  nama: string;
  alamat: string;
  noHp: string;
  createdAt: number;
  updatedAt: number;
}

export interface SeedSesi {
  id: string;
  pasienId: string;
  tanggal: string;
  keluhan: string;
  polaPenyakit: string;
  terapi: string;
  hasil: string;
  biaya: number;
  createdAt: number;
  updatedAt: number;
}

export interface SeedJadwal {
  id: string;
  pasienId: string;
  tanggal: string;
  jam: string;
  catatan: string;
  status: 'Terjadwal' | 'Selesai' | 'Dibatalkan';
  createdAt: number;
  updatedAt: number;
}

export interface SeedData {
  pasien: SeedPasien[];
  sesi: SeedSesi[];
  jadwal: SeedJadwal[];
}

/** Menunggu Halaman_Utama (daftar pasien) selesai dimuat. */
export async function waitForPasienList(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Pasien' })).toBeVisible();
}

/** Membuka aplikasi dan menunggu basis data Dexie dibuat oleh aplikasi. */
export async function openApp(page: Page, hash = '#/'): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.locator('main.app__main h1').first()).toBeVisible();
}

/**
 * Mengisi IndexedDB secara langsung. Basis data harus sudah dibuat oleh
 * aplikasi (panggil openApp terlebih dahulu); setelahnya muat ulang halaman
 * agar DataStore membaca data baru.
 */
export async function seedDb(page: Page, data: SeedData): Promise<void> {
  await page.evaluate(
    async ({ name, data }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(name);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['pasien', 'sesi', 'jadwal'], 'readwrite');
        for (const p of data.pasien) tx.objectStore('pasien').put(p);
        for (const s of data.sesi) tx.objectStore('sesi').put(s);
        for (const j of data.jadwal) tx.objectStore('jadwal').put(j);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      db.close();
    },
    { name: DB_NAME, data },
  );
}

/** Jumlah rekaman per tabel langsung dari IndexedDB. */
export async function countDb(page: Page): Promise<{ pasien: number; sesi: number; jadwal: number }> {
  return page.evaluate(async (name) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const count = (store: string) =>
      new Promise<number>((resolve, reject) => {
        const req = db.transaction(store, 'readonly').objectStore(store).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const result = { pasien: await count('pasien'), sesi: await count('sesi'), jadwal: await count('jadwal') };
    db.close();
    return result;
  }, DB_NAME);
}

/** Tanggal lokal "YYYY-MM-DD". */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Format_Rupiah tanpa bergantung pada ICU Node. */
export function rupiah(n: number): string {
  return `Rp ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** Data contoh kecil dengan teks panjang & non-ASCII untuk menguji pemotongan. */
export function sampleData(today: Date = new Date()): SeedData {
  const now = Date.now();
  const tgl = isoDate(today);
  const pasien: SeedPasien[] = [
    {
      id: 'p-1',
      nama: 'Siti Nurhaliza Binti Abdurrahman Wahid Al-Mustafa Ramadhani Kusumawardhani',
      alamat: 'Jl. Panjang Sekali Nomor 123456789, RT 001/RW 002, Kelurahan Sukamaju Makmur Sentosa, Kecamatan Sejahtera',
      noHp: '+628123456789012',
      createdAt: now,
      updatedAt: now,
    },
    { id: 'p-2', nama: 'Budi Ünal Çelik', alamat: '', noHp: '081234567890', createdAt: now, updatedAt: now },
  ];
  const sesi: SeedSesi[] = [
    {
      id: 's-1',
      pasienId: 'p-1',
      tanggal: tgl,
      keluhan: 'Nyeri punggung bawah menjalar ke kaki kiri '.repeat(5).trim(),
      polaPenyakit: 'Kelelahan otot',
      terapi: 'Pijat refleksi dan akupresur titik meridian '.repeat(3).trim(),
      hasil: 'Membaik',
      biaya: 999_999_999,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const jadwal: SeedJadwal[] = [
    {
      id: 'j-1',
      pasienId: 'p-1',
      tanggal: tgl,
      jam: '09:30',
      catatan: 'Bawa hasil rontgen terbaru dan surat rujukan dari dokter spesialis ortopedi',
      status: 'Terjadwal',
      createdAt: now,
      updatedAt: now,
    },
  ];
  return { pasien, sesi, jadwal };
}

interface LayoutProblem {
  kind: 'overflow' | 'touch' | 'offscreen' | 'overlap';
  detail: string;
}

/**
 * Memeriksa (dalam `scope`, default seluruh dokumen):
 * - tidak ada scroll horizontal pada dokumen (Req 11.1);
 * - setiap elemen interaktif yang terlihat ≥ 44×44 px (Req 11.3);
 * - tidak ada elemen interaktif yang keluar dari sisi kiri/kanan layar;
 * - elemen interaktif tidak saling tumpang tindih (navigasi diperiksa terpisah
 *   dari konten karena bilah bawah sengaja melayang di atas konten).
 */
export async function layoutProblems(page: Page, scopeSelector?: string): Promise<LayoutProblem[]> {
  return page.evaluate(
    ({ scopeSelector, min }) => {
      const problems: { kind: 'overflow' | 'touch' | 'offscreen' | 'overlap'; detail: string }[] = [];
      const doc = document.documentElement;
      const vw = doc.clientWidth;
      if (doc.scrollWidth > vw || document.body.scrollWidth > vw) {
        problems.push({ kind: 'overflow', detail: `scrollWidth ${doc.scrollWidth}/${document.body.scrollWidth} > ${vw}` });
      }

      const scope: ParentNode = scopeSelector ? (document.querySelector(scopeSelector) ?? document) : document;
      const selector = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]';
      const describe = (el: Element) => {
        const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40);
        return `<${el.tagName.toLowerCase()}${el.className ? ` class="${String(el.className)}"` : ''}> "${text}"`;
      };
      const visible = Array.from(scope.querySelectorAll(selector)).filter((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      });

      for (const el of visible) {
        const r = el.getBoundingClientRect();
        if (r.width < min - 0.5 || r.height < min - 0.5) {
          problems.push({ kind: 'touch', detail: `${describe(el)} ${r.width.toFixed(1)}×${r.height.toFixed(1)}` });
        }
        if (r.left < -0.5 || r.right > vw + 0.5) {
          problems.push({ kind: 'offscreen', detail: `${describe(el)} left=${r.left.toFixed(1)} right=${r.right.toFixed(1)} vw=${vw}` });
        }
      }

      // Tumpang tindih: bandingkan elemen dalam kelompok yang sama (nav vs konten).
      const groups = new Map<string, Element[]>();
      for (const el of visible) {
        const key = el.closest('nav') ? 'nav' : 'content';
        groups.set(key, [...(groups.get(key) ?? []), el]);
      }
      for (const els of groups.values()) {
        for (let i = 0; i < els.length; i++) {
          for (let j = i + 1; j < els.length; j++) {
            const a = els[i]!;
            const b = els[j]!;
            if (a.contains(b) || b.contains(a)) continue;
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
            const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
            if (ox > 1 && oy > 1) problems.push({ kind: 'overlap', detail: `${describe(a)} ⟷ ${describe(b)}` });
          }
        }
      }
      return problems;
    },
    { scopeSelector, min: 44 },
  );
}

/** Menegaskan tidak ada masalah tata letak, dengan pesan yang mudah dibaca. */
export async function expectCleanLayout(page: Page, label: string, scopeSelector?: string): Promise<void> {
  const problems = await layoutProblems(page, scopeSelector);
  expect(problems, `${label}:\n${problems.map((p) => `  [${p.kind}] ${p.detail}`).join('\n')}`).toEqual([]);
}

/** Dialog modal yang sedang terbuka. */
export function openDialog(page: Page): Locator {
  return page.locator('dialog[open]');
}
