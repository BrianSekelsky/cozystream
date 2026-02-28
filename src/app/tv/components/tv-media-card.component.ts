import { Component, ChangeDetectionStrategy, Input, computed, signal } from '@angular/core'
import type { MediaItem, WatchProgress } from '../../models/media.model'

@Component({
  selector: 'tv-media-card',
  standalone: true,
  template: `
    <div
      class="tv-card tv-focusable"
      [tabindex]="0"
      [attr.data-media-id]="item?.id"
    >
      <div class="tv-card-poster">
        @if (item?.poster_url) {
          <img
            [src]="item!.poster_url"
            [alt]="item!.title"
            loading="lazy"
            class="tv-card-img"
          />
        } @else {
          <div class="tv-card-placeholder">
            <span>{{ item?.title?.charAt(0) || '?' }}</span>
          </div>
        }
        @if (progressPercent() > 0 && progressPercent() < 95) {
          <div class="tv-card-progress">
            <div class="tv-card-progress-bar" [style.width.%]="progressPercent()"></div>
          </div>
        }
      </div>
      <div class="tv-card-title">{{ item?.title || 'Untitled' }}</div>
      @if (subtitle) {
        <div class="tv-card-subtitle">{{ subtitle }}</div>
      }
    </div>
  `,
  styles: [`
    .tv-card {
      display: flex;
      flex-direction: column;
      width: 220px;
      flex-shrink: 0;
      cursor: pointer;
      border-radius: 0.5rem;
      padding: 0.25rem;
    }
    .tv-card-poster {
      position: relative;
      width: 100%;
      aspect-ratio: 2/3;
      border-radius: 0.5rem;
      overflow: hidden;
      background: #1a1a1a;
    }
    .tv-card-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .tv-card-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      color: #555;
      background: #1a1a1a;
    }
    .tv-card-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: rgba(0, 0, 0, 0.6);
    }
    .tv-card-progress-bar {
      height: 100%;
      background: var(--accent-color, #6366f1);
    }
    .tv-card-title {
      margin-top: 0.5rem;
      font-size: 0.85rem;
      color: #ccc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tv-card-subtitle {
      font-size: 0.75rem;
      color: #888;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvMediaCardComponent {
  @Input() item?: MediaItem & Partial<WatchProgress>
  @Input() subtitle?: string

  progressPercent = computed(() => {
    const item = this.item
    if (!item) return 0
    const pos = (item as any).position_seconds ?? 0
    const dur = item.duration ?? 0
    if (dur <= 0 || pos <= 0) return 0
    return (pos / dur) * 100
  })
}
