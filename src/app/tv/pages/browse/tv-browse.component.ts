import {
  Component, ChangeDetectionStrategy, inject, signal, OnInit, computed,
} from '@angular/core'
import { ApiService } from '../../../services/api.service'
import { TvCollectionRowComponent } from '../../components/tv-collection-row.component'
import type { MediaItem, WatchProgress, Collection } from '../../../models/media.model'

@Component({
  selector: 'tv-browse',
  standalone: true,
  imports: [TvCollectionRowComponent],
  template: `
    <div class="browse-container">
      @if (loading()) {
        <div class="browse-loading">Loading library...</div>
      } @else {
        <div class="browse-rows">
          @if (continueWatching().length > 0) {
            <tv-collection-row title="Continue Watching" [items]="continueWatching()" />
          }
          @if (recentlyAdded().length > 0) {
            <tv-collection-row title="Recently Added" [items]="recentlyAdded()" [showYear]="true" />
          }
          @if (favorites().length > 0) {
            <tv-collection-row title="Favorites" [items]="favorites()" [showYear]="true" />
          }
          @for (collection of collections(); track collection.id) {
            @if (collectionItems(collection).length > 0) {
              <tv-collection-row [title]="collection.name" [items]="collectionItems(collection)" />
            }
          }
          @if (movies().length > 0) {
            <tv-collection-row title="All Movies" [items]="movies()" [showYear]="true" />
          }
          @if (tvEpisodes().length > 0) {
            <tv-collection-row title="TV Shows" [items]="tvEpisodes()" />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .browse-container {
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 1.5rem 0;
      scroll-behavior: smooth;
      scrollbar-width: none;
    }
    .browse-container::-webkit-scrollbar {
      display: none;
    }
    .browse-rows {
      display: flex;
      flex-direction: column;
    }
    .browse-loading {
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
export class TvBrowseComponent implements OnInit {
  private api = inject(ApiService)

  loading = signal(true)
  allItems = signal<MediaItem[]>([])
  continueWatching = signal<(MediaItem & WatchProgress)[]>([])
  recentlyAdded = signal<MediaItem[]>([])
  collections = signal<Collection[]>([])

  favorites = computed(() =>
    this.allItems().filter((i) => i.is_favorite && i.type === 'movie')
  )

  movies = computed(() =>
    this.allItems().filter((i) => i.type === 'movie')
  )

  tvEpisodes = computed(() =>
    this.allItems().filter((i) => i.type === 'episode')
  )

  ngOnInit(): void {
    // Fetch all data in parallel
    this.api.getContinueWatching().subscribe({
      next: (items) => this.continueWatching.set(items),
    })

    this.api.getRecentlyAdded().subscribe({
      next: (items) => this.recentlyAdded.set(items),
    })

    this.api.getCollections().subscribe({
      next: (collections) => this.collections.set(collections),
    })

    this.api.getLibrary().subscribe({
      next: (items) => {
        this.allItems.set(items)
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  collectionItems(collection: Collection): MediaItem[] {
    const all = this.allItems()
    return collection.itemIds
      .map((id) => all.find((i) => i.id === id))
      .filter((i): i is MediaItem => !!i)
  }
}
