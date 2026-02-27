import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Router } from '@angular/router'
import { Observable, tap } from 'rxjs'
import type { User, AuthResponse, AuthStatus, InviteCode } from '../models/auth.model'

const USER_KEY = 'cozystream:user'
const REFRESH_INTERVAL = 6 * 60 * 60 * 1000 // 6 hours

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private http = inject(HttpClient)
  private router = inject(Router)
  private base = '/api/auth'
  private refreshTimer?: ReturnType<typeof setInterval>

  private _user = signal<User | null>(this.loadUser())

  readonly user = this._user.asReadonly()
  readonly isLoggedIn = computed(() => !!this._user())
  readonly isAdmin = computed(() => this._user()?.role === 'admin')

  constructor() {
    this.validateToken()
    this.startRefreshTimer()
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
  }

  // --- Public auth ---

  /** Verify the stored session is still valid and refresh user data from the server */
  private validateToken(): void {
    if (!this._user()) return
    this.http.get<User>(`${this.base}/me`).subscribe({
      next: (user) => {
        this._user.set(user)
        localStorage.setItem(USER_KEY, JSON.stringify(user))
      },
      error: () => {
        // Cookie is invalid or expired — clear auth state
        this._user.set(null)
        localStorage.removeItem(USER_KEY)
      },
    })
  }

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
    // Clear the httpOnly cookie on the server
    this.http.post(`${this.base}/logout`, {}).subscribe({ error: () => {} })
    this._user.set(null)
    localStorage.removeItem(USER_KEY)
    this.router.navigate(['/login'])
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
    this._user.set(response.user)
    localStorage.setItem(USER_KEY, JSON.stringify(response.user))
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }

  /** Periodically call /auth/me to refresh the httpOnly cookie before it expires */
  private startRefreshTimer(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer)
    this.refreshTimer = setInterval(() => {
      if (!this._user()) return
      this.http.get<User>(`${this.base}/me`).subscribe({
        next: (user) => {
          this._user.set(user)
          localStorage.setItem(USER_KEY, JSON.stringify(user))
        },
        error: () => {
          // Token expired and refresh failed — log out
          this._user.set(null)
          localStorage.removeItem(USER_KEY)
          this.router.navigate(['/login'])
        },
      })
    }, REFRESH_INTERVAL)
  }
}
