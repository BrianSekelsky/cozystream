import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Router } from '@angular/router'
import { MediaItem } from '../../models/media.model'
import { ApiService } from '../../services/api.service'
import { DisplaySettingsService } from '../../services/display-settings.service'
import { AddToCollectionModalComponent } from '../add-to-collection-modal/add-to-collection-modal.component'

@Component({
  selector: 'app-media-card',
  standalone: true,
  imports: [CommonModule, AddToCollectionModalComponent],
  templateUrl: './media-card.component.html',
})
export class MediaCardComponent implements OnInit {
  @Input({ required: true }) item!: MediaItem
  @Input() progress?: number
  @Output() favoriteToggled = new EventEmitter<{ id: number; isFavorite: boolean }>()
  @Output() watchlistToggled = new EventEmitter<{ id: number; inWatchlist: boolean }>()

  ds = inject(DisplaySettingsService)
  private api = inject(ApiService)
  private router = inject(Router)

  isFavorite = signal(false)
  inWatchlist = signal(false)
  showMenu = signal(false)
  showCollectionModal = signal(false)

  protected Math = Math

  ngOnInit() {
    this.isFavorite.set(this.item.is_favorite === 1)
    this.inWatchlist.set(this.item.in_watchlist === 1)
  }

  navigate() {
    this.router.navigate(['/detail', this.item.id])
  }

  handleFavorite(e: Event) {
    e.stopPropagation()
    this.api.toggleFavorite(this.item.id).subscribe((r) => {
      this.isFavorite.set(r.is_favorite)
      this.favoriteToggled.emit({ id: this.item.id, isFavorite: r.is_favorite })
    })
  }

  handleEdit(e: Event) {
    e.stopPropagation()
    this.router.navigate(['/edit', this.item.id])
  }

  toggleMenu(e: Event) {
    e.stopPropagation()
    this.showMenu.update((v) => !v)
  }

  handleWatchlist() {
    this.showMenu.set(false)
    this.api.toggleWatchlist(this.item.id).subscribe((r) => {
      this.inWatchlist.set(r.in_watchlist)
      this.watchlistToggled.emit({ id: this.item.id, inWatchlist: r.in_watchlist })
    })
  }

  handleAddToCollection() {
    this.showMenu.set(false)
    this.showCollectionModal.set(true)
  }

  posterCornerClass(): string {
    const c = this.ds.settings().posterCorners
    if (c === 'small') return 'rounded-lg'
    if (c === 'large') return 'rounded-2xl'
    return ''
  }

  dvdCaseCornerClass(): string {
    const c = this.ds.settings().posterCorners
    if (c === 'small') return 'rounded'
    if (c === 'large') return 'rounded-lg'
    return 'rounded-sm'
  }

  dvdSpineCornerClass(): string {
    const c = this.ds.settings().posterCorners
    if (c === 'small') return 'rounded-l'
    if (c === 'large') return 'rounded-l-lg'
    return 'rounded-l-sm'
  }

  cardTextAlignClass(): string {
    return this.ds.settings().cardTextAlign === 'center' ? 'text-center' : 'text-left'
  }
}
