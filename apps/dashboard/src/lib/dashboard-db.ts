import { createClient } from '@libsql/client';

const dbUrl = process.env.DATABASE_URL ?? 'file:../data/dashboard.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

let _client: ReturnType<typeof createClient> | null = null;
let _schemaInitialized = false;

function getDb() {
  if (!_client) {
    const url = authToken && dbUrl.includes('turso.io')
      ? `${dbUrl}?authToken=${authToken}`
      : dbUrl;
    _client = createClient({ url });
  }
  return _client;
}

async function ensureSchema() {
  if (_schemaInitialized || typeof window !== 'undefined') return;
  _schemaInitialized = true;
  try {
    const db = getDb();
    await db.execute(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY DEFAULT 'default',
        theme TEXT NOT NULL DEFAULT 'system',
        sidebar_collapsed INTEGER NOT NULL DEFAULT 0,
        dashboard_order TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS lms_cache (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        CHECK (type IN ('assignments', 'grades', 'courses', 'lms'))
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS task_cache (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        CHECK (type IN ('tasks', 'calendar'))
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS lms_session (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        cookies TEXT NOT NULL,
        token TEXT NOT NULL,
        last_used TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_lms_cache_type ON lms_cache(type)`);
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_task_cache_type ON task_cache(type)`);
    await db.execute(`INSERT OR IGNORE INTO user_preferences (id) VALUES ('default')`);
  } catch (_) {
    _schemaInitialized = false;
  }
}

type Row = Record<string, unknown>;

function rowToObj<T>(row: Row): T {
  return row as T;
}

export interface UserPreferences {
  id: string;
  theme: string;
  sidebar_collapsed: number;
  dashboard_order: string;
  created_at: string;
  updated_at: string;
}

export async function getUserPreferences(): Promise<UserPreferences> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT * FROM user_preferences WHERE id = ?',
    args: ['default'],
  });
  return rowToObj<UserPreferences>((result.rows[0] ?? {}) as Row);
}

export async function updateTheme(theme: string) {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: "UPDATE user_preferences SET theme = ?, updated_at = datetime('now') WHERE id = 'default'",
    args: [theme],
  });
}

export async function updateSidebarCollapsed(collapsed: boolean) {
  await ensureSchema();
  const db = getDb();
  await db.execute({
    sql: "UPDATE user_preferences SET sidebar_collapsed = ?, updated_at = datetime('now') WHERE id = 'default'",
    args: [collapsed ? 1 : 0],
  });
}

export interface CacheEntry {
  id: string;
  type: string;
  data: string;
  fetched_at: string;
  expires_at: string;
}

export async function getLmsCache(type: string): Promise<CacheEntry | null> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM lms_cache WHERE type = ? AND datetime(expires_at) > datetime('now') ORDER BY fetched_at DESC LIMIT 1`,
    args: [type],
  });
  if (result.rows.length === 0) return null;
  return rowToObj<CacheEntry>((result.rows[0]) as Row);
}

export async function setLmsCache(type: string, data: string, ttlMinutes: number) {
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM lms_cache WHERE type = ?', args: [type] });
  await db.execute({
    sql: `INSERT INTO lms_cache (type, data, expires_at) VALUES (?, ?, datetime('now', '+' || ? || ' minutes'))`,
    args: [type, data, ttlMinutes],
  });
}

export async function getTaskCache(type: string): Promise<CacheEntry | null> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM task_cache WHERE type = ? AND datetime(expires_at) > datetime('now') ORDER BY fetched_at DESC LIMIT 1`,
    args: [type],
  });
  if (result.rows.length === 0) return null;
  return rowToObj<CacheEntry>((result.rows[0]) as Row);
}

export async function setTaskCache(type: string, data: string, ttlMinutes: number) {
  await ensureSchema();
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM task_cache WHERE type = ?', args: [type] });
  await db.execute({
    sql: `INSERT INTO task_cache (type, data, expires_at) VALUES (?, ?, datetime('now', '+' || ? || ' minutes'))`,
    args: [type, data, ttlMinutes],
  });
}

export interface SessionEntry {
  id: string;
  cookies: string;
  token: string;
  last_used: string;
  expires_at: string | null;
  created_at: string;
}

export async function getGoogleSession(): Promise<SessionEntry | null> {
  await ensureSchema();
  const db = getDb();
  const result = await db.execute({
    sql: `SELECT * FROM lms_session WHERE id = 'google-tasks' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')) LIMIT 1`,
    args: [],
  });
  if (result.rows.length === 0) return null;
  return rowToObj<SessionEntry>((result.rows[0]) as Row);
}

export async function setGoogleSession(tokens: { expiry_date?: number | null; access_token?: string | null }) {
  await ensureSchema();
  const db = getDb();
  const expirySeconds = tokens.expiry_date
    ? Math.floor((tokens.expiry_date - Date.now()) / 1000)
    : 3600;
  await db.execute({
    sql: `INSERT OR REPLACE INTO lms_session (id, cookies, token, last_used, expires_at) VALUES ('google-tasks', ?, ?, datetime('now'), datetime('now', '+' || ? || ' seconds'))`,
    args: ['google-tasks', JSON.stringify(tokens), tokens.access_token || '', expirySeconds],
  });
}
