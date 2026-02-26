import { Injectable, inject, signal, computed } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'
import { Observable, tap } from 'rxjs'
import type { User, AuthResponse, AuthStatus, InviteCode } from '../models/auth.model'

const TOKEN_KEY = 'cozystream:token'
const USER_KEY = 'cozystream:user'

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient)
  private router = inject(Router)
  private base = '/api/auth'

  private _user = signal<User | null>(this.loadUser())
  private _token = signal<string | null>(this.loadToken())

  readonly user = this._user.asReadonly()
  readonly token = this._token.asReadonly()
  readonly isLoggedIn = computed(() => !!this._token())
  readonly isAdmin = computed(() => this._user()?.role === 'admin')

  // --- Public auth ---

  checkStatus(): Observable<AuthStatus> {
    return this.http.get<AuthStatus>(`${this.base}/status`)
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/login`, { username, password })
      .pipe(tap((res) => this.saveAuth(res)))
  }

  register(
    username: string,
    password: string,
    displayName: string,
    inviteCode?: string
  ): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.base}/register`, {
        username,
        password,
        displayName,
        inviteCode,
      })
      .pipe(tap((res) => this.saveAuth(res)))
  }

  logout(): void {
    this._token.set(null)
    this._user.set(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    this.router.navigate(['/login'])
  }

  getToken(): string | null {
    return this._token()
  }

  // --- Admin: invite codes ---

  getInviteCodes(): Observable<InviteCode[]> {
    return this.http.get<InviteCode[]>(`${this.base}/invite-codes`)
  }

  createInviteCode(): Observable<{ code: string }> {
    return this.http.post<{ code: string }>(`${this.base}/invite-codes`, {})
  }

  deleteInviteCode(code: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/invite-codes/${code}`)
  }

  // --- Admin: users ---

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/users`)
  }

  // --- Internal ---

  private saveAuth(response: AuthResponse): void {
    this._token.set(response.token)
    this._user.set(response.user)
    localStorage.setItem(TOKEN_KEY, response.token)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
  }

  private loadToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }
}
