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

export interface ShowGroup {
  sortTitle: string
  name: string
  posterUrl: string | null
  episodes: MediaItem[]
  seasonCount: number
}


export interface DisplaySettings {
  theme: 'dark' | 'light'
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
}

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  theme: 'dark',
  accentColor: '#e50914',
  libraryName: 'My Library',
  showDirectors: false,
  headingFont: 'sans',
  titleFont: 'sans',
  detailFont: 'sans',
  bodyFont: 'sans',
  posterCorners: 'none',
  detailLayout: 'backdrop',
  rowSpacing: 'comfortable',
  cardSize: 'medium',
  showYearUnderPoster: true,
  detailBackdropBlur: 'none',
  detailBackdropTint: true,
}
