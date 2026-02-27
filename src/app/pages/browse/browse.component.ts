import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, OnDestroy } from '@angular/core'

import { FormsModule } from '@angular/forms'
import { Router, ActivatedRoute } from '@angular/router'
import { Subscription } from 'rxjs'
import { ApiService } from '../../services/api.service'
import { DisplaySettingsService } from '../../services/display-settings.service'
import { RowOrderService, mergeRowOrder } from '../../services/row-order.service'
import { CollectionsService, matchesFilter } from '../../services/collections.service'
import { MediaCardComponent } from '../../components/media-card/media-card.component'
import { CollectionRowComponent } from '../../components/collection-row/collection-row.component'
import { FilterRowComponent } from '../../components/filter-row/filter-row.component'
import { ShowCardComponent } from '../../components/show-card/show-card.component'
import { SeasonCardComponent } from '../../components/season-card/season-card.component'
import { EpisodeRowComponent } from '../../components/episode-row/episode-row.component'
import { SeasonPosterPickerComponent } from '../../components/season-poster-picker/season-poster-picker.component'
import { MediaItem, Collection, ShowGroup } from '../../models/media.model'

// ─── TV helpers ──────────────────────────────────────────────────────────────

function extractShowName(title: string): string {
  const m = title.match(/^(.+?)\s+-\s+S\d{1,2}E\d{1,2}/i)
  return m ? m[1].trim() : title
}

function extractSeason(title: string): number {
  const m = title.match(/S(\d{1,2})E\d{1,2}/i)
  return m ? parseInt(m[1]) : 0
}

function extractEpisodeNum(title: string): number {
  const m = title.match(/S\d{1,2}E(\d{1,2})/i)
  return m ? parseInt(m[1]) : 0
}

type Filter = 'movie' | 'episode'
type TvView = 'shows' | 'seasons' | 'episodes'

@Component({
    selector: 'app-browse',
    imports: [
    FormsModule,
    MediaCardComponent,
    CollectionRowComponent,
    FilterRowComponent,
    ShowCardComponent,
    SeasonCardComponent,
    EpisodeRowComponent,
    SeasonPosterPickerComponent
],
    templateUrl: './browse.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrowseComponent implements OnInit, OnDestroy {
  ds = inject(DisplaySettingsService)
  private api = inject(ApiService)
  private router = inject(Router)
  private route = inject(ActivatedRoute)
  rowOrderService = inject(RowOrderService)
  collectionsService = inject(CollectionsService)

  loading = signal(true)
  allItems = signal<MediaItem[]>([])
  search = signal('')

  filter = signal<Filter>('movie')
  tvView = signal<TvView>('shows')
  selectedShow = signal<ShowGroup | null>(null)
  selectedSeason = signal<number | null>(null)
  seasonPosters = signal<Record<number, string | null>>({})
  editingSeason = signal<number | null>(null)

  private static OVERRIDES_KEY = 'cozystream:season-poster-overrides'
  private queryParamSub?: Subscription

  watchlistItems = computed(() => this.allItems().filter((i) => i.in_watchlist === 1))

  filteredMovies = computed(() => {
    const q = this.search().toLowerCase()
    return this.allItems().filter(
      (i) => i.type === 'movie' && (!q || i.title.toLowerCase().includes(q))
    )
  })

  showGroups = computed((): ShowGroup[] => {
    const episodes = this.allItems().filter((i) => i.type === 'episode')
    const groups = new Map<string, ShowGroup>()
    for (const ep of episodes) {
      const key = ep.sort_title ?? extractShowName(ep.title).toLowerCase()
      if (!groups.has(key)) {
        groups.set(key, { sortTitle: key, name: extractShowName(ep.title), posterUrl: ep.poster_url, episodes: [], seasonCount: 0 })
      }
      groups.get(key)!.episodes.push(ep)
    }
    for (const g of groups.values()) {
      g.seasonCount = new Set(g.episodes.map((e) => extractSeason(e.title))).size
    }
    const q = this.search().toLowerCase()
    return Array.from(groups.values())
      .filter((g) => !q || g.name.toLowerCase().includes(q))
      .sort((a, b) => a.sortTitle.localeCompare(b.sortTitle))
  })

  seasonGroups = computed((): Record<number, MediaItem[]> => {
    const show = this.selectedShow()
    if (!show) return {}
    const grouped: Record<number, MediaItem[]> = {}
    for (const ep of show.episodes) {
      const s = extractSeason(ep.title)
      if (!grouped[s]) grouped[s] = []
      grouped[s].push(ep)
    }
    return grouped
  })

  seasonEpisodes = computed((): MediaItem[] => {
    const season = this.selectedSeason()
    if (season === null) return []
    return (this.seasonGroups()[season] ?? [])
      .slice()
      .sort((a, b) => extractEpisodeNum(a.title) - extractEpisodeNum(b.title))
  })

  orderedRows = computed(() =>
    mergeRowOrder(
      this.rowOrderService.rawOrder(),
      this.collectionsService.collections().map((c) => c.id),
    )
  )

  seasonNumbers = computed(() =>
    Object.keys(this.seasonGroups()).map(Number).sort((a, b) => a - b)
  )

  hasShows = computed(() => this.allItems().some((i) => i.type === 'episode'))

  movieGridClass = computed(() => {
    const size = this.ds.settings().cardSize
    const base = 'grid gap-y-8'
    if (size === 'small') return `${base} grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10`
    if (size === 'large') return `${base} grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`
    return `${base} grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8`
  })

  ngOnInit() {
    this.api.getLibrary().subscribe({
      next: (items) => { this.allItems.set(items); this.loading.set(false) },
      error: () => this.loading.set(false),
    })
    this.collectionsService.loadCollections()

    // Read search query from URL params (synced from Layout's search input)
    this.queryParamSub = this.route.queryParams.subscribe((params) => {
      this.search.set(params['q'] ?? '')
    })
  }

  ngOnDestroy() {
    this.queryParamSub?.unsubscribe()
  }

  getCollection(id: string): Collection | undefined {
    return this.collectionsService.collections().find((c) => c.id === id)
  }

  rowItems(col: Collection): MediaItem[] {
    if (col.filterType) {
      return this.filteredMovies().filter((i) => matchesFilter(i, col))
    }
    const idSet = new Set(col.itemIds)
    return this.allItems().filter((i) => idSet.has(i.id))
  }

  setFilterMovie() { this.setFilter('movie') }
  setFilterEpisode() { this.setFilter('episode') }
  isMovieFilter() { return this.filter() === 'movie' }
  isEpisodeFilter() { return this.filter() === 'episode' }

  goToSettings() { this.router.navigate(['/settings']) }

  setFilter(f: Filter) {
    this.filter.set(f)
    this.router.navigate(['/browse'], { queryParams: {}, replaceUrl: true })
    this.tvView.set('shows')
    this.selectedShow.set(null)
    this.selectedSeason.set(null)
  }

  openShow(show: ShowGroup) {
    this.selectedShow.set(show)
    this.tvView.set('seasons')
    this.selectedSeason.set(null)
    this.editingSeason.set(null)

    // Load localStorage overrides first so they display immediately
    const tmdbId = show.episodes[0]?.tmdb_id
    const overrides = tmdbId ? this.loadOverrides(tmdbId) : {}
    this.seasonPosters.set(overrides)

    this.router.navigate(['/browse'], { queryParams: {}, replaceUrl: true })
    this.loadSeasonPosters(show)
  }

  private loadSeasonPosters(show: ShowGroup) {
    const tmdbId = show.episodes[0]?.tmdb_id
    if (!tmdbId) return
    const overrides = this.loadOverrides(tmdbId)
    const seasons = new Set(show.episodes.map((e) => extractSeason(e.title)))
    for (const season of seasons) {
      // Skip TMDB fetch for seasons that have a user override
      if (overrides[season]) continue
      this.api.getSeasonPoster(tmdbId, season).subscribe({
        next: (res) => {
          if (res.posterUrl) {
            this.seasonPosters.update((prev) => ({ ...prev, [season]: res.posterUrl }))
          }
        },
      })
    }
  }

  openSeason(season: number) {
    this.selectedSeason.set(season)
    this.tvView.set('episodes')
  }

  goBackToShows() {
    this.tvView.set('shows')
    this.selectedShow.set(null)
    this.selectedSeason.set(null)
  }

  seasonPoster(season: number): string | null {
    const tmdbPoster = this.seasonPosters()[season]
    if (tmdbPoster) return tmdbPoster
    return this.selectedShow()?.posterUrl ?? null
  }

  goBackToSeasons() {
    this.tvView.set('seasons')
    this.selectedSeason.set(null)
  }

  handleWatchlistToggle(event: { id: number; inWatchlist: boolean }) {
    this.allItems.update((items) =>
      items.map((i) => i.id === event.id ? { ...i, in_watchlist: event.inWatchlist ? 1 : 0 } : i)
    )
  }

  handleCollectionDeleted(id: string) {
    this.collectionsService.removeCollection(id)
  }

  // ── Season poster picker ──────────────────────────────────────────────

  openPosterPicker(season: number) {
    this.editingSeason.set(season)
  }

  closePosterPicker() {
    this.editingSeason.set(null)
  }

  handlePosterSelected(url: string) {
    const season = this.editingSeason()
    if (season === null) return
    const tmdbId = this.selectedShow()?.episodes[0]?.tmdb_id
    this.seasonPosters.update((prev) => ({ ...prev, [season]: url }))
    this.editingSeason.set(null)
    if (tmdbId) this.saveOverride(tmdbId, season, url)
  }

  currentShowTmdbId(): string | null {
    return this.selectedShow()?.episodes[0]?.tmdb_id ?? null
  }

  // ── localStorage overrides ────────────────────────────────────────────

  private loadOverrides(tmdbId: string): Record<number, string> {
    try {
      const raw = localStorage.getItem(BrowseComponent.OVERRIDES_KEY)
      if (!raw) return {}
      const all = JSON.parse(raw) as Record<string, Record<number, string>>
      return all[tmdbId] ?? {}
    } catch {
      return {}
    }
  }

  private saveOverride(tmdbId: string, season: number, url: string) {
    try {
      const raw = localStorage.getItem(BrowseComponent.OVERRIDES_KEY)
      const all: Record<string, Record<number, string>> = raw ? JSON.parse(raw) : {}
      if (!all[tmdbId]) all[tmdbId] = {}
      all[tmdbId][season] = url
      localStorage.setItem(BrowseComponent.OVERRIDES_KEY, JSON.stringify(all))
    } catch { /* ignore */ }
  }
}
