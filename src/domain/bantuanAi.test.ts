import { describe, expect, it } from 'vitest';
import { buildPromptTcm, chatGptUrl, keIsianForm, parseJawabanAi } from './bantuanAi';

const JAWABAN_STANDAR = [
  'SYSTEM TUBUH YANG TERDAMPAK: Sistem saraf dan meridian kepala',
  'POLA GANGGUAN (DEFISIENSI, STAGNASI, PANAS, DINGIN, LEMBAB): Panas',
  'POLA TCM: Hiperaktivitas Yang Hati',
  'MEKANISME: Yin Hati lemah sehingga Yang naik ke kepala.',
  'PRINSIP TERAPI: Menenangkan Yang Hati dan menutrisi Yin',
].join('\n');

describe('buildPromptTcm & chatGptUrl', () => {
  it('memuat keluhan (spasi dirapikan), instruksi, dan format 5 baris', () => {
    const p = buildPromptTcm('  nyeri   kepala\nsering pusing ');
    expect(p).toContain('Keluhan pasien: "nyeri kepala sering pusing"');
    expect(p).toContain(
      'Berdasarkan keluhan tersebut, tentukan secara singkat diagnosa TCM, pola (sindrom) yang kemungkinan terjadi, dan prinsip terapinya.',
    );
    expect(p).toContain('maksimal 2 kalimat per bagian, TANPA teks lain, persis dengan format 5 baris berikut:');
    expect(p.split('\n').slice(-5)).toEqual([
      'SYSTEM TUBUH YANG TERDAMPAK: ...',
      'POLA GANGGUAN (DEFISIENSI, STAGNASI, PANAS, DINGIN, LEMBAB): ...',
      'POLA TCM: ...',
      'MEKANISME: ...',
      'PRINSIP TERAPI: ...',
    ]);
  });

  it('tautan ChatGPT meng-encode prompt pada parameter q', () => {
    const url = chatGptUrl('a & b?');
    expect(url).toBe('https://chatgpt.com/?q=a%20%26%20b%3F');
    expect(new URL(url).searchParams.get('q')).toBe('a & b?');
  });
});

describe('parseJawabanAi', () => {
  it('mengurai format 5 baris standar', () => {
    expect(parseJawabanAi(JAWABAN_STANDAR)).toEqual({
      sistemTubuh: 'Sistem saraf dan meridian kepala',
      polaGangguan: 'Panas',
      polaTcm: 'Hiperaktivitas Yang Hati',
      mekanisme: 'Yin Hati lemah sehingga Yang naik ke kepala.',
      prinsipTerapi: 'Menenangkan Yang Hati dan menutrisi Yin',
    });
  });

  it('toleran terhadap spasi sebelum titik dua, markdown, nomor, label tanpa kurung, dan isi multi-baris', () => {
    const r = parseJawabanAi(
      [
        '1. **System tubuh yang terdampak :** Sendi lutut',
        '2. **Pola gangguan** - Stagnasi, Dingin',
        '3. Pola TCM : Bi Zheng dingin-lembap',
        '- Mekanisme: Dingin-lembap menyumbat meridian',
        'sehingga Qi dan darah tidak lancar',
        '- Prinsip terapi: Menghangatkan meridian, mengusir lembap',
      ].join('\n'),
    );
    expect(r).toEqual({
      sistemTubuh: 'Sendi lutut',
      polaGangguan: 'Stagnasi, Dingin',
      polaTcm: 'Bi Zheng dingin-lembap',
      mekanisme: 'Dingin-lembap menyumbat meridian sehingga Qi dan darah tidak lancar',
      prinsipTerapi: 'Menghangatkan meridian, mengusir lembap',
    });
  });

  it('mengembalikan null untuk teks tanpa label atau template prompt', () => {
    expect(parseJawabanAi('Halo, ada yang bisa dibantu?')).toBeNull();
    expect(parseJawabanAi('')).toBeNull();
    expect(parseJawabanAi(buildPromptTcm('nyeri lutut'))).toBeNull();
  });
});

describe('keIsianForm', () => {
  it('Diagnosa = 4 bagian per baris; Terapi = prinsip terapi', () => {
    expect(keIsianForm(parseJawabanAi(JAWABAN_STANDAR)!)).toEqual({
      polaPenyakit: [
        'System tubuh yang terdampak: Sistem saraf dan meridian kepala',
        'Pola gangguan: Panas',
        'Pola TCM: Hiperaktivitas Yang Hati',
        'Mekanisme: Yin Hati lemah sehingga Yang naik ke kepala.',
      ].join('\n'),
      terapi: 'Prinsip terapi: Menenangkan Yang Hati dan menutrisi Yin',
    });
  });

  it('bagian kosong tidak menghasilkan label menggantung', () => {
    expect(
      keIsianForm({ sistemTubuh: '', polaGangguan: 'Defisiensi', polaTcm: '', mekanisme: '', prinsipTerapi: '' }),
    ).toEqual({ polaPenyakit: 'Pola gangguan: Defisiensi', terapi: '' });
  });
});
