import {
  Component, ChangeDetectionStrategy, Input, ElementRef, ViewChild, AfterViewInit,
} from '@angular/core'
import { Router } from '@angular/router'
import { TvMediaCardComponent } from './tv-media-card.component'
import type { MediaItem, WatchProgress } from '../../models/media.model'

@Component({
  selector: 'tv-collection-row',
  standalone: true,
  imports: [TvMediaCardComponent],
  template: `
    <div class="tv-row">
      <h2 class="tv-row-title">{{ title }}</h2>
      <div class="tv-row-scroll" #scrollContainer>
        @for (item of items; track item.id) {
          <tv-media-card
            [item]="item"
            [subtitle]="getSubtitle(item)"
            (click)="onCardClick(item)"
            (keydown.enter)="onCardClick(item)"
          />
        }
        @if (items.length === 0) {
          <div class="tv-row-empty">No items</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .tv-row {
      margin-bottom: 1.5rem;
    }
    .tv-row-title {
      font-size: 1.2rem;
      font-weight: 600;
      color: #e5e5e5;
      margin: 0 0 0.75rem 3rem;
    }
    .tv-row-scroll {
      display: flex;
      gap: 1rem;
      padding: 0.5rem 3rem;
      overflow-x: auto;
      scroll-behavior: smooth;
      scrollbar-width: none;
    }
    .tv-row-scroll::-webkit-scrollbar {
      display: none;
    }
    .tv-row-empty {
      color: #555;
      font-size: 0.9rem;
      padding: 2rem;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvCollectionRowComponent implements AfterViewInit {
  @Input() title = ''
  @Input() items: (MediaItem & Partial<WatchProgress>)[] = []
  @Input() showYear = false

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>

  constructor(private router: Router) {}

  ngAfterViewInit(): void {
    // When a card inside this row gets focus, scroll it into view
    const container = this.scrollContainer?.nativeElement
    if (!container) return

    container.addEventListener('focusin', (e: FocusEvent) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('tv-focusable') || target.closest('.tv-focusable')) {
        const card = target.closest('.tv-card') as HTMLElement
        if (card) {
          const containerRect = container.getBoundingClientRect()
          const cardRect = card.getBoundingClientRect()
          // Scroll to center the focused card
          const scrollLeft = card.offsetLeft - containerRect.width / 2 + cardRect.width / 2
          container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' })
        }
      }
    })
  }

  onCardClick(item: MediaItem): void {
    this.router.navigate(['/detail', item.id])
  }

  getSubtitle(item: MediaItem): string {
    if (this.showYear && item.year) return String(item.year)
    return ''
  }
}
