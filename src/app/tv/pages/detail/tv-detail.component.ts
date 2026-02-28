import {
  Component, ChangeDetectionStrategy, inject, signal, OnInit,
} from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ApiService } from '../../../services/api.service'
import type { MediaItem, WatchProgress } from '../../../models/media.model'

@Component({
  selector: 'tv-detail',
  standalone: true,
  template: `
    @if (item(); as media) {
      <div class="detail-container">
        <!-- Backdrop -->
        @if (media.backdrop_url) {
          <div class="detail-backdrop">
            <img [src]="media.backdrop_url" [alt]="media.title" class="detail-backdrop-img" />
            <div class="detail-backdrop-gradient"></div>
          </div>
        }

        <div class="detail-content">
          <!-- Poster -->
          @if (media.poster_url) {
            <div class="detail-poster">
              <img [src]="media.poster_url" [alt]="media.title" class="detail-poster-img" />
            </div>
          }

          <!-- Info -->
          <div class="detail-info">
            <h1 class="detail-title">{{ media.title }}</h1>

            <div class="detail-meta">
              @if (media.year) {
                <span>{{ media.year }}</span>
              }
              @if (media.genre) {
                <span>{{ media.genre }}</span>
              }
              @if (media.duration) {
                <span>{{ formatDuration(media.duration) }}</span>
              }
            </div>

            @if (media.description) {
              <p class="detail-description">{{ media.description }}</p>
            }

            @if (media.director) {
              <p class="detail-director">Directed by {{ media.director }}</p>
            }

            <!-- Progress -->
            @if (progress(); as prog) {
              @if (prog.position_seconds > 0 && !prog.completed) {
                <div class="detail-progress">
                  <div class="detail-progress-bar">
                    <div
                      class="detail-progress-fill"
                      [style.width.%]="progressPercent()"
                    ></div>
                  </div>
                  <span class="detail-progress-text">{{ formatTime(prog.position_seconds) }} remaining</span>
                </div>
              }
            }

            <!-- Actions -->
            <div class="detail-actions">
              <button
                class="tv-button tv-button-primary"
                (click)="play()"
                tabindex="0"
                autofocus
              >
                @if (canResume()) {
                  Resume
                } @else {
                  Play
                }
              </button>

              <button
                class="tv-button tv-button-secondary"
                (click)="toggleFavorite()"
                tabindex="0"
              >
                {{ media.is_favorite ? 'Unfavorite' : 'Favorite' }}
              </button>

              <button
                class="tv-button tv-button-secondary"
                (click)="toggleWatchlist()"
                tabindex="0"
              >
                {{ media.in_watchlist ? 'Remove from List' : 'Add to List' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    } @else if (loading()) {
      <div class="detail-loading">Loading...</div>
    }
  `,
  styles: [`
    .detail-container {
      position: relative;
      width: 1920px;
      height: 100%;
      overflow: hidden;
    }
    .detail-backdrop {
      position: absolute;
      inset: 0;
    }
    .detail-backdrop-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.3;
    }
    .detail-backdrop-gradient {
      position: absolute;
      inset: 0;
      background: linear-gradient(to right, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.7) 50%, rgba(10,10,10,0.4) 100%);
    }
    .detail-content {
      position: relative;
      z-index: 1;
      display: flex;
      gap: 3rem;
      padding: 3rem;
      height: 100%;
      align-items: flex-start;
    }
    .detail-poster {
      flex-shrink: 0;
      width: 300px;
    }
    .detail-poster-img {
      width: 100%;
      border-radius: 0.5rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .detail-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 800px;
    }
    .detail-title {
      font-size: 2.5rem;
      font-weight: 700;
      color: #fff;
      margin: 0;
      line-height: 1.2;
    }
    .detail-meta {
      display: flex;
      gap: 1.5rem;
      font-size: 1rem;
      color: #aaa;
    }
    .detail-description {
      font-size: 1rem;
      color: #ccc;
      line-height: 1.6;
      max-height: 8rem;
      overflow: hidden;
      margin: 0;
    }
    .detail-director {
      font-size: 0.9rem;
      color: #888;
      margin: 0;
    }
    .detail-progress {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .detail-progress-bar {
      width: 200px;
      height: 4px;
      background: #333;
      border-radius: 2px;
      overflow: hidden;
    }
    .detail-progress-fill {
      height: 100%;
      background: var(--accent-color, #6366f1);
    }
    .detail-progress-text {
      font-size: 0.85rem;
      color: #888;
    }
    .detail-actions {
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }
    .detail-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 1.2rem;
      color: #888;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvDetailComponent implements OnInit {
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private api = inject(ApiService)

  item = signal<MediaItem | null>(null)
  progress = signal<WatchProgress | null>(null)
  loading = signal(true)

  canResume = signal(false)

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'))

    this.api.getMediaById(id).subscribe({
      next: (media) => {
        this.item.set(media)
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })

    this.api.getProgress(id).subscribe({
      next: (prog) => {
        this.progress.set(prog)
        this.canResume.set(prog.position_seconds > 0 && !prog.completed)
      },
      error: () => {},
    })
  }

  play(): void {
    const media = this.item()
    if (!media) return

    const prog = this.progress()
    const startPosition = this.canResume() && prog ? prog.position_seconds : 0

    this.router.navigate(['/player', media.id], {
      state: { startPosition },
    })
  }

  toggleFavorite(): void {
    const media = this.item()
    if (!media) return
    this.api.toggleFavorite(media.id).subscribe({
      next: (res) => {
        this.item.set({ ...media, is_favorite: res.is_favorite ? 1 : 0 })
      },
    })
  }

  toggleWatchlist(): void {
    const media = this.item()
    if (!media) return
    this.api.toggleWatchlist(media.id).subscribe({
      next: (res) => {
        this.item.set({ ...media, in_watchlist: res.in_watchlist ? 1 : 0 })
      },
    })
  }

  progressPercent(): number {
    const prog = this.progress()
    const media = this.item()
    if (!prog || !media?.duration) return 0
    return Math.min(100, (prog.position_seconds / media.duration) * 100)
  }

  formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  formatTime(seconds: number): string {
    const dur = this.item()?.duration ?? 0
    const remaining = Math.max(0, dur - seconds)
    return this.formatDuration(remaining)
  }
}
