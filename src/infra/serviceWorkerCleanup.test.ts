import { describe, expect, it, vi } from 'vitest';
import { bersihkanServiceWorker, type SwCleanupEnv } from './serviceWorkerCleanup';

function memStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

function env(opts: { regs?: number; cacheKeys?: string[]; controlled?: boolean } = {}) {
  const regs = Array.from({ length: opts.regs ?? 0 }, () => ({ unregister: vi.fn(async () => true) }));
  const e = {
    serviceWorker: {
      getRegistrations: vi.fn(async () => regs as unknown as ServiceWorkerRegistration[]),
      controller: (opts.controlled ? {} : null) as ServiceWorker | null,
    },
    caches: {
      keys: vi.fn(async () => opts.cacheKeys ?? []),
      delete: vi.fn(async () => true),
    },
    reload: vi.fn(),
    session: memStorage(),
  } satisfies SwCleanupEnv;
  return { e, regs };
}

describe('bersihkanServiceWorker', () => {
  it('melepas seluruh SW, menghapus cache, dan memuat ulang sekali bila halaman dikendalikan SW', async () => {
    const { e, regs } = env({ regs: 2, cacheKeys: ['workbox-precache-v2'], controlled: true });

    expect(await bersihkanServiceWorker(e)).toBe(true);
    expect(regs.every((r) => r.unregister.mock.calls.length === 1)).toBe(true);
    expect(e.caches.delete).toHaveBeenCalledWith('workbox-precache-v2');
    expect(e.reload).toHaveBeenCalledTimes(1);

    // Pemanggilan kedua dalam sesi yang sama tidak memuat ulang lagi (tanpa loop).
    await bersihkanServiceWorker(e);
    expect(e.reload).toHaveBeenCalledTimes(1);
  });

  it('tanpa SW/cache: tidak melakukan apa-apa dan tidak memuat ulang', async () => {
    const { e } = env();
    expect(await bersihkanServiceWorker(e)).toBe(false);
    expect(e.reload).not.toHaveBeenCalled();
  });

  it('API tidak tersedia atau gagal: tidak melempar', async () => {
    await expect(bersihkanServiceWorker({ reload: vi.fn() })).resolves.toBe(false);
    const { e } = env();
    e.serviceWorker.getRegistrations.mockRejectedValueOnce(new Error('tidak didukung'));
    await expect(bersihkanServiceWorker(e)).resolves.toBe(false);
  });
});
