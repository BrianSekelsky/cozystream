import { getDB } from './schema'

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

// Fields allowed to be updated via the edit API
const UPDATABLE_FIELDS = new Set([
  'title', 'sort_title', 'year', 'genre', 'description',
  'rating', 'director', 'poster_url', 'backdrop_url', 'tmdb_id', 'is_favorite',
])

export function updateMediaItem(id: number, fields: Record<string, unknown>): void {
  const db = getDB()
  const entries = Object.entries(fields).filter(([k]) => UPDATABLE_FIELDS.has(k))
  if (entries.length === 0) return
  const sets = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([, v]) => v)
  db.prepare(`UPDATE media_items SET ${sets} WHERE id = ?`).run(...values, id)
}

export function toggleFavorite(id: number): boolean {
  const db = getDB()
  const item = db
    .prepare('SELECT is_favorite FROM media_items WHERE id = ?')
    .get(id) as { is_favorite: number } | undefined
  if (!item) return false
  const newVal = item.is_favorite ? 0 : 1
  db.prepare('UPDATE media_items SET is_favorite = ? WHERE id = ?').run(newVal, id)
  return newVal === 1
}

export function toggleWatchlist(id: number): boolean {
  const db = getDB()
  const item = db
    .prepare('SELECT in_watchlist FROM media_items WHERE id = ?')
    .get(id) as { in_watchlist: number } | undefined
  if (!item) return false
  const newVal = item.in_watchlist ? 0 : 1
  db.prepare('UPDATE media_items SET in_watchlist = ? WHERE id = ?').run(newVal, id)
  return newVal === 1
}

export interface WatchProgress {
  user_id: number
  media_item_id: number
  position_seconds: number
  completed: number
  updated_at: string
}

export function getAllMediaItems(): MediaItem[] {
  return getDB()
    .prepare('SELECT * FROM media_items ORDER BY sort_title ASC, title ASC')
    .all() as MediaItem[]
}

export function getAllMediaItemsForUser(userId: number): MediaItem[] {
  return getDB()
    .prepare(`
      SELECT m.*,
        CASE WHEN uf.user_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
        CASE WHEN uw.user_id IS NOT NULL THEN 1 ELSE 0 END as in_watchlist
      FROM media_items m
      LEFT JOIN user_favorites uf ON m.id = uf.media_item_id AND uf.user_id = ?
      LEFT JOIN user_watchlist uw ON m.id = uw.media_item_id AND uw.user_id = ?
      ORDER BY m.sort_title ASC, m.title ASC
    `)
    .all(userId, userId) as MediaItem[]
}

export function getMediaItemById(id: number): MediaItem | undefined {
  return getDB()
    .prepare('SELECT * FROM media_items WHERE id = ?')
    .get(id) as MediaItem | undefined
}

export function getMediaItemByIdForUser(id: number, userId: number): MediaItem | undefined {
  return getDB()
    .prepare(`
      SELECT m.*,
        CASE WHEN uf.user_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite,
        CASE WHEN uw.user_id IS NOT NULL THEN 1 ELSE 0 END as in_watchlist
      FROM media_items m
      LEFT JOIN user_favorites uf ON m.id = uf.media_item_id AND uf.user_id = ?
      LEFT JOIN user_watchlist uw ON m.id = uw.media_item_id AND uw.user_id = ?
      WHERE m.id = ?
    `)
    .get(userId, userId, id) as MediaItem | undefined
}

export function getRecentlyAdded(limit = 20): MediaItem[] {
  return getDB()
    .prepare('SELECT * FROM media_items ORDER BY added_at DESC LIMIT ?')
    .all(limit) as MediaItem[]
}

export function getContinueWatching(userId = 1): (MediaItem & WatchProgress)[] {
  return getDB()
    .prepare(`
      SELECT m.*, w.position_seconds, w.completed, w.updated_at as progress_updated_at
      FROM media_items m
      JOIN watch_progress w ON m.id = w.media_item_id
      WHERE w.user_id = ? AND w.completed = 0 AND w.position_seconds > 0
      ORDER BY w.updated_at DESC
      LIMIT 20
    `)
    .all(userId) as (MediaItem & WatchProgress)[]
}

export function upsertMediaItem(item: Omit<MediaItem, 'id' | 'added_at'>): number {
  const db = getDB()
  const existing = db
    .prepare('SELECT id FROM media_items WHERE file_path = ?')
    .get(item.file_path) as { id: number } | undefined

  if (existing) {
    db.prepare(`
      UPDATE media_items SET
        title = ?, sort_title = ?, type = ?, year = ?, genre = ?,
        file_size = ?, duration = ?, codec_info = ?,
        tmdb_id = ?, poster_url = ?, backdrop_url = ?, description = ?, rating = ?, director = ?
      WHERE id = ?
    `).run(
      item.title, item.sort_title, item.type, item.year, item.genre,
      item.file_size, item.duration, item.codec_info,
      item.tmdb_id, item.poster_url, item.backdrop_url, item.description, item.rating, item.director,
      existing.id
    )
    return existing.id
  }

  const result = db.prepare(`
    INSERT INTO media_items
      (title, sort_title, type, year, genre, file_path, file_size, duration, codec_info,
       tmdb_id, poster_url, backdrop_url, description, rating, director)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.title, item.sort_title, item.type, item.year, item.genre,
    item.file_path, item.file_size, item.duration, item.codec_info,
    item.tmdb_id, item.poster_url, item.backdrop_url, item.description, item.rating, item.director
  )
  return result.lastInsertRowid as number
}

export function deleteMediaItemByPath(filePath: string): void {
  getDB().prepare('DELETE FROM media_items WHERE file_path = ?').run(filePath)
}

export function getAllMediaFilePaths(): { id: number; file_path: string }[] {
  return getDB()
    .prepare('SELECT id, file_path FROM media_items WHERE file_path IS NOT NULL')
    .all() as { id: number; file_path: string }[]
}

export function deleteMediaItemById(id: number): void {
  const db = getDB()
  db.prepare('DELETE FROM watch_progress WHERE media_item_id = ?').run(id)
  db.prepare('DELETE FROM collection_items WHERE media_item_id = ?').run(id)
  db.prepare('DELETE FROM media_items WHERE id = ?').run(id)
}

export function getWatchProgress(mediaItemId: number, userId = 1): WatchProgress | undefined {
  return getDB()
    .prepare('SELECT * FROM watch_progress WHERE media_item_id = ? AND user_id = ?')
    .get(mediaItemId, userId) as WatchProgress | undefined
}

export function upsertWatchProgress(
  mediaItemId: number,
  positionSeconds: number,
  completed: boolean,
  userId = 1
): void {
  getDB().prepare(`
    INSERT INTO watch_progress (user_id, media_item_id, position_seconds, completed, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, media_item_id) DO UPDATE SET
      position_seconds = excluded.position_seconds,
      completed = excluded.completed,
      updated_at = excluded.updated_at
  `).run(userId, mediaItemId, positionSeconds, completed ? 1 : 0)
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface ManualCollection {
  id: number
  name: string
  created_at: string
  itemIds: number[]
}

export function getAllManualCollections(): ManualCollection[] {
  const db = getDB()
  const cols = db.prepare('SELECT * FROM collections ORDER BY name ASC').all() as Omit<ManualCollection, 'itemIds'>[]
  return cols.map((c) => {
    const rows = db
      .prepare('SELECT media_item_id FROM collection_items WHERE collection_id = ?')
      .all(c.id) as { media_item_id: number }[]
    return { ...c, itemIds: rows.map((r) => r.media_item_id) }
  })
}

export function createCollection(name: string): ManualCollection {
  const db = getDB()
  const result = db.prepare('INSERT INTO collections (name) VALUES (?)').run(name)
  return { id: result.lastInsertRowid as number, name, created_at: new Date().toISOString(), itemIds: [] }
}

export function deleteCollection(id: number): void {
  getDB().prepare('DELETE FROM collections WHERE id = ?').run(id)
}

export function renameCollection(id: number, name: string): void {
  getDB().prepare('UPDATE collections SET name = ? WHERE id = ?').run(name, id)
}

export function addItemToCollection(collectionId: number, mediaItemId: number): void {
  getDB()
    .prepare('INSERT OR IGNORE INTO collection_items (collection_id, media_item_id) VALUES (?, ?)')
    .run(collectionId, mediaItemId)
}

export function removeItemFromCollection(collectionId: number, mediaItemId: number): void {
  getDB()
    .prepare('DELETE FROM collection_items WHERE collection_id = ? AND media_item_id = ?')
    .run(collectionId, mediaItemId)
}

export function getSetting(key: string): string | undefined {
  const row = getDB()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value
}

export function setSetting(key: string, value: string): void {
  getDB().prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value)
}
