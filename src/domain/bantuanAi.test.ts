import { describe, expect, it } from 'vitest';
import { buildPromptTcm, chatGptUrl, keIsianForm, parseJawabanAi } from './bantuanAi';

describe('buildPromptTcm & chatGptUrl', () => {
  it('memuat keluhan (spasi dirapikan) dan format 3 baris', () => {
    const p = buildPromptTcm('  nyeri   kepala\nsering pusing ');
    expect(p).toContain('Keluhan pasien: "nyeri kepala sering pusing"');
    expect(p).toContain('DIAGNOSA TCM: ...');
    expect(p).toContain('POLA: ...');
    expect(p).toContain('PRINSIP TERAPI: ...');
  });

  it('tautan ChatGPT meng-encode prompt pada parameter q', () => {
    const url = chatGptUrl('a & b?');
    expect(url).toBe('https://chatgpt.com/?q=a%20%26%20b%3F');
    expect(new URL(url).searchParams.get('q')).toBe('a & b?');
  });
});

describe('parseJawabanAi', () => {
  it('mengurai format standar', () => {
    const r = parseJawabanAi(
      'DIAGNOSA TCM: Tou Tong (sakit kepala)\nPOLA: Hiperaktivitas Yang Hati\nPRINSIP TERAPI: Menenangkan Yang Hati',
    );
    expect(r).toEqual({
      diagnosa: 'Tou Tong (sakit kepala)',
      pola: 'Hiperaktivitas Yang Hati',
      prinsipTerapi: 'Menenangkan Yang Hati',
    });
  });

  it('toleran terhadap markdown, nomor, variasi label, dan isi multi-baris', () => {
    const r = parseJawabanAi(
      [
        '1. **Diagnosa TCM:** Bi Zheng',
        '2. **Pola yang kemungkinan terjadi** - Stagnasi Qi dan darah',
        'akibat dingin-lembap',
        '- Prinsip terapi: Melancarkan Qi, mengaktifkan darah',
      ].join('\n'),
    );
    expect(r).toEqual({
      diagnosa: 'Bi Zheng',
      pola: 'Stagnasi Qi dan darah akibat dingin-lembap',
      prinsipTerapi: 'Melancarkan Qi, mengaktifkan darah',
    });
  });

  it('mengembalikan null untuk teks tanpa label atau template prompt', () => {
    expect(parseJawabanAi('Halo, ada yang bisa dibantu?')).toBeNull();
    expect(parseJawabanAi('')).toBeNull();
    expect(parseJawabanAi(buildPromptTcm('nyeri lutut'))).toBeNull();
  });
});

describe('keIsianForm', () => {
  it('Diagnosa = diagnosa + pola; Terapi = prinsip terapi', () => {
    expect(keIsianForm({ diagnosa: 'Bi Zheng', pola: 'Dingin-lembap', prinsipTerapi: 'Menghangatkan meridian' })).toEqual({
      polaPenyakit: 'Bi Zheng\nPola: Dingin-lembap',
      terapi: 'Prinsip terapi: Menghangatkan meridian',
    });
  });

  it('bagian kosong tidak menghasilkan label menggantung', () => {
    expect(keIsianForm({ diagnosa: 'Bi Zheng', pola: '', prinsipTerapi: '' })).toEqual({
      polaPenyakit: 'Bi Zheng',
      terapi: '',
    });
  });
});
