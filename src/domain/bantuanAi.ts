// Bantuan AI untuk kolom Diagnosa: menyusun prompt TCM, tautan ChatGPT, dan
// mengurai jawaban AI menjadi isian Diagnosa & Terapi.
//
// Privasi: prompt HANYA memuat teks keluhan; nama, alamat, dan no HP pasien
// tidak pernah disertakan.

export const CHATGPT_BASE_URL = 'https://chatgpt.com/';

/** Penanda baris yang diminta pada format jawaban AI (6 baris). */
export const LABEL_SISTEM =
  'SYSTEM FISIOLOGI TUBUH YANG TERDAMPAK (SISTEM SARAF, PENCERNAAN, RESPIRASI, METABOLIK, MUSKULOSKELETAL)';
export const LABEL_POLA_GANGGUAN = 'POLA GANGGUAN (DEFISIENSI, STAGNASI, PANAS, DINGIN, LEMBAB)';
export const LABEL_POLA_TCM = 'POLA TCM';
export const LABEL_MEKANISME_TCM = 'MEKANISME (SECARA TCM)';
export const LABEL_MEKANISME_BARAT = 'MEKANISME (SECARA MEDIS BARAT)';
export const LABEL_PRINSIP = 'PRINSIP TERAPI';

export interface JawabanAi {
  sistemTubuh: string;
  polaGangguan: string;
  polaTcm: string;
  mekanismeTcm: string;
  mekanismeBarat: string;
  prinsipTerapi: string;
}

const KOSONG: JawabanAi = {
  sistemTubuh: '',
  polaGangguan: '',
  polaTcm: '',
  mekanismeTcm: '',
  mekanismeBarat: '',
  prinsipTerapi: '',
};

/** Susun prompt singkat berformat tetap agar jawaban mudah diurai. */
export function buildPromptTcm(keluhan: string): string {
  const k = keluhan.trim().replace(/\s+/g, ' ');
  return [
    'Anda asisten praktisi Traditional Chinese Medicine (TCM).',
    `Keluhan pasien: "${k}".`,
    'Berdasarkan keluhan tersebut, tentukan secara singkat diagnosa TCM, pola (sindrom) yang kemungkinan terjadi, dan prinsip terapinya.',
    'Jawab dalam Bahasa Indonesia, maksimal 2 kalimat per bagian, TANPA teks lain, persis dengan format 6 baris berikut:',
    `${LABEL_SISTEM}: ...`,
    `${LABEL_POLA_GANGGUAN}: ...`,
    `${LABEL_POLA_TCM}: ...`,
    `${LABEL_MEKANISME_TCM}: ...`,
    `${LABEL_MEKANISME_BARAT}: ...`,
    `${LABEL_PRINSIP}: ...`,
  ].join('\n');
}

/** Tautan ChatGPT dengan prompt terisi (parameter `q`). */
export function chatGptUrl(prompt: string): string {
  return `${CHATGPT_BASE_URL}?q=${encodeURIComponent(prompt)}`;
}

// Dicocokkan terhadap label lengkap (termasuk keterangan dalam kurung).
// Urutan penting: label yang lebih spesifik diperiksa lebih dulu.
const LABELS: ReadonlyArray<{ key: keyof JawabanAi; re: RegExp }> = [
  // "SYSTEM FISIOLOGI TUBUH YANG TERDAMPAK (…)", "Sistem tubuh", "Organ yang terdampak", dst.
  { key: 'sistemTubuh', re: /^(?:system|sistem)\b|^organ\b/i },
  { key: 'polaGangguan', re: /^pola\s+gangguan\b/i },
  // "POLA TCM", juga "Pola", "Pola yang kemungkinan terjadi", "Sindrom".
  { key: 'polaTcm', re: /^(?:pola|sindrom)\b/i },
  // "MEKANISME (SECARA MEDIS BARAT)", "Mekanisme medis", "Mekanisme kedokteran modern".
  { key: 'mekanismeBarat', re: /^mekanisme\b.*\b(?:barat|medis|modern|kedokteran)\b/i },
  // "MEKANISME (SECARA TCM)", juga "Mekanisme" saja.
  { key: 'mekanismeTcm', re: /^mekanisme\b/i },
  { key: 'prinsipTerapi', re: /^prinsip(?:\s+terapi)?\b/i },
];

/** Bersihkan markdown umum (tebal, heading, nomor/bullet) dari awal baris. */
function bersihkanBaris(line: string): string {
  return line
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*(?:#{1,6}\s*|[-*•]\s+|\d+[.)]\s+)/, '')
    .trim();
}

/**
 * Pisahkan "LABEL : isi". Pemisah utama titik dua pertama di luar kurung; bila
 * tidak ada, tanda pisah yang diapit spasi (" - ").
 */
function pisahLabel(line: string): { label: string; isi: string } | null {
  const m = /^((?:[^:：(]|\([^)]*\)){2,160}?)\s*[:：]\s*(.*)$/.exec(line) ?? /^(.{2,160}?)\s+[-–]\s+(.*)$/.exec(line);
  if (!m) return null;
  return { label: m[1]!.replace(/\s+/g, ' ').trim(), isi: m[2]!.trim() };
}

/**
 * Urai jawaban AI. Mengembalikan null jika tidak ada satu pun bagian yang dikenali
 * atau teks adalah template prompt itu sendiri (berisi "..." saja).
 * Isi bagian boleh berlanjut ke baris berikutnya hingga label berikutnya.
 */
export function parseJawabanAi(text: string): JawabanAi | null {
  const hasil: JawabanAi = { ...KOSONG };
  let aktif: keyof JawabanAi | null = null;
  let dikenali = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = bersihkanBaris(raw);
    if (line === '') continue;
    const bagian = pisahLabel(line);
    const label = bagian ? LABELS.find((l) => l.re.test(bagian.label)) : undefined;
    if (bagian && label) {
      aktif = label.key;
      dikenali = true;
      hasil[aktif] = bagian.isi;
    } else if (aktif) {
      hasil[aktif] = `${hasil[aktif]} ${line}`.trim();
    }
  }

  if (!dikenali) return null;
  if (Object.values(hasil).every((s) => s.replace(/[.…\s]/g, '') === '')) return null;
  return hasil;
}

/**
 * Petakan jawaban ke isian formulir sesi:
 * Diagnosa = sistem tubuh, pola gangguan, pola TCM, mekanisme TCM, mekanisme
 * medis Barat (satu per baris); Terapi = prinsip terapi. Bagian kosong dilewati.
 */
export function keIsianForm(j: JawabanAi): { polaPenyakit: string; terapi: string } {
  const diagnosa = [
    ['System fisiologi tubuh yang terdampak', j.sistemTubuh],
    ['Pola gangguan', j.polaGangguan],
    ['Pola TCM', j.polaTcm],
    ['Mekanisme (TCM)', j.mekanismeTcm],
    ['Mekanisme (medis Barat)', j.mekanismeBarat],
  ]
    .filter(([, isi]) => isi)
    .map(([label, isi]) => `${label}: ${isi}`)
    .join('\n');
  return { polaPenyakit: diagnosa, terapi: j.prinsipTerapi ? `Prinsip terapi: ${j.prinsipTerapi}` : '' };
}
