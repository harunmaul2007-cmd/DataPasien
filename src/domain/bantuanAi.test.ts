import { describe, expect, it } from 'vitest';
import { buildPromptTcm, chatGptUrl, keIsianForm, parseJawabanAi } from './bantuanAi';

const JAWABAN_STANDAR = [
  'SYSTEM FISIOLOGI TUBUH YANG TERDAMPAK (SISTEM SARAF, PENCERNAAN, RESPIRASI, METABOLIK, MUSKULOSKELETAL): Sistem saraf',
  'POLA GANGGUAN (DEFISIENSI, STAGNASI, PANAS, DINGIN, LEMBAB): Panas',
  'POLA TCM: Hiperaktivitas Yang Hati',
  'MEKANISME (SECARA TCM): Yin Hati lemah sehingga Yang naik ke kepala.',
  'MEKANISME (SECARA MEDIS BARAT): Ketegangan otot dan vasodilatasi pembuluh darah kepala.',
  'PRINSIP TERAPI: Menenangkan Yang Hati dan menutrisi Yin',
].join('\n');

describe('buildPromptTcm & chatGptUrl', () => {
  it('memuat keluhan (spasi dirapikan), instruksi, dan format 6 baris', () => {
    const p = buildPromptTcm('  nyeri   kepala\nsering pusing ');
    expect(p).toContain('Keluhan pasien: "nyeri kepala sering pusing"');
    expect(p).toContain(
      'Berdasarkan keluhan tersebut, tentukan secara singkat diagnosa TCM, pola (sindrom) yang kemungkinan terjadi, dan prinsip terapinya.',
    );
    expect(p).toContain('maksimal 2 kalimat per bagian, TANPA teks lain, persis dengan format 6 baris berikut:');
    expect(p.split('\n').slice(-6)).toEqual([
      'SYSTEM FISIOLOGI TUBUH YANG TERDAMPAK (SISTEM SARAF, PENCERNAAN, RESPIRASI, METABOLIK, MUSKULOSKELETAL): ...',
      'POLA GANGGUAN (DEFISIENSI, STAGNASI, PANAS, DINGIN, LEMBAB): ...',
      'POLA TCM: ...',
      'MEKANISME (SECARA TCM): ...',
      'MEKANISME (SECARA MEDIS BARAT): ...',
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
  it('mengurai format 6 baris standar; dua mekanisme dibedakan', () => {
    expect(parseJawabanAi(JAWABAN_STANDAR)).toEqual({
      sistemTubuh: 'Sistem saraf',
      polaGangguan: 'Panas',
      polaTcm: 'Hiperaktivitas Yang Hati',
      mekanismeTcm: 'Yin Hati lemah sehingga Yang naik ke kepala.',
      mekanismeBarat: 'Ketegangan otot dan vasodilatasi pembuluh darah kepala.',
      prinsipTerapi: 'Menenangkan Yang Hati dan menutrisi Yin',
    });
  });

  it('toleran terhadap spasi sebelum titik dua, markdown, nomor, label tanpa kurung, dan isi multi-baris', () => {
    const r = parseJawabanAi(
      [
        '1. **System fisiologi tubuh yang terdampak :** Muskuloskeletal',
        '2. **Pola gangguan** - Stagnasi, Dingin',
        '3. Pola TCM : Bi Zheng dingin-lembap',
        '- Mekanisme secara TCM: Dingin-lembap menyumbat meridian',
        'sehingga Qi dan darah tidak lancar',
        '- Mekanisme medis Barat: Peradangan sendi',
        '- Prinsip terapi: Menghangatkan meridian, mengusir lembap',
      ].join('\n'),
    );
    expect(r).toEqual({
      sistemTubuh: 'Muskuloskeletal',
      polaGangguan: 'Stagnasi, Dingin',
      polaTcm: 'Bi Zheng dingin-lembap',
      mekanismeTcm: 'Dingin-lembap menyumbat meridian sehingga Qi dan darah tidak lancar',
      mekanismeBarat: 'Peradangan sendi',
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
  it('Diagnosa = 5 bagian per baris; Terapi = prinsip terapi', () => {
    expect(keIsianForm(parseJawabanAi(JAWABAN_STANDAR)!)).toEqual({
      polaPenyakit: [
        'System fisiologi tubuh yang terdampak: Sistem saraf',
        'Pola gangguan: Panas',
        'Pola TCM: Hiperaktivitas Yang Hati',
        'Mekanisme (TCM): Yin Hati lemah sehingga Yang naik ke kepala.',
        'Mekanisme (medis Barat): Ketegangan otot dan vasodilatasi pembuluh darah kepala.',
      ].join('\n'),
      terapi: 'Prinsip terapi: Menenangkan Yang Hati dan menutrisi Yin',
    });
  });

  it('bagian kosong tidak menghasilkan label menggantung', () => {
    expect(
      keIsianForm({
        sistemTubuh: '',
        polaGangguan: 'Defisiensi',
        polaTcm: '',
        mekanismeTcm: '',
        mekanismeBarat: '',
        prinsipTerapi: '',
      }),
    ).toEqual({ polaPenyakit: 'Pola gangguan: Defisiensi', terapi: '' });
  });
});
