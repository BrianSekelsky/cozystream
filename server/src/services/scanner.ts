import fs from 'fs'
import path from 'path'
import { upsertMediaItem, deleteMediaItemByPath, getSetting } from '../db/queries'
import { fetchMovieMetadata, fetchTVMetadata } from './metadata'
import {
  isVideoFile,
  parseMovieFilename,
  parseEpisodeFilename,
  isEpisodeFile,
  makeSortTitle,
} from '../utils/fileUtils'

let scanInProgress = false

export function isScanInProgress(): boolean {
  return scanInProgress
}

export async function scanLibrary(libraryPaths: string[]): Promise<{ scanned: number; errors: number }> {
  if (scanInProgress) {
    console.log('[scanner] Scan already in progress, skipping.')
    return { scanned: 0, errors: 0 }
  }

  scanInProgress = true
  let scanned = 0
  let errors = 0

  try {
    for (const libPath of libraryPaths) {
      const results = await scanDirectory(libPath)
      scanned += results.scanned
      errors += results.errors
    }
  } finally {
    scanInProgress = false
  }

  console.log(`[scanner] Done. Scanned: ${scanned}, Errors: ${errors}`)
  return { scanned, errors }
}

async function scanDirectory(
  dirPath: string
): Promise<{ scanned: number; errors: number }> {
  let scanned = 0
  let errors = 0

  if (!fs.existsSync(dirPath)) {
    console.warn(`[scanner] Path does not exist: ${dirPath}`)
    return { scanned, errors }
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      const sub = await scanDirectory(fullPath)
      scanned += sub.scanned
      errors += sub.errors
    } else if (entry.isFile() && isVideoFile(fullPath)) {
      try {
        await indexVideoFile(fullPath)
        scanned++
      } catch (err) {
        console.error(`[scanner] Failed to index ${fullPath}:`, err)
        errors++
      }
    }
  }

  return { scanned, errors }
}

async function indexVideoFile(filePath: string): Promise<void> {
  const stat = fs.statSync(filePath)

  if (isEpisodeFile(filePath)) {
    const info = parseEpisodeFilename(filePath)
    if (!info) return

    // Look up or create the show
    const showMeta = await fetchTVMetadata(info.showName)
    const displayShowName = showMeta?.title ?? info.showName
    const pad = (n: number) => String(n).padStart(2, '0')

    // For now, index episodes as type 'episode' but reference the show title
    upsertMediaItem({
      title: info.episodeTitle
        ? `${displayShowName} - S${pad(info.season)}E${pad(info.episode)} - ${info.episodeTitle}`
        : `${displayShowName} - S${pad(info.season)}E${pad(info.episode)}`,
      sort_title: makeSortTitle(displayShowName),
      type: 'episode',
      year: showMeta?.year ?? null,
      genre: showMeta?.genre ?? null,
      file_path: filePath,
      file_size: stat.size,
      duration: showMeta?.duration ?? null,
      codec_info: null,
      tmdb_id: showMeta?.tmdbId ?? null,
      poster_url: showMeta?.posterUrl ?? null,
      backdrop_url: showMeta?.backdropUrl ?? null,
      description: showMeta?.description ?? null,
      rating: showMeta?.rating ?? null,
      director: null,
    })
  } else {
    const { title, titleAfterYear, year: fileYear } = parseMovieFilename(filePath)

    // Parse the parent folder name as an additional title candidate.
    // Append a fake extension so parseMovieFilename handles it correctly.
    const parentDirName = path.basename(path.dirname(filePath))
    const { title: folderTitle, year: folderYear } = parseMovieFilename(parentDirName + '.mkv')

    // Prefer the file's year; fall back to the folder's year if the file has none.
    const year = fileYear ?? folderYear

    // Only use folderTitle as a candidate if it's meaningfully different from
    // the file title (avoids redundant searches when both parse to the same thing).
    const folderCandidate = (folderTitle && folderTitle !== title && folderTitle.length > 3)
      ? folderTitle
      : null

    const meta = await fetchMovieMetadata(title, year, titleAfterYear, folderCandidate)

    // Prefer TMDB's official title over the raw parsed filename title.
    const displayTitle = (meta?.title ?? title) || 'Unknown'

    upsertMediaItem({
      title: displayTitle,
      sort_title: makeSortTitle(displayTitle),
      type: 'movie',
      year: meta?.year ?? year,
      genre: meta?.genre ?? null,
      file_path: filePath,
      file_size: stat.size,
      duration: meta?.duration ?? null,
      codec_info: null,
      tmdb_id: meta?.tmdbId ?? null,
      poster_url: meta?.posterUrl ?? null,
      backdrop_url: meta?.backdropUrl ?? null,
      description: meta?.description ?? null,
      rating: meta?.rating ?? null,
      director: meta?.director ?? null,
    })
  }
}

export function getLibraryPaths(): string[] {
  const raw = getSetting('library_paths')
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}
