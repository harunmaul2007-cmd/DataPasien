import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sembunyikanSplash } from './splash';

let t = 0;
const now = () => t;

beforeEach(() => {
  vi.useFakeTimers();
  t = 0;
  document.body.innerHTML = '<div id="splash"></div><div id="root"></div>';
});

afterEach(() => {
  vi.useRealTimers();
});

const splash = () => document.getElementById('splash');

describe('sembunyikanSplash', () => {
  it('menunggu data siap DAN durasi minimum, lalu memudar dan dihapus', async () => {
    let selesai!: () => void;
    const siap = new Promise<void>((r) => (selesai = r));
    const p = sembunyikanSplash({ siap, minimumMs: 1000, fadeMs: 300, mulai: 0, now });

    await vi.advanceTimersByTimeAsync(2000);
    expect(splash()).not.toBeNull(); // data belum siap
    expect(splash()!.classList.contains('splash--keluar')).toBe(false);

    t = 2000; // data siap setelah minimum terlewati → langsung memudar
    selesai();
    await vi.advanceTimersByTimeAsync(0);
    expect(splash()!.classList.contains('splash--keluar')).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    await p;
    expect(splash()).toBeNull();
  });

  it('data cepat siap: tetap tampil sampai durasi minimum', async () => {
    t = 200;
    const p = sembunyikanSplash({ siap: Promise.resolve(), minimumMs: 1000, fadeMs: 300, mulai: 0, now });

    await vi.advanceTimersByTimeAsync(700);
    expect(splash()!.classList.contains('splash--keluar')).toBe(false);
    await vi.advanceTimersByTimeAsync(100); // 800 ms sisa minimum terlewati
    expect(splash()!.classList.contains('splash--keluar')).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    await p;
    expect(splash()).toBeNull();
  });

  it('gagal memuat tetap melepas splash; tanpa elemen splash tidak melempar', async () => {
    t = 5000;
    const p = sembunyikanSplash({ siap: Promise.reject(new Error('db')), fadeMs: 300, mulai: 0, now });
    await vi.advanceTimersByTimeAsync(300);
    await p;
    expect(splash()).toBeNull();

    await expect(sembunyikanSplash({ siap: Promise.resolve(), now })).resolves.toBeUndefined();
  });
});
