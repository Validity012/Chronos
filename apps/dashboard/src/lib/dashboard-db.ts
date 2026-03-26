import Database from 'better-sqlite3';
import path from 'path';

// Path to dashboard database
const DB_PATH = path.join(process.cwd(), '../../data/dashboard.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id TEXT PRIMARY KEY DEFAULT 'default',
      theme TEXT NOT NULL DEFAULT 'system',
      sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
      dashboard_order TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lms_cache (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      CHECK (type IN ('assignments', 'grades', 'courses'))
    );

    CREATE TABLE IF NOT EXISTS task_cache (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL,
      CHECK (type IN ('tasks', 'calendar'))
    );

    CREATE TABLE IF NOT EXISTS lms_session (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      cookies TEXT NOT NULL,
      token TEXT NOT NULL,
      last_used TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lms_cache_type ON lms_cache(type);
    CREATE INDEX IF NOT EXISTS idx_task_cache_type ON task_cache(type);
  `);

  // Ensure default preferences exist
  db.prepare(`INSERT OR IGNORE INTO user_preferences (id) VALUES ('default')`).run();
}

export interface UserPreferences {
  id: string;
  theme: string;
  sidebar_collapsed: number;
  dashboard_order: string;
  created_at: string;
  updated_at: string;
}

// User Preferences
export function getUserPreferences(): UserPreferences {
  return getDb().prepare('SELECT * FROM user_preferences WHERE id = ?').get('default') as UserPreferences;
}

export function updateTheme(theme: string) {
  getDb().prepare(`
    UPDATE user_preferences SET theme = ?, updated_at = datetime('now') WHERE id = 'default'
  `).run(theme);
}

export function updateSidebarCollapsed(collapsed: boolean) {
  getDb().prepare(`
    UPDATE user_preferences SET sidebar_collapsed = ?, updated_at = datetime('now') WHERE id = 'default'
  `).run(collapsed ? 1 : 0);
}

// LMS Cache
export interface CacheEntry {
  id: string;
  type: string;
  data: string;
  fetched_at: string;
  expires_at: string;
}

export function getLmsCache(type: string): CacheEntry | null {
  const entry = getDb().prepare(`
    SELECT * FROM lms_cache 
    WHERE type = ? AND datetime(expires_at) > datetime('now')
    ORDER BY fetched_at DESC LIMIT 1
  `).get(type) as CacheEntry | undefined;
  return entry ?? null;
}

export function setLmsCache(type: string, data: string, ttlMinutes: number) {
  const db = getDb();
  // Upsert: delete old, insert new
  db.prepare('DELETE FROM lms_cache WHERE type = ?').run(type);
  db.prepare(`
    INSERT INTO lms_cache (type, data, expires_at) VALUES (?, ?, datetime('now', '+' || ? || ' minutes'))
  `).run(type, data, ttlMinutes);
}

// Task Cache
export function getTaskCache(type: string): CacheEntry | null {
  const entry = getDb().prepare(`
    SELECT * FROM task_cache 
    WHERE type = ? AND datetime(expires_at) > datetime('now')
    ORDER BY fetched_at DESC LIMIT 1
  `).get(type) as CacheEntry | undefined;
  return entry ?? null;
}

export function setTaskCache(type: string, data: string, ttlMinutes: number) {
  const db = getDb();
  db.prepare('DELETE FROM task_cache WHERE type = ?').run(type);
  db.prepare(`
    INSERT INTO task_cache (type, data, expires_at) VALUES (?, ?, datetime('now', '+' || ? || ' minutes'))
  `).run(type, data, ttlMinutes);
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
