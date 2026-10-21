// ExternalLinkGateway: membuka tautan eksternal (misal WhatsApp wa.me) (Req 12).
//
// - Web: window.open(url, '_blank', 'noopener,noreferrer').
// - Android: @capacitor/app-launcher openUrl.

import { Capacitor } from '@capacitor/core';

export interface ExternalLinkGateway {
  open(url: string): Promise<boolean>;
}

export class WebExternalLinkGateway implements ExternalLinkGateway {
  constructor(private readonly win: Window = window) {}

  async open(url: string): Promise<boolean> {
    try {
      const opened = this.win.open(url, '_blank', 'noopener,noreferrer');
      return opened !== null;
    } catch {
      return false;
    }
  }
}

export class AndroidExternalLinkGateway implements ExternalLinkGateway {
  async open(url: string): Promise<boolean> {
    try {
      const { AppLauncher } = await import('@capacitor/app-launcher');
      const res = await AppLauncher.openUrl({ url });
      return res.completed;
    } catch {
      return false;
    }
  }
}

export function createExternalLinkGateway(isNative: boolean = Capacitor.isNativePlatform()): ExternalLinkGateway {
  return isNative ? new AndroidExternalLinkGateway() : new WebExternalLinkGateway();
}
