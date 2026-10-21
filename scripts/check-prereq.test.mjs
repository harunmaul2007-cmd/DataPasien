// @vitest-environment node
// Unit test cek prasyarat Proses_Build (Req 13.5).

import { describe, expect, it } from 'vitest';
import { checkPrerequisites, parseJavaMajor, parseNodeMajor } from './check-prereq.mjs';

const okInfo = {
  nodeVersion: 'v22.11.0',
  javaVersionOutput: 'openjdk version "21.0.2" 2024-01-16',
  androidHome: '/opt/android-sdk',
  androidHomeExists: true,
};

describe('parseNodeMajor', () => {
  it.each([
    ['v22.11.0', 22],
    ['20.1.0', 20],
    ['abc', null],
    [undefined, null],
  ])('%s -> %s', (input, expected) => {
    expect(parseNodeMajor(input)).toBe(expected);
  });
});

describe('parseJavaMajor', () => {
  it.each([
    ['openjdk version "21.0.2" 2024-01-16', 21],
    ['java version "1.8.0_311"', 8],
    ['openjdk version "17-ea"', 17],
    ['openjdk 21.0.1 2023-10-17', 21],
    ['tidak ada versi', null],
  ])('%s -> %s', (input, expected) => {
    expect(parseJavaMajor(input)).toBe(expected);
  });
});

describe('checkPrerequisites', () => {
  it('lolos bila Node >= 22, JDK >= 21, dan ANDROID_HOME ada', () => {
    expect(checkPrerequisites(okInfo)).toEqual({ ok: true, errors: [] });
  });

  it('gagal bila Node terlalu lama', () => {
    const res = checkPrerequisites({ ...okInfo, nodeVersion: 'v20.10.0' });
    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/Node\.js/);
  });

  it('gagal bila JDK tidak ditemukan atau terlalu lama', () => {
    expect(checkPrerequisites({ ...okInfo, javaVersionOutput: null }).errors[0]).toMatch(/JDK tidak ditemukan/);
    expect(checkPrerequisites({ ...okInfo, javaVersionOutput: 'openjdk version "17.0.9"' }).errors[0]).toMatch(
      /JDK 17 terlalu lama/,
    );
  });

  it('gagal bila ANDROID_HOME tidak diatur atau tidak ada', () => {
    expect(checkPrerequisites({ ...okInfo, androidHome: '' }).errors[0]).toMatch(/ANDROID_HOME belum diatur/);
    expect(checkPrerequisites({ ...okInfo, androidHomeExists: false }).errors[0]).toMatch(/tidak ada/);
  });

  it('mengumpulkan semua kesalahan sekaligus', () => {
    const res = checkPrerequisites({ nodeVersion: 'v18.0.0', javaVersionOutput: '', androidHome: null });
    expect(res.errors).toHaveLength(3);
  });
});
