#!/usr/bin/env node
// Proses_Build APK Android (Req 13.1, 13.2, 13.4, 13.5, 13.13).
//
//   node scripts/build-android.mjs debug     -> release/data-pasien-<versionName>-debug.apk
//   node scripts/build-android.mjs release   -> release/data-pasien-<versionName>-release.apk
//
// Langkah dijalankan berurutan. Bila satu langkah gagal: cetak
// `Langkah gagal: <nama langkah>`, keluar dengan kode non-nol, dan hapus APK
// sementara (keluaran Gradle dan salinan parsial) sehingga tidak ada APK baru
// di release/. Mode rilis menambah langkah "Cek Kunci_Penandatanganan" dan
// validasi versi terhadap release/last-release.json, lalu memperbarui file itu
// setelah seluruh langkah berhasil.
//
// Logika inti diekspor sebagai fungsi murni / dapat diinjeksi agar dapat diuji
// (lihat scripts/*.test.mjs) tanpa JDK maupun Android SDK.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREREQ_STEP_NAME, enrichSystemEnv, isMainModule, runPrereqCheck } from './check-prereq.mjs';

export const VERSION_NAME_PATTERN = /^\d+\.\d+\.\d+$/;
export const MODES = /** @type {const} */ (['debug', 'release']);
export const DEFAULT_ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const STEP_NAMES = Object.freeze({
  prereq: PREREQ_STEP_NAME,
  signing: 'Cek Kunci_Penandatanganan',
  version: 'Validasi versi rilis',
  viteBuild: 'Build web (vite build)',
  capSync: 'Sinkronisasi Capacitor (cap sync android)',
  gradle: (mode) => `Gradle assemble${mode === 'release' ? 'Release' : 'Debug'}`,
  copyApk: 'Salin APK ke release/',
  recordRelease: 'Perbarui release/last-release.json',
});

export const SIGNING_ENV_KEYS = Object.freeze({
  storeFile: 'DATAPASIEN_KEYSTORE_FILE',
  storePassword: 'DATAPASIEN_KEYSTORE_PASSWORD',
  keyAlias: 'DATAPASIEN_KEYSTORE_ALIAS',
  keyPassword: 'DATAPASIEN_KEYSTORE_KEY_PASSWORD',
});

// ---------------------------------------------------------------------------
// Fungsi murni: versi
// ---------------------------------------------------------------------------

/** @param {unknown} name */
export function isValidVersionName(name) {
  return typeof name === 'string' && VERSION_NAME_PATTERN.test(name);
}

/** @param {unknown} code */
export function isValidVersionCode(code) {
  return Number.isInteger(code) && /** @type {number} */ (code) >= 1;
}

/**
 * Validasi format isi version.json.
 * @param {unknown} v
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateVersionInfo(v) {
  const errors = [];
  if (v === null || typeof v !== 'object') {
    return { ok: false, errors: ['version.json harus berisi objek { versionName, versionCode }.'] };
  }
  const { versionName, versionCode } = /** @type {Record<string, unknown>} */ (v);
  if (!isValidVersionCode(versionCode)) {
    errors.push('versionCode harus bilangan bulat >= 1.');
  }
  if (!isValidVersionName(versionName)) {
    errors.push('versionName harus berformat MAJOR.MINOR.PATCH (mis. 1.2.3).');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validasi versi rilis baru terhadap rilis sebelumnya (Req 13.13).
 * `previous` null/undefined berarti belum pernah ada rilis.
 * @param {{ versionName: unknown, versionCode: unknown }} current
 * @param {{ versionName: unknown, versionCode: unknown } | null | undefined} previous
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateReleaseVersion(current, previous) {
  const { errors } = validateVersionInfo(current);
  if (previous != null && errors.length === 0) {
    const prev = validateVersionInfo(previous);
    if (!prev.ok) {
      errors.push(`release/last-release.json tidak valid: ${prev.errors.join(' ')}`);
    } else {
      if (/** @type {number} */ (current.versionCode) <= /** @type {number} */ (previous.versionCode)) {
        errors.push(
          `versionCode ${current.versionCode} harus lebih besar dari versionCode rilis sebelumnya (${previous.versionCode}).`,
        );
      }
      if (current.versionName === previous.versionName) {
        errors.push(`versionName ${current.versionName} harus berbeda dari versionName rilis sebelumnya.`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Parse teks JSON versi; melempar Error berpesan jelas bila gagal.
 * @param {string} text
 * @param {string} label
 */
export function parseVersionJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} bukan JSON yang valid.`);
  }
}

// ---------------------------------------------------------------------------
// Fungsi murni: Kunci_Penandatanganan
// ---------------------------------------------------------------------------

/**
 * Parse sederhana file .properties Java (key=value / key:value, komentar # dan !).
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseProperties(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#') || line.startsWith('!')) continue;
    const m = /^([^=:\s]+)\s*[=:]\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/**
 * Tentukan konfigurasi penandatanganan dengan aturan yang sama seperti
 * android/app/build.gradle: nilai keystore.properties diutamakan, lalu env.
 * @param {Record<string, string> | null | undefined} props
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: boolean, missing: string[], config: Record<string, string> }}
 */
export function resolveSigningConfig(props, env) {
  /** @type {Record<string, string>} */
  const config = {};
  const missing = [];
  for (const [key, envKey] of Object.entries(SIGNING_ENV_KEYS)) {
    const fromProps = props?.[key];
    const fromEnv = env?.[envKey];
    const value =
      typeof fromProps === 'string' && fromProps.trim() !== ''
        ? fromProps.trim()
        : typeof fromEnv === 'string' && fromEnv.trim() !== ''
          ? fromEnv.trim()
          : null;
    if (value === null) missing.push(`${key} (${envKey})`);
    else config[key] = value;
  }
  return { ok: missing.length === 0, missing, config };
}

// ---------------------------------------------------------------------------
// Fungsi murni: jalur keluaran
// ---------------------------------------------------------------------------

/** Lokasi APK keluaran Gradle (APK sementara). */
export function gradleApkPath(rootDir, mode) {
  return path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', mode, `app-${mode}.apk`);
}

/** Nama file APK di release/. */
export function releaseApkFileName(versionName, mode) {
  return `data-pasien-${versionName}-${mode}.apk`;
}

/** Nama perintah Gradle wrapper sesuai platform. */
export function gradleWrapperCommand(platform = process.platform) {
  return platform === 'win32' ? 'gradlew.bat' : './gradlew';
}

// ---------------------------------------------------------------------------
// Step runner
// ---------------------------------------------------------------------------

/**
 * @typedef {{ name: string, run: () => (void | Promise<void>) }} Step
 * @typedef {{ ok: true, completed: string[] } | { ok: false, completed: string[], failedStep: string, error: unknown }} StepsResult
 */

/**
 * Jalankan langkah berurutan; berhenti pada langkah pertama yang melempar.
 * Saat gagal: panggil `cleanup` (kesalahan cleanup diabaikan) lalu cetak
 * `Langkah gagal: <nama langkah>` lewat `logError`.
 * @param {Step[]} steps
 * @param {{ cleanup?: () => (void | Promise<void>), log?: (m: string) => void, logError?: (m: string) => void }} [opts]
 * @returns {Promise<StepsResult>}
 */
export async function runSteps(steps, { cleanup, log = () => {}, logError = () => {} } = {}) {
  /** @type {string[]} */
  const completed = [];
  for (const step of steps) {
    log(`==> ${step.name}`);
    try {
      await step.run();
      completed.push(step.name);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (detail) logError(detail);
      if (cleanup) {
        try {
          await cleanup();
        } catch {
          // abaikan; pesan utama tetap nama langkah yang gagal
        }
      }
      logError(`Langkah gagal: ${step.name}`);
      return { ok: false, completed, failedStep: step.name, error };
    }
  }
  return { ok: true, completed };
}

// ---------------------------------------------------------------------------
// Eksekusi perintah eksternal
// ---------------------------------------------------------------------------

/**
 * Jalankan perintah secara sinkron dengan stdio diteruskan; lempar bila gagal.
 * `.bat`/`.cmd` di Windows wajib lewat shell; argumen di sini selalu literal tetap.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv }} opts
 */
export function defaultExec(command, args, { cwd, env = process.env }) {
  const needsShell = process.platform === 'win32' && /\.(bat|cmd)$/i.test(command);
  const r = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: needsShell, windowsHide: true });
  if (r.error) throw new Error(`Tidak dapat menjalankan ${command}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${command} ${args.join(' ')} keluar dengan kode ${r.status ?? r.signal}.`);
}

// ---------------------------------------------------------------------------
// Penyusunan langkah build
// ---------------------------------------------------------------------------

/**
 * @typedef {{
 *   mode: 'debug' | 'release',
 *   rootDir?: string,
 *   env?: NodeJS.ProcessEnv,
 *   exec?: (command: string, args: string[], opts: { cwd: string, env?: NodeJS.ProcessEnv }) => void,
 *   checkPrereq?: () => { ok: boolean, errors: string[] },
 *   platform?: NodeJS.Platform,
 *   log?: (m: string) => void,
 *   logError?: (m: string) => void,
 * }} BuildOptions
 */

/**
 * Susun daftar langkah build beserta fungsi cleanup APK sementara.
 * @param {BuildOptions} options
 * @returns {{ steps: Step[], cleanup: () => void, state: { version: any, outputApk: string | null } }}
 */
export function createBuildSteps(options) {
  const {
    mode,
    rootDir = DEFAULT_ROOT_DIR,
    env = options.env ?? enrichSystemEnv(process.env),
    exec = defaultExec,
    platform = process.platform,
    log = console.log,
    logError = console.error,
  } = options;
  if (!MODES.includes(mode)) throw new Error(`Mode tidak dikenal: ${mode} (gunakan debug atau release).`);
  // Rincian kesalahan prasyarat dicetak oleh runSteps (lewat pesan Error), bukan di sini.
  const checkPrereq = options.checkPrereq ?? (() => runPrereqCheck({ env, log, logError: () => {} }));

  const androidDir = path.join(rootDir, 'android');
  const releaseDir = path.join(rootDir, 'release');
  const versionFile = path.join(rootDir, 'version.json');
  const lastReleaseFile = path.join(releaseDir, 'last-release.json');
  const tempApk = gradleApkPath(rootDir, mode);
  const state = { version: /** @type {any} */ (null), outputApk: /** @type {string | null} */ (null) };
  /** @type {string | null} */
  let partialCopy = null;

  const readVersion = () => {
    if (!existsSync(versionFile)) throw new Error(`version.json tidak ditemukan di ${versionFile}.`);
    const v = parseVersionJson(readFileSync(versionFile, 'utf8'), 'version.json');
    const res = validateVersionInfo(v);
    if (!res.ok) throw new Error(res.errors.join('\n'));
    state.version = v;
    return v;
  };

  /** @type {Step[]} */
  const steps = [
    {
      name: STEP_NAMES.prereq,
      run: () => {
        const res = checkPrereq();
        if (!res.ok) throw new Error(res.errors.join('\n'));
        readVersion();
      },
    },
  ];

  if (mode === 'release') {
    steps.push(
      {
        name: STEP_NAMES.signing,
        run: () => {
          const propsFile = path.join(androidDir, 'keystore.properties');
          const props = existsSync(propsFile) ? parseProperties(readFileSync(propsFile, 'utf8')) : null;
          const res = resolveSigningConfig(props, env);
          if (!res.ok) {
            throw new Error(
              `Kunci_Penandatanganan tidak tersedia. Isi android/keystore.properties atau variabel lingkungan; nilai yang kurang: ${res.missing.join(', ')}.`,
            );
          }
          // build.gradle menyelesaikan path relatif terhadap direktori android/
          const storePath = path.resolve(androidDir, res.config.storeFile);
          if (!existsSync(storePath)) {
            throw new Error(`File keystore tidak ditemukan: ${storePath}`);
          }
        },
      },
      {
        name: STEP_NAMES.version,
        run: () => {
          const previous = existsSync(lastReleaseFile)
            ? parseVersionJson(readFileSync(lastReleaseFile, 'utf8'), 'release/last-release.json')
            : null;
          const res = validateReleaseVersion(state.version, previous);
          if (!res.ok) throw new Error(res.errors.join('\n'));
        },
      },
    );
  }

  steps.push(
    {
      name: STEP_NAMES.viteBuild,
      run: () => {
        // Hapus APK lama agar yang disalin pasti hasil build ini.
        rmSync(tempApk, { force: true });
        // --mode android: tanpa service worker (lihat vite.config.ts).
        exec(process.execPath, [path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--mode', 'android'], {
          cwd: rootDir,
          env,
        });
      },
    },
    {
      name: STEP_NAMES.capSync,
      run: () =>
        exec(process.execPath, [path.join(rootDir, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'], {
          cwd: rootDir,
          env,
        }),
    },
    {
      name: STEP_NAMES.gradle(mode),
      run: () => {
        const task = mode === 'release' ? 'assembleRelease' : 'assembleDebug';
        exec(gradleWrapperCommand(platform), [task], { cwd: androidDir, env });
        if (!existsSync(tempApk)) {
          throw new Error(`APK hasil Gradle tidak ditemukan di ${tempApk}.`);
        }
      },
    },
    {
      name: STEP_NAMES.copyApk,
      run: () => {
        mkdirSync(releaseDir, { recursive: true });
        const finalPath = path.join(releaseDir, releaseApkFileName(state.version.versionName, mode));
        // Salin ke file sementara dulu lalu rename agar tidak ada APK parsial di release/.
        partialCopy = `${finalPath}.partial`;
        copyFileSync(tempApk, partialCopy);
        renameSync(partialCopy, finalPath);
        partialCopy = null;
        state.outputApk = finalPath;
      },
    },
  );

  if (mode === 'release') {
    steps.push({
      name: STEP_NAMES.recordRelease,
      run: () => {
        const record = { versionName: state.version.versionName, versionCode: state.version.versionCode };
        writeFileSync(lastReleaseFile, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
      },
    });
  }

  const cleanup = () => {
    rmSync(tempApk, { force: true });
    if (partialCopy) rmSync(partialCopy, { force: true });
    // Bila gagal setelah salin (mis. mencatat last-release.json), APK keluaran juga dihapus
    // agar kegagalan tidak meninggalkan APK baru.
    if (state.outputApk) {
      rmSync(state.outputApk, { force: true });
      state.outputApk = null;
    }
  };

  return { steps, cleanup, state };
}

/**
 * Jalankan seluruh Proses_Build.
 * @param {BuildOptions} options
 * @returns {Promise<StepsResult & { outputApk: string | null }>}
 */
export async function runBuild(options) {
  const log = options.log ?? console.log;
  const logError = options.logError ?? console.error;
  const { steps, cleanup, state } = createBuildSteps({ ...options, log, logError });
  const result = await runSteps(steps, { cleanup, log, logError });
  if (result.ok) log(`APK ${options.mode} berhasil dibuat: ${state.outputApk}`);
  return { ...result, outputApk: result.ok ? state.outputApk : null };
}

/**
 * Ambil mode dari argumen CLI.
 * @param {string[]} args
 * @returns {'debug' | 'release' | null}
 */
export function parseModeArg(args) {
  const mode = args[0] ?? 'debug';
  return MODES.includes(/** @type {any} */ (mode)) ? /** @type {'debug' | 'release'} */ (mode) : null;
}

if (isMainModule(import.meta.url)) {
  const mode = parseModeArg(process.argv.slice(2));
  if (!mode) {
    console.error('Pemakaian: node scripts/build-android.mjs <debug|release>');
    process.exitCode = 2;
  } else {
    const result = await runBuild({ mode });
    if (!result.ok) process.exitCode = 1;
  }
}
