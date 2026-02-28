import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { FormsModule } from '@angular/forms'
import { TvAuthService } from '../../services/tv-auth.service'
import { TvApiService } from '../../services/tv-api.service'

@Component({
  selector: 'tv-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1 class="login-title">Sign In</h1>
        <p class="login-server">{{ serverUrl }}</p>

        <div class="login-form">
          <label class="login-label" for="username">Username</label>
          <input
            id="username"
            class="tv-input"
            type="text"
            [(ngModel)]="username"
            placeholder="Username"
            (keydown.enter)="focusPassword()"
            autocomplete="username"
            autofocus
          />

          <label class="login-label" for="password">Password</label>
          <input
            id="password"
            class="tv-input"
            type="password"
            [(ngModel)]="password"
            placeholder="Password"
            (keydown.enter)="login()"
            autocomplete="current-password"
            #passwordInput
          />

          @if (error()) {
            <p class="login-error">{{ error() }}</p>
          }

          <div class="login-actions">
            <button
              class="tv-button tv-button-primary"
              (click)="login()"
              [disabled]="loggingIn()"
              tabindex="0"
            >
              {{ loggingIn() ? 'Signing in...' : 'Sign In' }}
            </button>
            <button
              class="tv-button tv-button-secondary"
              (click)="changeServer()"
              tabindex="0"
            >
              Change Server
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1920px;
      height: 1080px;
      background: #0a0a0a;
    }
    .login-card {
      text-align: center;
      width: 500px;
    }
    .login-title {
      font-size: 2.5rem;
      font-weight: 700;
      color: #e5e5e5;
      margin-bottom: 0.25rem;
    }
    .login-server {
      font-size: 0.85rem;
      color: #666;
      margin-bottom: 2rem;
    }
    .login-form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      text-align: left;
    }
    .login-label {
      font-size: 0.9rem;
      color: #aaa;
      margin-top: 0.25rem;
    }
    .login-error {
      color: #ef4444;
      font-size: 0.9rem;
      text-align: center;
    }
    .login-actions {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 1rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvLoginComponent {
  private router = inject(Router)
  private auth = inject(TvAuthService)
  private api = inject(TvApiService)

  username = ''
  password = ''
  loggingIn = signal(false)
  error = signal('')

  get serverUrl(): string {
    return this.api.getServerUrl() ?? ''
  }

  focusPassword(): void {
    (document.getElementById('password') as HTMLInputElement)?.focus()
  }

  login(): void {
    if (!this.username || !this.password) {
      this.error.set('Please enter both username and password')
      return
    }

    this.loggingIn.set(true)
    this.error.set('')

    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.loggingIn.set(false)
        this.router.navigate(['/browse'])
      },
      error: (err) => {
        this.loggingIn.set(false)
        this.error.set(err.error?.error || 'Login failed')
      },
    })
  }

  changeServer(): void {
    this.router.navigate(['/setup'])
  }
}
