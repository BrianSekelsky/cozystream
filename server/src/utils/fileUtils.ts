import path from 'path'

export const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.m4v', '.wmv', '.flv', '.webm', '.ts', '.m2ts',
])

export const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a', '.opus',
])

export function isVideoFile(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export function isAudioFile(filePath: string): boolean {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.m4v': 'video/mp4',
    '.wmv': 'video/x-ms-wmv',
    '.webm': 'video/webm',
    '.ts': 'video/mp2t',
    '.m2ts': 'video/mp2t',
    '.flv': 'video/x-flv',
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
  }
  return mimeTypes[ext] ?? 'application/octet-stream'
}

// ---------------------------------------------------------------------------
// Junk token patterns — ordered from most to least specific.
// These are stripped when a year boundary isn't available.
// ---------------------------------------------------------------------------
const JUNK_PATTERNS: RegExp[] = [
  // Content inside brackets/parens that looks like metadata
  /\[[^\]]*\]/g,
  /\{[^}]*\}/g,

  // Resolution
  /\b(2160p|1080p|1080i|720p|576p|480p|4[Kk]|UHD|FHD)\b/gi,

  // Source / origin
  /\b(BluRay|Blu[- ]Ray|BDRip|BRRip|WEBRip|WEB[- ]DL|WEBDL|HDTV|DVDRip|DVDScr|DVDR|DVD|PDVD)\b/gi,
  /\b(AMZN|DSNP|HULU|NF|HBO|ATVP|PCOK|iT|PMTP|STAN|CRKL|SESO)\b/g,

  // Video codec
  /\b(x26[45]|HEVC|AVC|H\.?26[45]|XviD|DivX|VC-?1|MPEG-?2|AV1|VP9)\b/gi,

  // Audio codec / channels
  /\b(DTS[- ]?HD|DTS[- ]?MA|DTS|TrueHD|Atmos|DD[25]\.\d|DD\+|EAC3|AC3|AAC[\d. ]*|MP3|FLAC|PCM|LPCM|AUDIO)\b/gi,

  // Edition / release type
  /\b(EXTENDED|UNRATED|THEATRICAL|REMASTERED|REMASTER|PROPER|REAL|REPACK|RETAIL|LIMITED|INTERNAL|DUBBED|SUBBED|MULTI|DUAL|TRUEFRENCH|FRENCH|GERMAN|HINDI|JAPANESE|KOREAN|ITALIAN|SPANISH|PORTUGUESE)\b/gi,

  // Technical tags
  /\b(REMUX|HDR10\+?|HDR|SDR|DoVi|DOVI|Dolby\.?Vision|10[- ]?bit|8[- ]?bit|HFR|SDR|Hybrid)\b/gi,

  // Common release group tags / scene junk
  /\b(YIFY|YTS|RARBG|FGT|SPARKS|pseudo|NTb|FLUX|CMRG|GALAXY|SMURF|GalaxyRG|ION10|PAHE|CM)\b/gi,

  // Trailing release group: dash + all-caps word at end of string
  /\s*-\s*[A-Z][A-Z0-9]{1,12}$/,
]

/**
 * Strip known release-metadata junk from a title string.
 * Used as a last resort when there's no year to act as a hard boundary.
 */
export function stripJunkTokens(input: string): string {
  let s = input
  for (const pattern of JUNK_PATTERNS) {
    s = s.replace(pattern, ' ')
  }
  return s.replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Movie filename parser
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear()

export interface ParsedMovie {
  /** Text before the year boundary — usually the title, but may be director/label junk. */
  title: string
  /**
   * Text after the year boundary, junk-stripped.
   * Present when a year was found; null otherwise.
   * Used as a search fallback for filenames like "Director.Name.2021.Movie.Title.mkv"
   * where the real title sits AFTER the year.
   */
  titleAfterYear: string | null
  year: number | null
}

/**
 * Parse a movie filename into title + year.
 *
 * Strategy:
 * 1. Normalise separators (dots → spaces).
 * 2. Look for a year. If found, **everything before it is the primary title** — this
 *    is correct for the vast majority of files. We also capture the text after the
 *    year so metadata lookup can try it as a fallback (handles Director.Year.Title
 *    patterns).
 * 3. If no year is present, strip known junk tokens to recover the title.
 */
export function parseMovieFilename(filename: string): ParsedMovie {
  const base = path.basename(filename, path.extname(filename))

  // Normalise: replace dots and underscores with spaces
  const normalised = base.replace(/[._]/g, ' ')

  // --- Strategy 1: "Title (Year)" parenthetical format ---
  const parenMatch = normalised.match(/^(.+?)\s*\((\d{4})\)/)
  if (parenMatch) {
    const year = parseInt(parenMatch[2])
    if (year >= 1900 && year <= CURRENT_YEAR + 1) {
      // Anything after the closing paren is pure junk in this format
      return { title: finalise(parenMatch[1]), titleAfterYear: null, year }
    }
  }

  // --- Strategy 2: year surrounded by spaces (most common scene/release format) ---
  const yearBoundaryMatch = normalised.match(/\s((?:19|20)\d{2})\s/)
  if (yearBoundaryMatch) {
    const year = parseInt(yearBoundaryMatch[1])
    if (year >= 1900 && year <= CURRENT_YEAR + 1) {
      const beforeYear = normalised.slice(0, yearBoundaryMatch.index!).trim()
      const afterYear  = normalised.slice(yearBoundaryMatch.index! + yearBoundaryMatch[0].length).trim()
      return {
        title: finalise(beforeYear),
        titleAfterYear: meaningfulAfterYear(afterYear),
        year,
      }
    }
  }

  // --- Strategy 3: year appears without surrounding spaces ---
  // Handles: "Movie Title 2023something"
  const yearMatch = normalised.match(/^(.*?)\b((?:19|20)\d{2})\b/)
  if (yearMatch) {
    const year = parseInt(yearMatch[2])
    if (year >= 1900 && year <= CURRENT_YEAR + 1) {
      const afterYear = normalised.slice(yearMatch[0].length).trim()
      return {
        title: finalise(yearMatch[1]),
        titleAfterYear: meaningfulAfterYear(afterYear),
        year,
      }
    }
  }

  // --- Strategy 4: no year found — strip known junk tokens ---
  return { title: finalise(stripJunkTokens(normalised)), titleAfterYear: null, year: null }
}

/**
 * Strip junk from the post-year segment and return it only if it looks like
 * a real title (≥ 2 words or ≥ 4 chars). Pure codec/quality strings return null.
 */
function meaningfulAfterYear(raw: string): string | null {
  const cleaned = finalise(stripJunkTokens(raw))
  if (!cleaned || cleaned.length < 4) return null
  return cleaned
}

function finalise(raw: string): string {
  return raw
    .replace(/[._]/g, ' ')  // catch any remaining dots/underscores
    .replace(/\s+/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// TV episode filename parser
// ---------------------------------------------------------------------------

export interface EpisodeInfo {
  showName: string
  season: number
  episode: number
  episodeTitle: string | null
}

export function parseEpisodeFilename(filename: string): EpisodeInfo | null {
  const base = path.basename(filename, path.extname(filename))

  // Match S01E01 or s01e01 pattern
  const match = base.match(/^(.+?)[._\s-]+[Ss](\d{1,2})[Ee](\d{1,2})(?:[._\s-]+(.+))?$/)
  if (!match) return null

  return {
    showName: finalise(match[1]),
    season: parseInt(match[2]),
    episode: parseInt(match[3]),
    episodeTitle: match[4] ? finalise(match[4]) : null,
  }
}

export function isEpisodeFile(filePath: string): boolean {
  return /[Ss]\d{1,2}[Ee]\d{1,2}/.test(path.basename(filePath))
}

/**
 * Check that a file path is within one of the configured library directories.
 * Prevents path traversal attacks when serving media files.
 */
export function isPathWithinLibraries(filePath: string, libraryPaths: string[]): boolean {
  const resolved = path.resolve(filePath)
  return libraryPaths.some(lib => {
    const resolvedLib = path.resolve(lib)
    return resolved.startsWith(resolvedLib + path.sep) || resolved === resolvedLib
  })
}

export function makeSortTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .trim()
}
