import { afterEach, describe, expect, it, vi } from 'vitest';
import { LOKASI_UNDUHAN, WebFileGateway, createFileGateway, AndroidFileGateway, uriKePath } from './fileGateway';

afterEach(() => {
  vi.restoreAllMocks();
});

function lastFileInput(): HTMLInputElement {
  const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
  return inputs[inputs.length - 1]!;
}

describe('WebFileGateway', () => {
  it('saveText memicu unduhan dengan nama file dan isi yang benar', async () => {
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:test';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    let downloaded = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });

    const res = await new WebFileGateway().saveText('datapasien-cadangan-20250105-0930.json', '{"a":1}');

    expect(res).toEqual({ location: LOKASI_UNDUHAN });
    expect(downloaded).toBe('datapasien-cadangan-20250105-0930.json');
    expect(await blob!.text()).toBe('{"a":1}');
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('pickTextFile mengembalikan isi file terpilih', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const p = new WebFileGateway().pickTextFile();
    const input = lastFileInput();
    expect(input.accept).toBe('.json,application/json');
    const file = new File(['{"x":"é"}'], 'c.json', { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await expect(p).resolves.toBe('{"x":"é"}');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('pickTextFile mengembalikan null saat dibatalkan (event cancel)', async () => {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const p = new WebFileGateway().pickTextFile();
    lastFileInput().dispatchEvent(new Event('cancel'));
    await expect(p).resolves.toBeNull();
  });
});

describe('createFileGateway', () => {
  it('memilih implementasi sesuai platform', () => {
    expect(createFileGateway(false)).toBeInstanceOf(WebFileGateway);
    expect(createFileGateway(true)).toBeInstanceOf(AndroidFileGateway);
    expect(createFileGateway()).toBeInstanceOf(WebFileGateway); // jsdom bukan native
  });

  it('uriKePath mengubah URI file menjadi path', () => {
    expect(uriKePath('file:///storage/emulated/0/Documents/a%20b.json')).toBe(
      '/storage/emulated/0/Documents/a b.json',
    );
    expect(uriKePath('/data/x.json')).toBe('/data/x.json');
  });
});
