import { Injectable } from '@angular/core'
import { ApiService } from '../../services/api.service'

const SERVER_URL_KEY = 'cozystream:server_url'

@Injectable({ providedIn: 'root' })
export class TvApiService extends ApiService {

  constructor() {
    super()
    const serverUrl = this.getServerUrl()
    if (serverUrl) {
      this.base = `${serverUrl}/api`
    }
  }

  setServerUrl(url: string): void {
    // Strip trailing slash
    const clean = url.replace(/\/+$/, '')
    localStorage.setItem(SERVER_URL_KEY, clean)
    this.base = `${clean}/api`
  }

  getServerUrl(): string | null {
    return localStorage.getItem(SERVER_URL_KEY)
  }

  /** Build a full URL for streaming endpoints (used by video src and HLS) */
  override streamUrl(id: number): string {
    return `${this.base}/stream/${id}`
  }

  override subtitleUrl(mediaId: number, trackIndex: number): string {
    return `${this.base}/stream/${mediaId}/subtitles/${trackIndex}`
  }
}
