import { Injectable } from '@angular/core'

/** Type declarations for webOS global APIs (available at runtime on LG TVs) */
declare const webOSSystem: {
  close(): void
  platformBack(): void
} | undefined

declare const webOS: {
  deviceInfo(callback: (info: any) => void): void
  platform: { tv: boolean }
} | undefined

@Injectable({ providedIn: 'root' })
export class WebosPlatformService {

  /** Whether we're running on an actual webOS TV */
  get isWebOS(): boolean {
    return typeof webOSSystem !== 'undefined'
  }

  /** Exit the webOS application */
  closeApp(): void {
    if (typeof webOSSystem !== 'undefined') {
      webOSSystem.close()
    }
  }

  /** Prevent screen saver while video is playing */
  keepScreenOn(enabled: boolean): void {
    // On webOS, we use the visibility API and periodic user activity simulation.
    // The webOS TV will not go to screen saver while the app is actively rendering video.
    // For extra safety, we can use window.navigator's wakeLock if available.
    if ('wakeLock' in navigator && enabled) {
      (navigator as any).wakeLock.request('screen').catch(() => {})
    }
  }

  /** Check if media keys are available (play, pause, stop, etc.) */
  registerMediaKeys(): void {
    // On webOS, media keys are delivered as standard KeyboardEvents with specific keyCodes:
    // Play: 415, Pause: 19, Stop: 413, Rewind: 412, FastForward: 417
    // These are handled in the player component's key listener
  }

  /** Get device info (async, only works on webOS) */
  getDeviceInfo(): Promise<any> {
    return new Promise((resolve) => {
      if (typeof webOS !== 'undefined') {
        webOS.deviceInfo((info: any) => resolve(info))
      } else {
        resolve({ modelName: 'Browser', sdkVersion: 'N/A' })
      }
    })
  }
}
