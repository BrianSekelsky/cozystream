import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core'
import { Router } from '@angular/router'
import { HttpClient } from '@angular/common/http'
import { FormsModule } from '@angular/forms'
import { TvApiService } from '../../services/tv-api.service'
import { TvAuthService } from '../../services/tv-auth.service'

@Component({
  selector: 'tv-setup',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="setup-container">
      <div class="setup-card">
        <h1 class="setup-title">CozyStream</h1>
        <p class="setup-subtitle">Enter your server address to get started</p>

        <div class="setup-form">
          <label class="setup-label" for="serverUrl">Server URL</label>
          <input
            id="serverUrl"
            class="tv-input"
            type="url"
            [(ngModel)]="serverUrl"
            placeholder="http://192.168.1.100:3001"
            (keydown.enter)="testConnection()"
            autofocus
          />

          @if (error()) {
            <p class="setup-error">{{ error() }}</p>
          }
          @if (testing()) {
            <p class="setup-status">Connecting...</p>
          }

          <button
            class="tv-button tv-button-primary setup-btn"
            (click)="testConnection()"
            [disabled]="testing()"
            tabindex="0"
          >
            Connect
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .setup-container {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1920px;
      height: 1080px;
      background: #0a0a0a;
    }
    .setup-card {
      text-align: center;
      width: 600px;
    }
    .setup-title {
      font-size: 3rem;
      font-weight: 700;
      color: #e5e5e5;
      margin-bottom: 0.5rem;
    }
    .setup-subtitle {
      font-size: 1.1rem;
      color: #888;
      margin-bottom: 2.5rem;
    }
    .setup-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      text-align: left;
    }
    .setup-label {
      font-size: 0.9rem;
      color: #aaa;
    }
    .setup-error {
      color: #ef4444;
      font-size: 0.9rem;
    }
    .setup-status {
      color: #6366f1;
      font-size: 0.9rem;
    }
    .setup-btn {
      margin-top: 0.5rem;
      align-self: center;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvSetupComponent {
  private router = inject(Router)
  private http = inject(HttpClient)
  private api = inject(TvApiService)
  private auth = inject(TvAuthService)

  serverUrl = ''
  testing = signal(false)
  error = signal('')

  constructor() {
    // Pre-fill if we already have a server URL
    const existing = this.api.getServerUrl()
    if (existing) this.serverUrl = existing
  }

  testConnection(): void {
    const url = this.serverUrl.trim().replace(/\/+$/, '')
    if (!url) {
      this.error.set('Please enter a server URL')
      return
    }

    this.testing.set(true)
    this.error.set('')

    this.http.get<{ status: string }>(`${url}/health`).subscribe({
      next: (res) => {
        if (res.status === 'ok') {
          this.api.setServerUrl(url)
          this.auth.updateBaseUrl()
          this.testing.set(false)
          this.router.navigate(['/login'])
        } else {
          this.testing.set(false)
          this.error.set('Server responded but is not a CozyStream server')
        }
      },
      error: () => {
        this.testing.set(false)
        this.error.set('Could not connect. Check the URL and make sure the server is running.')
      },
    })
  }
}
