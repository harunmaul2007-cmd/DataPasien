#!/usr/bin/env node
// Cek prasyarat Proses_Build Android (Req 13.5): Node >= 22, JDK >= 21, ANDROID_HOME.
//
// Logika inti (parse versi dan evaluasi prasyarat) diekspor sebagai fungsi murni
// agar dapat diuji tanpa JDK/Android SDK terpasang. Bagian yang menyentuh sistem
// (menjalankan `java -version`, membaca env) dipisah di `collectPrereqInfo`.
//
// Pemakaian langsung: `node scripts/check-prereq.mjs` -> kode keluar 0 bila lolos,
// 1 bila gagal (mencetak `Langkah gagal: Cek prasyarat` beserta rinciannya).

import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIN_NODE_MAJOR = 22;
export const MIN_JDK_MAJOR = 21;
export const PREREQ_STEP_NAME = 'Cek prasyarat';

/**
 * Ambil versi mayor dari string versi Node (mis. "v22.11.0" atau "22.11.0").
 * @param {string | null | undefined} version
 * @returns {number | null}
 */
export function parseNodeMajor(version) {
  if (typeof version !== 'string') return null;
  const m = /^v?(\d+)(?:\.\d+)*/.exec(version.trim());
  return m ? Number(m[1]) : null;
}

/**
 * Ambil versi mayor JDK dari keluaran `java -version`.
 * Mendukung skema lama ("1.8.0_311" -> 8) dan baru ("21.0.2", "21", "17-ea").
 * @param {string | null | undefined} output
 * @returns {number | null}
 */
export function parseJavaMajor(output) {
  if (typeof output !== 'string') return null;
  const m = /version\s+"([^"]+)"/i.exec(output) ?? /^(?:openjdk|java)\s+(\d[\w.\-+]*)/im.exec(output);
  if (!m) return null;
  const parts = m[1].split(/[.\-_+]/);
  const first = Number(parts[0]);
  if (!Number.isInteger(first)) return null;
  if (first === 1 && parts.length > 1) {
    const second = Number(parts[1]);
    return Number.isInteger(second) ? second : null;
  }
  return first;
}

/**
 * Evaluasi prasyarat secara murni.
 * @param {{
 *   nodeVersion: string | null | undefined,
 *   javaVersionOutput: string | null | undefined,
 *   androidHome: string | null | undefined,
 *   androidHomeExists?: boolean,
 * }} info
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function checkPrerequisites(info) {
  const errors = [];

  const nodeMajor = parseNodeMajor(info.nodeVersion);
  if (nodeMajor === null) {
    errors.push(`Versi Node.js tidak dapat dikenali (dibutuhkan >= ${MIN_NODE_MAJOR}).`);
  } else if (nodeMajor < MIN_NODE_MAJOR) {
    errors.push(`Node.js ${info.nodeVersion} terlalu lama; dibutuhkan versi >= ${MIN_NODE_MAJOR}.`);
  }

  if (info.javaVersionOutput == null || info.javaVersionOutput.trim() === '') {
    errors.push(`JDK tidak ditemukan; pasang JDK >= ${MIN_JDK_MAJOR} dan atur JAVA_HOME atau PATH.`);
  } else {
    const jdkMajor = parseJavaMajor(info.javaVersionOutput);
    if (jdkMajor === null) {
      errors.push(`Versi JDK tidak dapat dikenali (dibutuhkan >= ${MIN_JDK_MAJOR}).`);
    } else if (jdkMajor < MIN_JDK_MAJOR) {
      errors.push(`JDK ${jdkMajor} terlalu lama; dibutuhkan versi >= ${MIN_JDK_MAJOR}.`);
    }
  }

  if (info.androidHome == null || info.androidHome.trim() === '') {
    errors.push('ANDROID_HOME belum diatur; arahkan ke direktori Android SDK.');
  } else if (info.androidHomeExists === false) {
    errors.push(`ANDROID_HOME menunjuk ke direktori yang tidak ada: ${info.androidHome}`);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Jalankan `java -version` (memakai JAVA_HOME bila diatur) dan kembalikan keluarannya,
 * atau null bila java tidak dapat dijalankan.
 * @param {NodeJS.ProcessEnv} env
 * @returns {string | null}
 */
export function readJavaVersionOutput(env = process.env) {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java';
  const candidates = [];
  if (env.JAVA_HOME && env.JAVA_HOME.trim() !== '') {
    candidates.push(path.join(env.JAVA_HOME.trim(), 'bin', exe));
  }
  candidates.push('java');
  for (const cmd of candidates) {
    const r = spawnSync(cmd, ['-version'], { encoding: 'utf8', env, windowsHide: true });
    if (r.error || r.status !== 0) continue;
    // `java -version` menulis ke stderr.
    const out = `${r.stderr ?? ''}${r.stdout ?? ''}`;
    if (out.trim() !== '') return out;
  }
  return null;
}

/**
 * Baca variabel lingkungan dari registry Windows HKCU\Environment bila belum ada di process.env.
 * @param {string} varName
 * @returns {string | null}
 */
export function queryRegistryEnv(varName) {
  if (process.platform !== 'win32') return null;
  try {
    const r = spawnSync('reg', ['query', 'HKCU\\Environment', '/v', varName], { encoding: 'utf8', windowsHide: true });
    if (r.status === 0 && r.stdout) {
      const match = new RegExp(`${varName}\\s+REG_\\w+\\s+(.+)`, 'i').exec(r.stdout);
      if (match) return match[1].trim();
    }
  } catch {
    // abaikan kesalahan reg query
  }
  return null;
}

/**
 * Lengkapi env dengan nilai dari registry (Windows) bila JAVA_HOME / ANDROID_HOME kosong.
 * @param {NodeJS.ProcessEnv} env
 * @returns {NodeJS.ProcessEnv}
 */
export function enrichSystemEnv(env = process.env) {
  if (process.platform !== 'win32') return env;
  if (!env.JAVA_HOME) {
    const regJava = queryRegistryEnv('JAVA_HOME');
    if (regJava) env.JAVA_HOME = regJava;
  }
  if (!env.ANDROID_HOME) {
    const regAndroid = queryRegistryEnv('ANDROID_HOME');
    if (regAndroid) env.ANDROID_HOME = regAndroid;
  }
  if (env.JAVA_HOME && (!env.PATH || !env.PATH.toLowerCase().includes(env.JAVA_HOME.toLowerCase()))) {
    const binDir = path.join(env.JAVA_HOME, 'bin');
    env.PATH = `${binDir};${env.PATH ?? ''}`;
  }
  return env;
}

/**
 * Kumpulkan informasi prasyarat dari sistem nyata.
 * @param {NodeJS.ProcessEnv} env
 */
export function collectPrereqInfo(env = process.env) {
  const activeEnv = enrichSystemEnv(env);
  const androidHome = activeEnv.ANDROID_HOME ?? null;
  let androidHomeExists;
  if (androidHome && androidHome.trim() !== '') {
    try {
      androidHomeExists = existsSync(androidHome) && statSync(androidHome).isDirectory();
    } catch {
      androidHomeExists = false;
    }
  }
  return {
    nodeVersion: process.version,
    javaVersionOutput: readJavaVersionOutput(activeEnv),
    androidHome,
    androidHomeExists,
  };
}

/**
 * Cek prasyarat sistem nyata dan cetak hasilnya.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function runPrereqCheck({ env = process.env, log = console.log, logError = console.error } = {}) {
  const result = checkPrerequisites(collectPrereqInfo(env));
  if (result.ok) {
    log('Prasyarat terpenuhi (Node.js, JDK, ANDROID_HOME).');
  } else {
    for (const e of result.errors) logError(`  - ${e}`);
  }
  return result;
}

/** True bila modul ini dijalankan langsung lewat `node <file>`. */
export function isMainModule(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  const norm = (p) => {
    const r = path.resolve(p);
    return process.platform === 'win32' ? r.toLowerCase() : r;
  };
  return norm(fileURLToPath(metaUrl)) === norm(argv1);
}

if (isMainModule(import.meta.url)) {
  const { ok } = runPrereqCheck();
  if (!ok) {
    console.error(`Langkah gagal: ${PREREQ_STEP_NAME}`);
    process.exitCode = 1;
  }
}
