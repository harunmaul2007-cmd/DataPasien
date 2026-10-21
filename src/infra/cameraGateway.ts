// CameraGateway: deteksi ketersediaan kamera pada perangkat (Req 2.2).
//
// - APK Android: selalu dianggap tersedia jika berjalan di platform native.
// - Web / PWA: memeriksa navigator.mediaDevices.enumerateDevices untuk device bernilai 'videoinput'.

import { Capacitor } from '@capacitor/core';

export interface CameraGateway {
  cekKameraTersedia(): Promise<boolean>;
}

export class DefaultCameraGateway implements CameraGateway {
  constructor(private readonly isNative: boolean = Capacitor.isNativePlatform()) {}

  async cekKameraTersedia(): Promise<boolean> {
    if (this.isNative) {
      return true;
    }

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      return false;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some((d) => d.kind === 'videoinput');
    } catch {
      return false;
    }
  }
}

export function createCameraGateway(isNative: boolean = Capacitor.isNativePlatform()): CameraGateway {
  return new DefaultCameraGateway(isNative);
}
