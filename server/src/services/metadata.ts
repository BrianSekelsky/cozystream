import { MovieDb } from 'moviedb-promise'
import { stripJunkTokens } from '../utils/fileUtils'

export interface MetadataResult {
  /** Official title from TMDB — use this for display instead of the parsed filename. */
  title: string
  tmdbId: string
  posterUrl: string | null
  backdropUrl: string | null
  description: string | null
  year: number | null
  genre: string | null
  rating: number | null
  director: string | null
  duration: number | null
}

const IMAGE_BASE = 'https://image.tmdb.org/t/p'

function imgUrl(size: string, p?: string | null): string | null {
  return p ? `${IMAGE_BASE}/${size}${p}` : null
}

function getClient(): MovieDb | null {
  const key = process.env.TMDB_API_KEY
  if (!key) return null
  return new MovieDb(key)
}

// ---------------------------------------------------------------------------
// Single movie search attempt — returns null on no results (doesn't throw)
// ---------------------------------------------------------------------------
async function tryMovieSearch(
  client: MovieDb,
  query: string,
  year?: number | null
): Promise<MetadataResult | null> {
  if (!query.trim()) return null
  try {
    const { results } = await client.searchMovie({ query, year: year ?? undefined })
    const hit = results?.[0]
    if (!hit?.id) return null

    const details = await client.movieInfo({ id: hit.id, append_to_response: 'credits' })
    const crew: Array<{ job: string; name: string }> = (details as any).credits?.crew ?? []
    const director = crew.filter((c) => c.job === 'Director').map((c) => c.name).join(', ') || null
    return {
      title: details.title ?? details.original_title ?? query,
      tmdbId: String(details.id),
      posterUrl: imgUrl('w500', details.poster_path),
      backdropUrl: imgUrl('w1280', details.backdrop_path),
      description: details.overview ?? null,
      year: details.release_date ? parseInt(details.release_date.split('-')[0]) : null,
      genre: details.genres?.map((g) => g.name).join(', ') || null,
      rating: details.vote_average ?? null,
      duration: details.runtime ? details.runtime * 60 : null,
      director,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Movie metadata — 5-step fallback chain
// ---------------------------------------------------------------------------
export async function fetchMovieMetadata(
  title: string,
  year?: number | null,
  titleAfterYear?: string | null,
  folderTitle?: string | null,
): Promise<MetadataResult | null> {
  const client = getClient()
  if (!client) return null

  // Step 1: title + year (most specific)
  if (year) {
    const result = await tryMovieSearch(client, title, year)
    if (result) {
      console.log(`[metadata] ✓ "${title}" (${year}) matched on step 1`)
      return result
    }
  }

  // Step 2: title without year
  {
    const result = await tryMovieSearch(client, title)
    if (result) {
      console.log(`[metadata] ✓ "${title}" matched on step 2 (no year)`)
      return result
    }
  }

  // Step 3: strip remaining ALL-CAPS junk (e.g. "AUDIO", "pseudo") and retry
  const stripped = stripRemainingJunk(title)
  if (stripped !== title) {
    const result = await tryMovieSearch(client, stripped, year ?? undefined)
      ?? await tryMovieSearch(client, stripped)
    if (result) {
      console.log(`[metadata] ✓ "${title}" → "${stripped}" matched on step 3 (junk stripped)`)
      return result
    }
  }

  // Step 4: progressively drop words from the end
  const words = (stripped || title).split(' ').filter(Boolean)
  for (let end = words.length - 1; end >= Math.max(2, words.length - 4); end--) {
    const shorter = words.slice(0, end).join(' ')
    const result = await tryMovieSearch(client, shorter, year ?? undefined)
      ?? await tryMovieSearch(client, shorter)
    if (result) {
      console.log(`[metadata] ✓ "${title}" → "${shorter}" matched on step 4 (word trim)`)
      return result
    }
  }

  // Step 5: try the text AFTER the year boundary.
  // Handles filenames like "Director.Name.2021.Movie.Title.mkv" where the
  // real title sits after the year, not before it.
  if (titleAfterYear) {
    const result = await tryMovieSearch(client, titleAfterYear, year ?? undefined)
      ?? await tryMovieSearch(client, titleAfterYear)
    if (result) {
      console.log(`[metadata] ✓ "${title}" matched via post-year text "${titleAfterYear}" on step 5`)
      return result
    }

    // Step 5b: word-trim the after-year text too
    const afterWords = titleAfterYear.split(' ').filter(Boolean)
    for (let end = afterWords.length - 1; end >= Math.max(2, afterWords.length - 3); end--) {
      const shorter = afterWords.slice(0, end).join(' ')
      const result = await tryMovieSearch(client, shorter, year ?? undefined)
        ?? await tryMovieSearch(client, shorter)
      if (result) {
        console.log(`[metadata] ✓ "${title}" → "${shorter}" (post-year trim) matched on step 5b`)
        return result
      }
    }
  }

  // Step 6: try the parent folder name as the title.
  // Handles cases like TCTTHWAHL.mkv inside "The Cat That..." folder, or
  // files whose name is completely opaque (IDs, acronyms, etc.).
  if (folderTitle && folderTitle !== title) {
    const result = await tryMovieSearch(client, folderTitle, year ?? undefined)
      ?? await tryMovieSearch(client, folderTitle)
    if (result) {
      console.log(`[metadata] ✓ "${title}" matched via folder name "${folderTitle}" on step 6`)
      return result
    }

    // Step 6b: word-trim the folder title too
    const folderWords = folderTitle.split(' ').filter(Boolean)
    for (let end = folderWords.length - 1; end >= Math.max(2, folderWords.length - 3); end--) {
      const shorter = folderWords.slice(0, end).join(' ')
      const result = await tryMovieSearch(client, shorter, year ?? undefined)
        ?? await tryMovieSearch(client, shorter)
      if (result) {
        console.log(`[metadata] ✓ "${title}" → folder trim "${shorter}" matched on step 6b`)
        return result
      }
    }
  }

  console.warn(`[metadata] ✗ No match found for "${title}"${year ? ` (${year})` : ''}`)
  return null
}

// ---------------------------------------------------------------------------
// TV metadata — same pattern, simpler (show names rarely have year junk)
// ---------------------------------------------------------------------------
async function tryTVSearch(
  client: MovieDb,
  query: string
): Promise<MetadataResult | null> {
  if (!query.trim()) return null
  try {
    const { results } = await client.searchTv({ query })
    const hit = results?.[0]
    if (!hit?.id) return null

    const details = await client.tvInfo({ id: hit.id })
    return {
      title: details.name ?? details.original_name ?? query,
      tmdbId: String(details.id),
      posterUrl: imgUrl('w500', details.poster_path),
      backdropUrl: imgUrl('w1280', details.backdrop_path),
      description: details.overview ?? null,
      year: details.first_air_date ? parseInt(details.first_air_date.split('-')[0]) : null,
      genre: details.genres?.map((g: any) => g.name).join(', ') || null,
      rating: details.vote_average ?? null,
      director: null,
      duration: null,
    }
  } catch {
    return null
  }
}

export async function fetchTVMetadata(title: string): Promise<MetadataResult | null> {
  const client = getClient()
  if (!client) return null

  const result = await tryTVSearch(client, title)
  if (result) return result

  const stripped = stripRemainingJunk(title)
  if (stripped !== title) {
    const r2 = await tryTVSearch(client, stripped)
    if (r2) return r2
  }

  console.warn(`[metadata] ✗ No TV match found for "${title}"`)
  return null
}

// ---------------------------------------------------------------------------
// Lightweight suggestion — returned without fetching full movie details
// ---------------------------------------------------------------------------
export interface MovieSuggestion {
  tmdbId: string
  title: string
  year: number | null
  posterUrl: string | null
  description: string | null
}

export async function searchMovieSuggestions(
  query: string,
  year?: number | null
): Promise<MovieSuggestion[]> {
  const client = getClient()
  if (!client || !query.trim()) return []
  try {
    const { results } = await client.searchMovie({ query, year: year ?? undefined })
    return (results ?? []).slice(0, 4).map((r) => ({
      tmdbId: String(r.id),
      title: r.title ?? r.original_title ?? query,
      year: r.release_date ? parseInt(r.release_date.split('-')[0]) : null,
      posterUrl: imgUrl('w342', r.poster_path),
      description: r.overview ?? null,
    }))
  } catch {
    return []
  }
}

export async function fetchMovieMetadataByTmdbId(tmdbId: string): Promise<MetadataResult | null> {
  const client = getClient()
  if (!client) return null
  try {
    const details = await client.movieInfo({ id: parseInt(tmdbId), append_to_response: 'credits' })
    const crew: Array<{ job: string; name: string }> = (details as any).credits?.crew ?? []
    const director = crew.filter((c) => c.job === 'Director').map((c) => c.name).join(', ') || null
    return {
      title: details.title ?? details.original_title ?? '',
      tmdbId: String(details.id),
      posterUrl: imgUrl('w500', details.poster_path),
      backdropUrl: imgUrl('w1280', details.backdrop_path),
      description: details.overview ?? null,
      year: details.release_date ? parseInt(details.release_date.split('-')[0]) : null,
      genre: details.genres?.map((g: any) => g.name).join(', ') || null,
      rating: details.vote_average ?? null,
      duration: details.runtime ? details.runtime * 60 : null,
      director,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Credits — director + cast photos + all genres for a known TMDB ID
// ---------------------------------------------------------------------------

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

export async function fetchCredits(
  tmdbId: string,
  mediaType: 'movie' | 'tv' = 'movie'
): Promise<CreditsResult | null> {
  const client = getClient()
  if (!client) return null
  try {
    let cast: any[] = []
    let crew: any[] = []
    let genres: string[] = []
    let language: string | null = null

    if (mediaType === 'movie') {
      const details = await client.movieInfo({ id: parseInt(tmdbId), append_to_response: 'credits' })
      cast = (details as any).credits?.cast ?? []
      crew = (details as any).credits?.crew ?? []
      genres = (details as any).genres?.map((g: any) => g.name) ?? []
      const langs: any[] = (details as any).spoken_languages ?? []
      language = langs.map((l: any) => l.english_name).filter(Boolean).join(', ') || null
    } else {
      const [details, tvCredits] = await Promise.all([
        client.tvInfo({ id: parseInt(tmdbId) }),
        client.tvCredits({ id: parseInt(tmdbId) }),
      ])
      cast = (tvCredits as any).cast ?? []
      crew = (tvCredits as any).crew ?? []
      genres = (details as any).genres?.map((g: any) => g.name) ?? []
      const langs: any[] = (details as any).spoken_languages ?? []
      language = langs.map((l: any) => l.english_name).filter(Boolean).join(', ') || null
    }

    const directors: CreditsPerson[] = crew
      .filter((c: any) => c.job === 'Director')
      .map((c: any) => ({ name: c.name, job: 'Director', profileUrl: imgUrl('w185', c.profile_path) }))

    // Build crew categories grouped by Oscar-eligible roles
    const CREW_CATEGORIES: { label: string; jobs: string[] }[] = [
      { label: 'Writers', jobs: ['Writer', 'Screenplay', 'Story'] },
      { label: 'Cinematography', jobs: ['Director of Photography'] },
      { label: 'Music', jobs: ['Original Music Composer', 'Music'] },
      { label: 'Editing', jobs: ['Editor'] },
      { label: 'Production Design', jobs: ['Production Design', 'Production Designer'] },
      { label: 'Costume Design', jobs: ['Costume Design', 'Costume Designer'] },
      { label: 'Visual Effects', jobs: ['Visual Effects Supervisor', 'Visual Effects Producer'] },
      { label: 'Sound', jobs: ['Sound Designer', 'Sound Mixer', 'Sound Re-Recording Mixer'] },
    ]

    const crewCategories: CrewCategory[] = []
    for (const cat of CREW_CATEGORIES) {
      const seen = new Set<string>()
      const people: CreditsPerson[] = []
      for (const job of cat.jobs) {
        for (const c of crew.filter((m: any) => m.job === job)) {
          if (!seen.has(c.name)) {
            seen.add(c.name)
            people.push({ name: c.name, job: c.job, profileUrl: imgUrl('w185', c.profile_path) })
          }
        }
      }
      if (people.length > 0) {
        crewCategories.push({ label: cat.label, people })
      }
    }

    const topCast: CreditsPerson[] = cast.slice(0, 8).map((a: any) => ({
      name: a.name,
      character: a.character || undefined,
      profileUrl: imgUrl('w185', a.profile_path),
    }))

    return { directors, crewCategories, cast: topCast, genres, language }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// TV Season poster — fetches season-specific poster from TMDB
// ---------------------------------------------------------------------------
export async function fetchSeasonPoster(
  tmdbId: string,
  seasonNumber: number
): Promise<string | null> {
  const client = getClient()
  if (!client) return null
  try {
    const response = await client.seasonImages({
      id: parseInt(tmdbId),
      season_number: seasonNumber,
    })
    const posters = response.posters ?? []
    if (posters.length === 0) return null

    // Prefer English or language-neutral posters, then rank by
    // combined score: rating × log(1 + votes) — balances quality and confidence
    const preferred = posters.filter((p) => !p.iso_639_1 || p.iso_639_1 === 'en')
    const pool = preferred.length > 0 ? preferred : posters

    const score = (p: typeof pool[0]) =>
      (p.vote_average ?? 0) * Math.log1p(p.vote_count ?? 0)

    const best = pool.reduce((a, b) => score(b) > score(a) ? b : a)
    return imgUrl('w500', best.file_path) ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Strip isolated ALL-CAPS words (3+ chars) that are likely leftover junk.
// We're conservative: only removes words that are all uppercase, not mixed
// case, so legitimate title words like "DNA", "AI" aren't affected in practice.
// ---------------------------------------------------------------------------
function stripRemainingJunk(title: string): string {
  return title
    .replace(/\b[A-Z]{3,}\b/g, '')          // remove ALL-CAPS tokens
    .replace(/\s+/g, ' ')
    .trim()
}
