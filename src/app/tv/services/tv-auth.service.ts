import { Injectable, inject } from '@angular/core'
import { Observable, tap } from 'rxjs'
import { AuthService } from '../../services/auth.service'
import { TvApiService } from './tv-api.service'
import type { AuthResponse } from '../../models/auth.model'

const TOKEN_KEY = 'cozystream:token'

@Injectable({ providedIn: 'root' })
export class TvAuthService extends AuthService {
  private tvApi = inject(TvApiService)

  constructor() {
    super()
    // Update the base URL to match the configured server
    const serverUrl = this.tvApi.getServerUrl()
    if (serverUrl) {
      this.base = `${serverUrl}/api/auth`
    }
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  }

  override login(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/login`, { username, password })
      .pipe(tap((res) => this.saveTvAuth(res)))
  }

  override register(
    username: string,
    password: string,
    displayName: string,
    inviteCode?: string,
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/register`, {
        username,
        password,
        displayName,
        inviteCode,
      })
      .pipe(tap((res) => this.saveTvAuth(res)))
  }

  override logout(): void {
    this.http.post(`${this.base}/logout`, {}).subscribe({ error: () => {} })
    this._user.set(null)
    localStorage.removeItem('cozystream:user')
    localStorage.removeItem(TOKEN_KEY)
    this.router.navigate(['/login'])
  }

  /** Update base URL when server URL changes (e.g., during setup) */
  updateBaseUrl(): void {
    const serverUrl = this.tvApi.getServerUrl()
    if (serverUrl) {
      this.base = `${serverUrl}/api/auth`
    }
  }

  protected override saveAuth(response: AuthResponse): void {
    this.saveTvAuth(response)
  }

  private saveTvAuth(response: AuthResponse): void {
    this._user.set(response.user)
    localStorage.setItem('cozystream:user', JSON.stringify(response.user))
    if (response.token) {
      localStorage.setItem(TOKEN_KEY, response.token)
    }
  }
}
