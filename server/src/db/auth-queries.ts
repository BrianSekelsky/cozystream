import { getDB } from './schema'

export interface User {
  id: number
  username: string
  password_hash: string
  display_name: string
  role: 'admin' | 'member'
  created_at: string
}

export interface SafeUser {
  id: number
  username: string
  display_name: string
  role: 'admin' | 'member'
  created_at: string
}

export interface InviteCode {
  code: string
  created_by: number
  used_by: number | null
  created_at: string
  used_at: string | null
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function getUserCount(): number {
  const row = getDB()
    .prepare('SELECT COUNT(*) as count FROM users')
    .get() as { count: number }
  return row.count
}

export function getUserByUsername(username: string): User | undefined {
  return getDB()
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as User | undefined
}

export function getUserById(id: number): User | undefined {
  return getDB()
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(id) as User | undefined
}

export function createUser(
  username: string,
  passwordHash: string,
  displayName: string,
  role: 'admin' | 'member'
): number {
  const result = getDB()
    .prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
    .run(username, passwordHash, displayName, role)
  return result.lastInsertRowid as number
}

export function getAllUsers(): SafeUser[] {
  return getDB()
    .prepare('SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at ASC')
    .all() as SafeUser[]
}

// ---------------------------------------------------------------------------
// Invite Codes
// ---------------------------------------------------------------------------

export function createInviteCode(code: string, createdBy: number): void {
  getDB()
    .prepare('INSERT INTO invite_codes (code, created_by) VALUES (?, ?)')
    .run(code, createdBy)
}

export function getInviteCode(code: string): InviteCode | undefined {
  return getDB()
    .prepare('SELECT * FROM invite_codes WHERE code = ?')
    .get(code) as InviteCode | undefined
}

export function markInviteCodeUsed(code: string, usedBy: number): void {
  getDB()
    .prepare("UPDATE invite_codes SET used_by = ?, used_at = datetime('now') WHERE code = ?")
    .run(usedBy, code)
}

export function getInviteCodes(createdBy: number): InviteCode[] {
  return getDB()
    .prepare('SELECT * FROM invite_codes WHERE created_by = ? ORDER BY created_at DESC')
    .all(createdBy) as InviteCode[]
}

export function deleteInviteCode(code: string): void {
  getDB()
    .prepare('DELETE FROM invite_codes WHERE code = ? AND used_by IS NULL')
    .run(code)
}

// ---------------------------------------------------------------------------
// Per-User Favorites
// ---------------------------------------------------------------------------

export function toggleUserFavorite(userId: number, mediaItemId: number): boolean {
  const db = getDB()
  const existing = db
    .prepare('SELECT 1 FROM user_favorites WHERE user_id = ? AND media_item_id = ?')
    .get(userId, mediaItemId)

  if (existing) {
    db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND media_item_id = ?')
      .run(userId, mediaItemId)
    return false
  } else {
    db.prepare('INSERT INTO user_favorites (user_id, media_item_id) VALUES (?, ?)')
      .run(userId, mediaItemId)
    return true
  }
}

export function getUserFavoriteIds(userId: number): number[] {
  const rows = getDB()
    .prepare('SELECT media_item_id FROM user_favorites WHERE user_id = ?')
    .all(userId) as { media_item_id: number }[]
  return rows.map((r) => r.media_item_id)
}

// ---------------------------------------------------------------------------
// Per-User Watchlist
// ---------------------------------------------------------------------------

export function toggleUserWatchlist(userId: number, mediaItemId: number): boolean {
  const db = getDB()
  const existing = db
    .prepare('SELECT 1 FROM user_watchlist WHERE user_id = ? AND media_item_id = ?')
    .get(userId, mediaItemId)

  if (existing) {
    db.prepare('DELETE FROM user_watchlist WHERE user_id = ? AND media_item_id = ?')
      .run(userId, mediaItemId)
    return false
  } else {
    db.prepare('INSERT INTO user_watchlist (user_id, media_item_id) VALUES (?, ?)')
      .run(userId, mediaItemId)
    return true
  }
}

export function getUserWatchlistIds(userId: number): number[] {
  const rows = getDB()
    .prepare('SELECT media_item_id FROM user_watchlist WHERE user_id = ?')
    .all(userId) as { media_item_id: number }[]
  return rows.map((r) => r.media_item_id)
}

// ---------------------------------------------------------------------------
// Data Migration: move global favorites/watchlist to first user
// ---------------------------------------------------------------------------

export function migrateGlobalFavoritesAndWatchlist(userId: number): void {
  const db = getDB()

  // Migrate is_favorite=1 from media_items to user_favorites
  db.prepare(`
    INSERT OR IGNORE INTO user_favorites (user_id, media_item_id)
    SELECT ?, id FROM media_items WHERE is_favorite = 1
  `).run(userId)

  // Migrate in_watchlist=1 from media_items to user_watchlist
  db.prepare(`
    INSERT OR IGNORE INTO user_watchlist (user_id, media_item_id)
    SELECT ?, id FROM media_items WHERE in_watchlist = 1
  `).run(userId)
}
