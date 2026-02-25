import { FastifyInstance } from 'fastify'
import path from 'path'
import {
  getAllMediaItems,
  getMediaItemById,
  getRecentlyAdded,
  getContinueWatching,
  getWatchProgress,
  upsertWatchProgress,
  updateMediaItem,
  toggleFavorite,
  toggleWatchlist,
  getAllManualCollections,
  createCollection,
  deleteCollection,
  renameCollection,
  addItemToCollection,
  removeItemFromCollection,
} from '../db/queries'
import { scanLibrary, isScanInProgress, getLibraryPaths } from '../services/scanner'
import {
  searchMovieSuggestions,
  fetchMovieMetadataByTmdbId,
  fetchCredits,
  fetchSeasonPoster,
} from '../services/metadata'
import { makeSortTitle } from '../utils/fileUtils'

export async function libraryRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/library - all items with optional type filter
  fastify.get<{ Querystring: { type?: string } }>('/library', async (request) => {
    const { type } = request.query
    const items = getAllMediaItems()
    if (type) return items.filter((i) => i.type === type)
    return items
  })

  // GET /api/library/recent
  fastify.get('/library/recent', async () => {
    return getRecentlyAdded(24)
  })

  // GET /api/library/continue
  fastify.get('/library/continue', async () => {
    return getContinueWatching()
  })

  // GET /api/library/:id
  fastify.get<{ Params: { id: string } }>('/library/:id', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)
    if (!item) return reply.status(404).send({ error: 'Not found' })
    return item
  })

  // POST /api/library/scan - trigger a library scan
  fastify.post('/library/scan', async (reply) => {
    if (isScanInProgress()) {
      return { message: 'Scan already in progress' }
    }
    const paths = getLibraryPaths()
    if (paths.length === 0) {
      return { message: 'No library paths configured' }
    }
    // Fire and forget
    scanLibrary(paths).catch(console.error)
    return { message: 'Scan started', paths }
  })

  // GET /api/library/:id/progress
  fastify.get<{ Params: { id: string } }>('/library/:id/progress', async (request) => {
    const id = parseInt(request.params.id)
    return getWatchProgress(id) ?? { position_seconds: 0, completed: false }
  })

  // POST /api/library/:id/progress
  fastify.post<{
    Params: { id: string }
    Body: { position_seconds: number; completed?: boolean }
  }>('/library/:id/progress', async (request) => {
    const id = parseInt(request.params.id)
    const { position_seconds, completed = false } = request.body
    upsertWatchProgress(id, position_seconds, completed)
    return { ok: true }
  })

  // PUT /api/library/:id — manual metadata edit
  fastify.put<{
    Params: { id: string }
    Body: Record<string, unknown>
  }>('/library/:id', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)
    if (!item) return reply.status(404).send({ error: 'Not found' })
    // If title changed, regenerate sort_title unless caller supplied one
    const fields = { ...request.body }
    if (fields.title && !fields.sort_title) {
      fields.sort_title = makeSortTitle(fields.title as string)
    }
    updateMediaItem(id, fields)
    return getMediaItemById(id)
  })

  // POST /api/library/:id/favorite — toggle favorite flag
  fastify.post<{ Params: { id: string } }>('/library/:id/favorite', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)
    if (!item) return reply.status(404).send({ error: 'Not found' })
    const isFav = toggleFavorite(id)
    return { is_favorite: isFav }
  })

  // POST /api/library/:id/watchlist — toggle watchlist flag
  fastify.post<{ Params: { id: string } }>('/library/:id/watchlist', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)
    if (!item) return reply.status(404).send({ error: 'Not found' })
    const inWatchlist = toggleWatchlist(id)
    return { in_watchlist: inWatchlist }
  })

  // GET /api/library/:id/search-suggestions — top TMDB search hits
  fastify.get<{
    Params: { id: string }
    Querystring: { q?: string; year?: string }
  }>('/library/:id/search-suggestions', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)
    if (!item) return reply.status(404).send({ error: 'Not found' })
    const query = request.query.q ?? item.title
    const year = request.query.year ? parseInt(request.query.year) : undefined
    const suggestions = await searchMovieSuggestions(query, year)
    return suggestions
  })

  // POST /api/library/:id/apply-suggestion — fetch full metadata for a TMDB ID and save
  fastify.post<{
    Params: { id: string }
    Body: { tmdb_id: string }
  }>('/library/:id/apply-suggestion', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)
    if (!item) return reply.status(404).send({ error: 'Not found' })
    const meta = await fetchMovieMetadataByTmdbId(request.body.tmdb_id)
    if (!meta) return reply.status(404).send({ error: 'TMDB ID not found' })
    updateMediaItem(id, {
      title: meta.title,
      sort_title: makeSortTitle(meta.title),
      year: meta.year,
      genre: meta.genre,
      description: meta.description,
      rating: meta.rating,
      poster_url: meta.posterUrl,
      backdrop_url: meta.backdropUrl,
      tmdb_id: meta.tmdbId,
    })
    return getMediaItemById(id)
  })

  // GET /api/library/:id/credits — director, top cast, all genres from TMDB
  fastify.get<{ Params: { id: string } }>('/library/:id/credits', async (request, reply) => {
    const id = parseInt(request.params.id)
    const item = getMediaItemById(id)
    if (!item) return reply.status(404).send({ error: 'Not found' })
    if (!item.tmdb_id) return reply.status(404).send({ error: 'No TMDB ID' })
    const mediaType = item.type === 'episode' || item.type === 'show' ? 'tv' : 'movie'
    const credits = await fetchCredits(item.tmdb_id, mediaType)
    if (!credits) return reply.status(404).send({ error: 'Credits not available' })
    return credits
  })

  // GET /api/tv/:tmdbId/season/:seasonNumber/poster — season-specific poster from TMDB
  fastify.get<{
    Params: { tmdbId: string; seasonNumber: string }
  }>('/tv/:tmdbId/season/:seasonNumber/poster', async (request, reply) => {
    const { tmdbId, seasonNumber } = request.params
    const season = parseInt(seasonNumber)
    if (!tmdbId || isNaN(season)) return reply.status(400).send({ error: 'invalid params' })
    const posterUrl = await fetchSeasonPoster(tmdbId, season)
    return { posterUrl }
  })

  // ---------------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------------

  // GET /api/collections — merged auto (folder-based) + manual collections
  fastify.get('/collections', async () => {
    const items = getAllMediaItems()
    const libraryPaths = getLibraryPaths()

    // Auto-collections: movies only, grouped by their first subfolder relative to the library root.
    // This handles both flat layouts (Movies/Ghibli/film.mkv) and nested ones
    // (Movies/Ghibli/Spirited Away/film.mkv) — both map to the same "Ghibli" collection.
    const folderGroups = new Map<string, number[]>() // collectionFolder → item IDs
    for (const item of items) {
      if (item.type !== 'movie') continue
      if (!item.file_path) continue

      // Find the library root that contains this file
      const sep = path.sep
      const libraryRoot = libraryPaths.find(
        (lp) => item.file_path!.startsWith(lp + sep) || item.file_path!.startsWith(lp + '/')
      )
      if (!libraryRoot) continue

      // Relative path from library root, e.g. "Studio Ghibli/Spirited Away/movie.mkv"
      const rel = path.relative(libraryRoot, item.file_path)
      const parts = rel.split(sep)

      // File sits directly in the library root — no collection
      if (parts.length <= 1) continue

      // First subfolder is the collection (parts[0] = "Studio Ghibli")
      const collectionFolder = path.join(libraryRoot, parts[0])
      if (!folderGroups.has(collectionFolder)) folderGroups.set(collectionFolder, [])
      folderGroups.get(collectionFolder)!.push(item.id)
    }

    const autoCollections = Array.from(folderGroups.entries())
      .filter(([, ids]) => ids.length >= 2)
      .map(([dir, ids]) => ({ id: dir, name: path.basename(dir), itemIds: ids, isManual: false }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Special auto-collections: Recently Added & New Releases
    const recentlyAddedIds = [...items]
      .sort((a, b) => (b.added_at ?? '').localeCompare(a.added_at ?? ''))
      .slice(0, 8)
      .map((i) => i.id)

    const currentYear = new Date().getFullYear()
    const newReleaseIds = items
      .filter((i) => i.type === 'movie' && i.year != null && i.year >= currentYear - 1)
      .map((i) => i.id)

    const specialCollections = [
      { id: '__recently-added__', name: 'Recently Added', itemIds: recentlyAddedIds, isManual: false },
      ...(newReleaseIds.length > 0
        ? [{ id: '__new-releases__', name: 'New Releases', itemIds: newReleaseIds, isManual: false }]
        : []),
    ]

    // Manual collections from DB
    const manualCollections = getAllManualCollections().map((c) => ({
      id: String(c.id),
      name: c.name,
      itemIds: c.itemIds,
      isManual: true,
    }))

    return [...specialCollections, ...autoCollections, ...manualCollections]
  })

  // POST /api/collections — create a manual collection
  fastify.post<{ Body: { name: string } }>('/collections', async (request, reply) => {
    const { name } = request.body
    if (!name?.trim()) return reply.status(400).send({ error: 'name is required' })
    const col = createCollection(name.trim())
    return { id: String(col.id), name: col.name, itemIds: [], isManual: true }
  })

  // PATCH /api/collections/:id — rename a manual collection
  fastify.patch<{ Params: { id: string }; Body: { name: string } }>('/collections/:id', async (request, reply) => {
    const id = parseInt(request.params.id)
    if (isNaN(id)) return reply.status(400).send({ error: 'invalid id' })
    const { name } = request.body
    if (!name?.trim()) return reply.status(400).send({ error: 'name is required' })
    renameCollection(id, name.trim())
    return { ok: true }
  })

  // DELETE /api/collections/:id — delete a manual collection
  fastify.delete<{ Params: { id: string } }>('/collections/:id', async (request, reply) => {
    const id = parseInt(request.params.id)
    if (isNaN(id)) return reply.status(400).send({ error: 'invalid id' })
    deleteCollection(id)
    return { ok: true }
  })

  // POST /api/collections/:id/items — add an item to a manual collection
  fastify.post<{
    Params: { id: string }
    Body: { mediaItemId: number }
  }>('/collections/:id/items', async (request, reply) => {
    const collectionId = parseInt(request.params.id)
    if (isNaN(collectionId)) return reply.status(400).send({ error: 'invalid id' })
    const { mediaItemId } = request.body
    addItemToCollection(collectionId, mediaItemId)
    return { ok: true }
  })

  // DELETE /api/collections/:id/items/:itemId — remove an item from a manual collection
  fastify.delete<{
    Params: { id: string; itemId: string }
  }>('/collections/:id/items/:itemId', async (request, reply) => {
    const collectionId = parseInt(request.params.id)
    const mediaItemId = parseInt(request.params.itemId)
    if (isNaN(collectionId) || isNaN(mediaItemId)) return reply.status(400).send({ error: 'invalid id' })
    removeItemFromCollection(collectionId, mediaItemId)
    return { ok: true }
  })
}
