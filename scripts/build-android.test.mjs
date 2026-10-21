// @vitest-environment node
// Unit test Proses_Build Android (Req 13.5, 13.13).
// Tanpa JDK/Android SDK: checkPrereq dan exec diinjeksi; exec palsu menulis APK
// di gradleApkPath saat Gradle dipanggil.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STEP_NAMES,
  createBuildSteps,
  gradleApkPath,
  releaseApkFileName,
  resolveSigningConfig,
  runBuild,
  runSteps,
  validateReleaseVersion,
} from './build-android.mjs';

const prereqOk = () => ({ ok: true, errors: [] });

/** exec palsu: mencatat panggilan; Gradle menulis APK sementara; dapat digagalkan per langkah. */
function makeExec(rootDir, mode, { failOn } = {}) {
  const calls = [];
  const exec = (command, args) => {
    calls.push([command, ...args]);
    const isGradle = /gradlew/.test(command);
    const kind = isGradle ? 'gradle' : args.includes('sync') ? 'capSync' : 'viteBuild';
    if (failOn === kind) throw new Error(`${kind} gagal (simulasi)`);
    if (isGradle) {
      const apk = gradleApkPath(rootDir, mode);
      mkdirSync(path.dirname(apk), { recursive: true });
      writeFileSync(apk, 'APK');
    }
  };
  return { exec, calls };
}

function makeLogger() {
  const out = [];
  const err = [];
  return { out, err, log: (m) => out.push(m), logError: (m) => err.push(m) };
}

function releaseApks(rootDir) {
  const dir = path.join(rootDir, 'release');
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.apk') || f.endsWith('.partial')) : [];
}

let rootDir;

function writeVersion(v) {
  writeFileSync(path.join(rootDir, 'version.json'), JSON.stringify(v));
}

function writeLastRelease(v) {
  mkdirSync(path.join(rootDir, 'release'), { recursive: true });
  writeFileSync(path.join(rootDir, 'release', 'last-release.json'), JSON.stringify(v));
}

function writeKeystore() {
  const androidDir = path.join(rootDir, 'android');
  mkdirSync(androidDir, { recursive: true });
  writeFileSync(path.join(androidDir, 'release.jks'), 'KEY');
  writeFileSync(
    path.join(androidDir, 'keystore.properties'),
    ['storeFile=release.jks', 'storePassword=pw', 'keyAlias=alias', 'keyPassword=kpw'].join('\n'),
  );
}

beforeEach(() => {
  rootDir = mkdtempSync(path.join(os.tmpdir(), 'datapasien-build-'));
  mkdirSync(path.join(rootDir, 'android'), { recursive: true });
});

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true });
});

describe('validateReleaseVersion', () => {
  const prev = { versionName: '1.0.0', versionCode: 5 };

  it('menerima versi baru dengan versionCode lebih besar dan versionName berbeda', () => {
    expect(validateReleaseVersion({ versionName: '1.1.0', versionCode: 6 }, prev)).toEqual({ ok: true, errors: [] });
  });

  it('menerima rilis pertama (tanpa rilis sebelumnya)', () => {
    expect(validateReleaseVersion({ versionName: '1.0.0', versionCode: 1 }, null).ok).toBe(true);
  });

  it.each([5, 4, 1])('menolak versionCode %i yang tidak lebih besar dari 5', (code) => {
    const res = validateReleaseVersion({ versionName: '1.1.0', versionCode: code }, prev);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('versionCode'))).toBe(true);
  });

  it('menolak versionName yang sama dengan rilis sebelumnya', () => {
    const res = validateReleaseVersion({ versionName: '1.0.0', versionCode: 6 }, prev);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('versionName'))).toBe(true);
  });

  it.each(['1.0', '1.0.0-beta', 'v1.0.0', '', '1.a.0'])('menolak versionName tidak valid "%s"', (name) => {
    const res = validateReleaseVersion({ versionName: name, versionCode: 6 }, prev);
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.includes('MAJOR.MINOR.PATCH'))).toBe(true);
  });

  it('menolak versionName tidak valid juga pada rilis pertama', () => {
    expect(validateReleaseVersion({ versionName: '1.0', versionCode: 1 }, undefined).ok).toBe(false);
  });

  it('menolak last-release.json yang tidak valid', () => {
    const res = validateReleaseVersion({ versionName: '1.1.0', versionCode: 6 }, { versionName: 'x', versionCode: 0 });
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/last-release\.json tidak valid/);
  });
});

describe('resolveSigningConfig', () => {
  const fullEnv = {
    DATAPASIEN_KEYSTORE_FILE: 'env.jks',
    DATAPASIEN_KEYSTORE_PASSWORD: 'p',
    DATAPASIEN_KEYSTORE_ALIAS: 'a',
    DATAPASIEN_KEYSTORE_KEY_PASSWORD: 'k',
  };

  it('melaporkan semua kunci yang kurang bila props dan env kosong', () => {
    const res = resolveSigningConfig(null, {});
    expect(res.ok).toBe(false);
    expect(res.missing).toHaveLength(4);
    expect(res.missing).toContain('storeFile (DATAPASIEN_KEYSTORE_FILE)');
  });

  it('memakai env bila keystore.properties tidak ada', () => {
    const res = resolveSigningConfig(null, fullEnv);
    expect(res.ok).toBe(true);
    expect(res.config.storeFile).toBe('env.jks');
  });

  it('mengutamakan keystore.properties dan menganggap nilai kosong sebagai tidak ada', () => {
    const res = resolveSigningConfig({ storeFile: 'props.jks', keyPassword: '  ' }, { ...fullEnv, DATAPASIEN_KEYSTORE_KEY_PASSWORD: '' });
    expect(res.ok).toBe(false);
    expect(res.config.storeFile).toBe('props.jks');
    expect(res.missing).toEqual(['keyPassword (DATAPASIEN_KEYSTORE_KEY_PASSWORD)']);
  });
});

describe('runSteps', () => {
  it('berhenti pada langkah gagal, memanggil cleanup, dan mencetak nama langkah', async () => {
    const ran = [];
    let cleaned = 0;
    const { err, logError } = makeLogger();
    const res = await runSteps(
      [
        { name: 'A', run: () => ran.push('A') },
        { name: 'B', run: () => { throw new Error('boom'); } },
        { name: 'C', run: () => ran.push('C') },
      ],
      { cleanup: () => { cleaned++; }, logError },
    );
    expect(res).toMatchObject({ ok: false, completed: ['A'], failedStep: 'B' });
    expect(ran).toEqual(['A']);
    expect(cleaned).toBe(1);
    expect(err).toContain('boom');
    expect(err.at(-1)).toBe('Langkah gagal: B');
  });

  it('tetap mencetak nama langkah walau cleanup melempar', async () => {
    const { err, logError } = makeLogger();
    const res = await runSteps([{ name: 'X', run: async () => { throw new Error('e'); } }], {
      cleanup: () => { throw new Error('cleanup'); },
      logError,
    });
    expect(res.ok).toBe(false);
    expect(err.at(-1)).toBe('Langkah gagal: X');
  });

  it('mengembalikan ok bila semua langkah berhasil', async () => {
    const res = await runSteps([{ name: 'A', run: () => {} }, { name: 'B', run: () => {} }]);
    expect(res).toEqual({ ok: true, completed: ['A', 'B'] });
  });
});

describe('createBuildSteps', () => {
  it('menyusun langkah debug berurutan', () => {
    const { steps } = createBuildSteps({ mode: 'debug', rootDir, checkPrereq: prereqOk, exec: () => {} });
    expect(steps.map((s) => s.name)).toEqual([
      STEP_NAMES.prereq,
      STEP_NAMES.viteBuild,
      STEP_NAMES.capSync,
      'Gradle assembleDebug',
      STEP_NAMES.copyApk,
    ]);
  });

  it('menambah langkah kunci, validasi versi, dan pencatatan rilis pada mode rilis', () => {
    const { steps } = createBuildSteps({ mode: 'release', rootDir, checkPrereq: prereqOk, exec: () => {} });
    expect(steps.map((s) => s.name)).toEqual([
      STEP_NAMES.prereq,
      STEP_NAMES.signing,
      STEP_NAMES.version,
      STEP_NAMES.viteBuild,
      STEP_NAMES.capSync,
      'Gradle assembleRelease',
      STEP_NAMES.copyApk,
      STEP_NAMES.recordRelease,
    ]);
  });

  it('menolak mode tidak dikenal', () => {
    expect(() => createBuildSteps({ mode: 'profile', rootDir })).toThrow(/Mode tidak dikenal/);
  });
});

describe('runBuild (debug)', () => {
  beforeEach(() => writeVersion({ versionName: '1.2.3', versionCode: 3 }));

  it('menyalin APK ke release/ dengan nama berversi bila semua langkah berhasil', async () => {
    const { exec, calls } = makeExec(rootDir, 'debug');
    const logger = makeLogger();
    const res = await runBuild({ mode: 'debug', rootDir, env: {}, checkPrereq: prereqOk, exec, ...logger });
    expect(res.ok).toBe(true);
    const expected = path.join(rootDir, 'release', releaseApkFileName('1.2.3', 'debug'));
    expect(res.outputApk).toBe(expected);
    expect(readFileSync(expected, 'utf8')).toBe('APK');
    expect(calls).toHaveLength(3);
    expect(calls[2][1]).toBe('assembleDebug');
  });

  it.each([
    ['viteBuild', STEP_NAMES.viteBuild],
    ['capSync', STEP_NAMES.capSync],
    ['gradle', 'Gradle assembleDebug'],
  ])('kegagalan %s mencetak nama langkah dan tidak menyalin APK', async (failOn, stepName) => {
    const { exec } = makeExec(rootDir, 'debug', { failOn });
    const logger = makeLogger();
    const res = await runBuild({ mode: 'debug', rootDir, env: {}, checkPrereq: prereqOk, exec, ...logger });
    expect(res).toMatchObject({ ok: false, failedStep: stepName, outputApk: null });
    expect(logger.err.at(-1)).toBe(`Langkah gagal: ${stepName}`);
    expect(releaseApks(rootDir)).toEqual([]);
    expect(existsSync(gradleApkPath(rootDir, 'debug'))).toBe(false);
  });

  it('gagal pada Gradle bila APK tidak dihasilkan', async () => {
    const logger = makeLogger();
    const res = await runBuild({ mode: 'debug', rootDir, env: {}, checkPrereq: prereqOk, exec: () => {}, ...logger });
    expect(res).toMatchObject({ ok: false, failedStep: 'Gradle assembleDebug' });
    expect(releaseApks(rootDir)).toEqual([]);
  });

  it('kegagalan prasyarat menghentikan build sebelum perintah apa pun dijalankan', async () => {
    const { exec, calls } = makeExec(rootDir, 'debug');
    const logger = makeLogger();
    const res = await runBuild({
      mode: 'debug',
      rootDir,
      env: {},
      checkPrereq: () => ({ ok: false, errors: ['JDK tidak ditemukan'] }),
      exec,
      ...logger,
    });
    expect(res).toMatchObject({ ok: false, failedStep: STEP_NAMES.prereq });
    expect(logger.err).toContain('JDK tidak ditemukan');
    expect(logger.err.at(-1)).toBe(`Langkah gagal: ${STEP_NAMES.prereq}`);
    expect(calls).toEqual([]);
    expect(releaseApks(rootDir)).toEqual([]);
  });

  it('menghapus APK Gradle lama sehingga APK basi tidak tersalin', async () => {
    const stale = gradleApkPath(rootDir, 'debug');
    mkdirSync(path.dirname(stale), { recursive: true });
    writeFileSync(stale, 'STALE');
    const logger = makeLogger();
    const res = await runBuild({ mode: 'debug', rootDir, env: {}, checkPrereq: prereqOk, exec: () => {}, ...logger });
    expect(res.ok).toBe(false);
    expect(existsSync(stale)).toBe(false);
    expect(releaseApks(rootDir)).toEqual([]);
  });
});

describe('runBuild (release)', () => {
  beforeEach(() => writeVersion({ versionName: '1.1.0', versionCode: 2 }));

  it('berhasil dan memperbarui release/last-release.json', async () => {
    writeKeystore();
    writeLastRelease({ versionName: '1.0.0', versionCode: 1 });
    const { exec, calls } = makeExec(rootDir, 'release');
    const logger = makeLogger();
    const res = await runBuild({ mode: 'release', rootDir, env: {}, checkPrereq: prereqOk, exec, ...logger });
    expect(res.ok).toBe(true);
    expect(releaseApks(rootDir)).toEqual([releaseApkFileName('1.1.0', 'release')]);
    expect(calls.at(-1)[1]).toBe('assembleRelease');
    const last = JSON.parse(readFileSync(path.join(rootDir, 'release', 'last-release.json'), 'utf8'));
    expect(last).toEqual({ versionName: '1.1.0', versionCode: 2 });
  });

  it('kunci tidak tersedia: gagal di langkah Cek Kunci_Penandatanganan tanpa menjalankan build', async () => {
    const { exec, calls } = makeExec(rootDir, 'release');
    const logger = makeLogger();
    const res = await runBuild({ mode: 'release', rootDir, env: {}, checkPrereq: prereqOk, exec, ...logger });
    expect(res).toMatchObject({ ok: false, failedStep: STEP_NAMES.signing, outputApk: null });
    expect(logger.err.some((m) => m.includes('DATAPASIEN_KEYSTORE_FILE'))).toBe(true);
    expect(logger.err.at(-1)).toBe(`Langkah gagal: ${STEP_NAMES.signing}`);
    expect(calls).toEqual([]);
    expect(releaseApks(rootDir)).toEqual([]);
  });

  it('kunci dikonfigurasi lewat env tetapi file keystore tidak ada: gagal di langkah kunci', async () => {
    const env = {
      DATAPASIEN_KEYSTORE_FILE: 'tidak-ada.jks',
      DATAPASIEN_KEYSTORE_PASSWORD: 'p',
      DATAPASIEN_KEYSTORE_ALIAS: 'a',
      DATAPASIEN_KEYSTORE_KEY_PASSWORD: 'k',
    };
    const { exec, calls } = makeExec(rootDir, 'release');
    const logger = makeLogger();
    const res = await runBuild({ mode: 'release', rootDir, env, checkPrereq: prereqOk, exec, ...logger });
    expect(res).toMatchObject({ ok: false, failedStep: STEP_NAMES.signing });
    expect(logger.err.some((m) => m.includes('File keystore tidak ditemukan'))).toBe(true);
    expect(calls).toEqual([]);
  });

  it.each([
    ['versionCode tidak naik', { versionName: '1.1.0', versionCode: 2 }, { versionName: '1.0.0', versionCode: 2 }],
    ['versionName sama', { versionName: '1.0.0', versionCode: 3 }, { versionName: '1.0.0', versionCode: 2 }],
    ['versionName tidak valid', { versionName: '1.1', versionCode: 3 }, { versionName: '1.0.0', versionCode: 2 }],
  ])('%s: build ditolak tanpa menyalin APK dan last-release.json tidak berubah', async (_label, current, previous) => {
    writeKeystore();
    writeVersion(current);
    writeLastRelease(previous);
    const { exec, calls } = makeExec(rootDir, 'release');
    const logger = makeLogger();
    const res = await runBuild({ mode: 'release', rootDir, env: {}, checkPrereq: prereqOk, exec, ...logger });
    expect(res.ok).toBe(false);
    // versionName tidak valid ditolak sejak pembacaan version.json di langkah prasyarat.
    const expectedStep = /^\d+\.\d+\.\d+$/.test(current.versionName) ? STEP_NAMES.version : STEP_NAMES.prereq;
    expect(res.failedStep).toBe(expectedStep);
    expect(logger.err.at(-1)).toBe(`Langkah gagal: ${expectedStep}`);
    expect(calls).toEqual([]);
    expect(releaseApks(rootDir)).toEqual([]);
    const last = JSON.parse(readFileSync(path.join(rootDir, 'release', 'last-release.json'), 'utf8'));
    expect(last).toEqual(previous);
  });

  it('kegagalan Gradle rilis tidak menyalin APK dan tidak memperbarui last-release.json', async () => {
    writeKeystore();
    writeLastRelease({ versionName: '1.0.0', versionCode: 1 });
    const { exec } = makeExec(rootDir, 'release', { failOn: 'gradle' });
    const logger = makeLogger();
    const res = await runBuild({ mode: 'release', rootDir, env: {}, checkPrereq: prereqOk, exec, ...logger });
    expect(res).toMatchObject({ ok: false, failedStep: 'Gradle assembleRelease' });
    expect(releaseApks(rootDir)).toEqual([]);
    const last = JSON.parse(readFileSync(path.join(rootDir, 'release', 'last-release.json'), 'utf8'));
    expect(last).toEqual({ versionName: '1.0.0', versionCode: 1 });
  });
});
