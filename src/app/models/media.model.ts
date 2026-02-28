export interface MediaItem {
  id: number
  title: string
  sort_title: string | null
  type: 'movie' | 'show' | 'episode' | 'song' | 'album'
  year: number | null
  genre: string | null
  file_path: string | null
  file_size: number | null
  duration: number | null
  codec_info: string | null
  tmdb_id: string | null
  poster_url: string | null
  backdrop_url: string | null
  description: string | null
  rating: number | null
  director: string | null
  is_favorite: number
  in_watchlist: number
  added_at: string
}

export interface Collection {
  id: string
  name: string
  itemIds: number[]
  isManual: boolean
  // Filter-based collection fields (optional)
  filterType?: 'genre' | 'director' | 'decade'
  filterValue?: string
}

export interface WatchProgress {
  position_seconds: number
  completed: number | boolean
  updated_at?: string
}

export interface CreditsPerson {
  name: string
  character?: string
  job?: string
  profileUrl: string | null
}

export interface CrewCategory {
  label: string
  people: CreditsPerson[]
}

export interface CreditsResult {
  directors: CreditsPerson[]
  crewCategories: CrewCategory[]
  cast: CreditsPerson[]
  genres: string[]
  language: string | null
}

export interface AppSettings {
  library_paths: string[]
  tmdb_api_key: string
}

export interface MovieSuggestion {
  tmdbId: string
  title: string
  year: number | null
  posterUrl: string | null
  description: string | null
}

export interface SeasonPosterOption {
  url: string
  language: string | null
  voteAverage: number
  voteCount: number
}

// ── Stream info (from /api/stream/:id/info) ──────────────────────────────

export interface AudioTrackInfo {
  index: number
  codec: string
  language: string | null
  channels: number
  title: string | null
}

export interface SubtitleTrackInfo {
  index: number
  codec: string
  language: string | null
  title: string | null
  forced: boolean
  extractable: boolean
}

export interface ExternalSubtitleInfo {
  index: number
  language: string | null
  forced: boolean
  format: string
}

export interface StreamInfo {
  canDirectPlay: boolean
  codecInfo: any | null
  duration: number | null
  audioTracks: AudioTrackInfo[]
  subtitleTracks: SubtitleTrackInfo[]
  externalSubtitles: ExternalSubtitleInfo[]
  directPlayUrl: string
  hlsUrl: string
}

// A unified subtitle entry for the player UI
export interface PlayerSubtitleTrack {
  index: number
  label: string
  language: string | null
  type: 'embedded' | 'external'
}

export interface ShowGroup {
  sortTitle: string
  name: string
  posterUrl: string | null
  episodes: MediaItem[]
  seasonCount: number
}


export type ColorScheme = 'default' | 'midnight' | 'ember' | 'forest' | 'rose' | 'slate'

export interface DisplaySettings {
  theme: 'dark' | 'light'
  colorScheme: ColorScheme
  accentColor: string
  libraryName: string
  showDirectors: boolean
  headingFont: 'sans' | 'serif' | 'mono'
  titleFont: 'sans' | 'serif' | 'mono'
  detailFont: 'sans' | 'serif' | 'mono'
  bodyFont: 'sans' | 'serif' | 'mono'
  posterCorners: 'none' | 'small' | 'large'
  detailLayout: 'backdrop' | 'poster-header' | 'none'
  rowSpacing: 'compact' | 'comfortable' | 'spacious'
  cardSize: 'small' | 'medium' | 'large'
  showYearUnderPoster: boolean
  detailBackdropBlur: 'none' | 'light' | 'heavy'
  detailBackdropTint: boolean
  browseStyle: 'default' | 'dvd-case'
  cardGap: 'compact' | 'comfortable' | 'spacious'
  cardTextAlign: 'left' | 'center'
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: 'dark',
  colorScheme: 'default',
  accentColor: '#e50914',
  libraryName: 'My Library',
  showDirectors: true,
  headingFont: 'serif',
  titleFont: 'sans',
  detailFont: 'mono',
  bodyFont: 'sans',
  posterCorners: 'none',
  detailLayout: 'poster-header',
  rowSpacing: 'comfortable',
  cardSize: 'large',
  showYearUnderPoster: true,
  detailBackdropBlur: 'none',
  detailBackdropTint: true,
  browseStyle: 'dvd-case',
  cardGap: 'comfortable',
  cardTextAlign: 'center',
}
