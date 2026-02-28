import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { AuthService } from '../../services/auth.service'

@Component({
  selector: 'tv-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="tv-layout">
      <header class="tv-header">
        <div class="tv-logo">CozyStream</div>
        <div class="tv-header-right">
          <span class="tv-clock">{{ clock() }}</span>
          @if (auth.user(); as user) {
            <span class="tv-user">{{ user.displayName }}</span>
          }
        </div>
      </header>
      <main class="tv-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .tv-layout {
      display: flex;
      flex-direction: column;
      width: 1920px;
      height: 1080px;
      overflow: hidden;
    }
    .tv-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 3rem;
      background: rgba(0, 0, 0, 0.6);
      flex-shrink: 0;
    }
    .tv-logo {
      font-size: 1.5rem;
      font-weight: 700;
      color: #e5e5e5;
      letter-spacing: 0.02em;
    }
    .tv-header-right {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }
    .tv-clock {
      color: #999;
      font-size: 1rem;
    }
    .tv-user {
      color: #ccc;
      font-size: 1rem;
    }
    .tv-content {
      flex: 1;
      overflow: hidden;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvLayoutComponent {
  auth = inject(AuthService)
  clock = signal(this.formatTime())

  constructor() {
    // Update clock every minute
    setInterval(() => this.clock.set(this.formatTime()), 60_000)
  }

  private formatTime(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
}
