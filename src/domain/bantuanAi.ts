// Bantuan AI untuk kolom Diagnosa: menyusun prompt TCM, tautan ChatGPT, dan
// mengurai jawaban AI menjadi isian Diagnosa & Terapi.
//
// Privasi: prompt HANYA memuat teks keluhan; nama, alamat, dan no HP pasien
// tidak pernah disertakan.

export const CHATGPT_BASE_URL = 'https://chatgpt.com/';

/** Penanda baris yang diminta pada format jawaban AI. */
export const LABEL_DIAGNOSA = 'DIAGNOSA TCM';
export const LABEL_POLA = 'POLA';
export const LABEL_PRINSIP = 'PRINSIP TERAPI';

export interface JawabanAi {
  diagnosa: string;
  pola: string;
  prinsipTerapi: string;
}

/** Susun prompt singkat berformat tetap agar jawaban mudah diurai. */
export function buildPromptTcm(keluhan: string): string {
  const k = keluhan.trim().replace(/\s+/g, ' ');
  return [
    'Anda asisten praktisi Traditional Chinese Medicine (TCM).',
    `Keluhan pasien: "${k}".`,
    'Berdasarkan keluhan tersebut, tentukan secara singkat diagnosa TCM, pola (sindrom) yang kemungkinan terjadi, dan prinsip terapinya.',
    'Jawab dalam Bahasa Indonesia, maksimal 2 kalimat per bagian, TANPA teks lain, persis dengan format 3 baris berikut:',
    `${LABEL_DIAGNOSA}: ...`,
    `${LABEL_POLA}: ...`,
    `${LABEL_PRINSIP}: ...`,
  ].join('\n');
}

/** Tautan ChatGPT dengan prompt terisi (parameter `q`). */
export function chatGptUrl(prompt: string): string {
  return `${CHATGPT_BASE_URL}?q=${encodeURIComponent(prompt)}`;
}

const LABELS: ReadonlyArray<{ key: keyof JawabanAi; re: RegExp }> = [
  // "DIAGNOSA TCM", "Diagnosa", "**Diagnosa TCM:**", "1. Diagnosa TCM -", dst.
  { key: 'diagnosa', re: /^diagnosa(?:\s+tcm)?$/i },
  // "POLA", "Pola yang kemungkinan terjadi", "Sindrom", dst.
  { key: 'pola', re: /^(?:pola|sindrom)\b/i },
  { key: 'prinsipTerapi', re: /^prinsip(?:\s+terapi)?$/i },
];

/** Bersihkan markdown umum (tebal, heading, nomor/bullet) dari awal baris. */
function bersihkanBaris(line: string): string {
  return line
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*(?:#{1,6}\s*|[-*•]\s+|\d+[.)]\s+)/, '')
    .trim();
}

/**
 * Urai jawaban AI. Mengembalikan null jika tidak ada satu pun bagian yang dikenali
 * atau teks adalah template prompt itu sendiri (berisi "..." saja).
 * Isi bagian boleh berlanjut ke baris berikutnya hingga label berikutnya.
 */
export function parseJawabanAi(text: string): JawabanAi | null {
  const hasil: JawabanAi = { diagnosa: '', pola: '', prinsipTerapi: '' };
  let aktif: keyof JawabanAi | null = null;
  let dikenali = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = bersihkanBaris(raw);
    if (line === '') continue;
    const m = /^([^:：\-–]{2,40}?)\s*[:：\-–]\s*(.*)$/.exec(line);
    const label = m ? LABELS.find((l) => l.re.test(m[1]!.trim())) : undefined;
    if (m && label) {
      aktif = label.key;
      dikenali = true;
      hasil[aktif] = m[2]!.trim();
    } else if (aktif) {
      hasil[aktif] = `${hasil[aktif]} ${line}`.trim();
    }
  }

  if (!dikenali) return null;
  const isi = [hasil.diagnosa, hasil.pola, hasil.prinsipTerapi].map((s) => s.replace(/[.…\s]/g, ''));
  if (isi.every((s) => s === '')) return null;
  return hasil;
}

/** Petakan jawaban ke isian formulir sesi: Diagnosa = diagnosa + pola; Terapi = prinsip terapi. */
export function keIsianForm(j: JawabanAi): { polaPenyakit: string; terapi: string } {
  const diagnosa = [j.diagnosa, j.pola ? `Pola: ${j.pola}` : ''].filter(Boolean).join('\n');
  return { polaPenyakit: diagnosa, terapi: j.prinsipTerapi ? `Prinsip terapi: ${j.prinsipTerapi}` : '' };
}
