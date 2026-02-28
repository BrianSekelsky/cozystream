import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'
import {
  MediaItem, Collection, WatchProgress, CreditsResult, AppSettings, MovieSuggestion, SeasonPosterOption,
  StreamInfo,
} from '../models/media.model'

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient)
  protected base = '/api'

  // ── Library ────────────────────────────────────────────────────────────

  getLibrary(type?: string): Observable<MediaItem[]> {
    const url = type ? `${this.base}/library?type=${type}` : `${this.base}/library`
    return this.http.get<MediaItem[]>(url)
  }

  getMediaById(id: number): Observable<MediaItem> {
    return this.http.get<MediaItem>(`${this.base}/library/${id}`)
  }

  getRecentlyAdded(): Observable<MediaItem[]> {
    return this.http.get<MediaItem[]>(`${this.base}/library/recent`)
  }

  getContinueWatching(): Observable<(MediaItem & WatchProgress)[]> {
    return this.http.get<(MediaItem & WatchProgress)[]>(`${this.base}/library/continue`)
  }

  updateMediaItem(id: number, fields: Partial<MediaItem>): Observable<MediaItem> {
    return this.http.put<MediaItem>(`${this.base}/library/${id}`, fields)
  }

  toggleFavorite(id: number): Observable<{ is_favorite: boolean }> {
    return this.http.post<{ is_favorite: boolean }>(`${this.base}/library/${id}/favorite`, {})
  }

  toggleWatchlist(id: number): Observable<{ in_watchlist: boolean }> {
    return this.http.post<{ in_watchlist: boolean }>(`${this.base}/library/${id}/watchlist`, {})
  }

  getCredits(id: number): Observable<CreditsResult> {
    return this.http.get<CreditsResult>(`${this.base}/library/${id}/credits`)
  }

  scanLibrary(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/library/scan`, {})
  }

  searchSuggestions(id: number, q?: string, year?: number): Observable<MovieSuggestion[]> {
    let params = ''
    if (q) params = `?q=${encodeURIComponent(q)}${year ? `&year=${year}` : ''}`
    return this.http.get<MovieSuggestion[]>(`${this.base}/library/${id}/search-suggestions${params}`)
  }

  applySuggestion(id: number, tmdbId: string): Observable<MediaItem> {
    return this.http.post<MediaItem>(`${this.base}/library/${id}/apply-suggestion`, { tmdb_id: tmdbId })
  }

  getSeasonPoster(tmdbId: string, seasonNumber: number): Observable<{ posterUrl: string | null }> {
    return this.http.get<{ posterUrl: string | null }>(`${this.base}/tv/${tmdbId}/season/${seasonNumber}/poster`)
  }

  getSeasonPosters(tmdbId: string, seasonNumber: number): Observable<SeasonPosterOption[]> {
    return this.http.get<SeasonPosterOption[]>(`${this.base}/tv/${tmdbId}/season/${seasonNumber}/posters`)
  }

  getMoviePosters(tmdbId: string): Observable<SeasonPosterOption[]> {
    return this.http.get<SeasonPosterOption[]>(`${this.base}/movie/${tmdbId}/posters`)
  }

  // ── Watch progress ──────────────────────────────────────────────────────

  getProgress(mediaId: number): Observable<WatchProgress> {
    return this.http.get<WatchProgress>(`${this.base}/library/${mediaId}/progress`)
  }

  saveProgress(mediaId: number, positionSeconds: number, completed = false): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/library/${mediaId}/progress`, {
      position_seconds: positionSeconds,
      completed,
    })
  }

  // ── Collections ─────────────────────────────────────────────────────────

  getCollections(): Observable<Collection[]> {
    return this.http.get<Collection[]>(`${this.base}/collections`)
  }

  createCollection(name: string): Observable<Collection> {
    return this.http.post<Collection>(`${this.base}/collections`, { name })
  }

  renameCollection(id: string, name: string): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.base}/collections/${id}`, { name })
  }

  deleteCollection(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/collections/${id}`)
  }

  addToCollection(collectionId: string, mediaItemId: number): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/collections/${collectionId}/items`, { mediaItemId })
  }

  removeFromCollection(collectionId: string, mediaItemId: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/collections/${collectionId}/items/${mediaItemId}`)
  }

  // ── Settings ─────────────────────────────────────────────────────────────

  getSettings(): Observable<AppSettings> {
    return this.http.get<AppSettings>(`${this.base}/settings`)
  }

  saveSettings(settings: Partial<AppSettings>): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/settings`, settings)
  }

  pickFolder(): Observable<{ path: string | null; cancelled: boolean }> {
    return this.http.get<{ path: string | null; cancelled: boolean }>(`${this.base}/settings/pick-folder`)
  }

  // ── Streaming ────────────────────────────────────────────────────────────

  streamUrl(id: number): string {
    return `${this.base}/stream/${id}`
  }

  getStreamInfo(id: number): Observable<StreamInfo> {
    return this.http.get<StreamInfo>(`${this.base}/stream/${id}/info`)
  }

  subtitleUrl(mediaId: number, trackIndex: number): string {
    return `${this.base}/stream/${mediaId}/subtitles/${trackIndex}`
  }

  killHlsSession(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/stream/${id}/hls`)
  }
}
