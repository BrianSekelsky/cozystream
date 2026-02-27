import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

const DATA_DIR = path.join(os.homedir(), '.cozystream')
const DB_PATH = path.join(DATA_DIR, 'cozystream.db')

let db: Database.Database

export function getDB(): Database.Database {
  return db
}

export function initDB(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media_items (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      sort_title   TEXT,
      type         TEXT NOT NULL CHECK(type IN ('movie', 'show', 'episode', 'song', 'album')),
      year         INTEGER,
      genre        TEXT,
      file_path    TEXT UNIQUE,
      file_size    INTEGER,
      duration     INTEGER,
      codec_info   TEXT,
      tmdb_id      TEXT,
      poster_url   TEXT,
      backdrop_url TEXT,
      description  TEXT,
      rating       REAL,
      director     TEXT,
      is_favorite  INTEGER DEFAULT 0,
      added_at     TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS watch_progress (
      user_id         INTEGER DEFAULT 1,
      media_item_id   INTEGER REFERENCES media_items(id) ON DELETE CASCADE,
      position_seconds REAL DEFAULT 0,
      completed       INTEGER DEFAULT 0,
      updated_at      TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, media_item_id)
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      show_id       INTEGER REFERENCES media_items(id) ON DELETE CASCADE,
      season_number INTEGER NOT NULL,
      title         TEXT
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id      INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
      episode_number INTEGER NOT NULL,
      title          TEXT,
      file_path      TEXT UNIQUE,
      duration       INTEGER,
      tmdb_id        TEXT,
      description    TEXT
    );

    CREATE TABLE IF NOT EXISTS collections (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS collection_items (
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      PRIMARY KEY (collection_id, media_item_id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name  TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      created_at    TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      code       TEXT PRIMARY KEY,
      created_by INTEGER NOT NULL REFERENCES users(id),
      used_by    INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      used_at    TEXT
    );

    -- expires_at added via migration below
    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      created_at    TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, media_item_id)
    );

    CREATE TABLE IF NOT EXISTS user_watchlist (
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      media_item_id INTEGER NOT NULL REFERENCES media_items(id) ON DELETE CASCADE,
      created_at    TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, media_item_id)
    );
  `)

  // Migrations: add columns to existing databases
  const columns = (db.pragma('table_info(media_items)') as { name: string }[]).map((c) => c.name)
  if (!columns.includes('is_favorite')) {
    db.exec('ALTER TABLE media_items ADD COLUMN is_favorite INTEGER DEFAULT 0')
  }
  if (!columns.includes('director')) {
    db.exec('ALTER TABLE media_items ADD COLUMN director TEXT')
  }
  if (!columns.includes('in_watchlist')) {
    db.exec('ALTER TABLE media_items ADD COLUMN in_watchlist INTEGER DEFAULT 0')
  }

  // Add expires_at column to invite_codes
  const inviteColumns = (db.pragma('table_info(invite_codes)') as { name: string }[]).map((c) => c.name)
  if (!inviteColumns.includes('expires_at')) {
    db.exec("ALTER TABLE invite_codes ADD COLUMN expires_at TEXT")
  }
}
