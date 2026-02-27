import {
  Component, ChangeDetectionStrategy, Input, Output, EventEmitter, inject, signal,
  ViewChild, ElementRef, OnInit, OnDestroy, AfterViewInit,
} from '@angular/core'

import { Collection, MediaItem } from '../../models/media.model'
import { MediaCardComponent } from '../media-card/media-card.component'

@Component({
    selector: 'app-collection-row',
    imports: [MediaCardComponent],
    templateUrl: './collection-row.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionRowComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) collection!: Collection
  @Input({ required: true }) items: MediaItem[] = []
  @Output() deleted = new EventEmitter<string>()
  @Output() watchlistToggle = new EventEmitter<{ id: number; inWatchlist: boolean }>()

  @ViewChild('scrollEl') scrollEl!: ElementRef<HTMLDivElement>

  canScrollLeft = signal(false)
  canScrollRight = signal(false)
  confirmDelete = signal(false)

  private ro?: ResizeObserver
  private boundUpdateScrollState = this.updateScrollState.bind(this)

  ngAfterViewInit() {
    const el = this.scrollEl?.nativeElement
    if (!el) return
    this.updateScrollState()
    el.addEventListener('scroll', this.boundUpdateScrollState, { passive: true })
    this.ro = new ResizeObserver(() => this.updateScrollState())
    this.ro.observe(el)
  }

  ngOnDestroy() {
    const el = this.scrollEl?.nativeElement
    if (el) el.removeEventListener('scroll', this.boundUpdateScrollState)
    this.ro?.disconnect()
  }

  updateScrollState() {
    const el = this.scrollEl?.nativeElement
    if (!el) return
    this.canScrollLeft.set(el.scrollLeft > 0)
    this.canScrollRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  scroll(direction: 'left' | 'right') {
    const el = this.scrollEl?.nativeElement
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const cardWidth = card ? card.offsetWidth + 12 : 200
    el.scrollBy({ left: direction === 'right' ? cardWidth * 3 : -(cardWidth * 3), behavior: 'smooth' })
  }

  handleDelete() {
    if (!this.confirmDelete()) {
      this.confirmDelete.set(true)
      setTimeout(() => this.confirmDelete.set(false), 3000)
      return
    }
    this.deleted.emit(this.collection.id)
  }
}
