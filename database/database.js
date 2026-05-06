const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'bot.db'));

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA synchronous = NORMAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS linked_accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       TEXT NOT NULL,
    guild_id      TEXT NOT NULL,
    platform      TEXT NOT NULL CHECK(platform IN ('youtube','kick','twitter')),
    channel_id    TEXT NOT NULL,
    channel_name  TEXT NOT NULL,
    channel_slug  TEXT,
    channel_image TEXT,
    created_at    INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, guild_id, platform)
  );

  CREATE TABLE IF NOT EXISTS notification_channels (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id           TEXT NOT NULL,
    platform           TEXT NOT NULL CHECK(platform IN ('youtube','kick','twitter')),
    discord_channel_id TEXT NOT NULL,
    UNIQUE(guild_id, platform)
  );

  CREATE TABLE IF NOT EXISTS log_channels (
    guild_id   TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    command  TEXT NOT NULL,
    role_id  TEXT NOT NULL,
    UNIQUE(guild_id, command, role_id)
  );

  CREATE TABLE IF NOT EXISTS command_channels (
    guild_id   TEXT NOT NULL,
    command    TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    PRIMARY KEY (guild_id, command, channel_id)
  );

  CREATE TABLE IF NOT EXISTS auto_replies (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id         TEXT NOT NULL,
    keyword          TEXT NOT NULL,
    responses        TEXT NOT NULL,
    allowed_channels TEXT,
    cooldown         INTEGER DEFAULT 60,
    created_by       TEXT,
    created_at       INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id         TEXT NOT NULL,
    channel_id       TEXT NOT NULL DEFAULT '0',
    title            TEXT,
    message          TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL DEFAULT 60,
    enabled          INTEGER DEFAULT 1,
    is_template      INTEGER DEFAULT 0,
    created_by       TEXT,
    created_at       INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS notification_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    platform   TEXT NOT NULL,
    content_id TEXT NOT NULL,
    sent_at    INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(guild_id, platform, content_id)
  );

  CREATE TABLE IF NOT EXISTS cooldowns (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   TEXT NOT NULL,
    guild_id  TEXT NOT NULL,
    action    TEXT NOT NULL,
    last_used INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(user_id, guild_id, action)
  );
`);

// ── Migrations ────────────────────────────────────────────
const migrations = [
  'ALTER TABLE reminders ADD COLUMN title TEXT',
  'ALTER TABLE reminders ADD COLUMN is_template INTEGER DEFAULT 0',
  "ALTER TABLE reminders ADD COLUMN channel_id TEXT NOT NULL DEFAULT '0'",
  'CREATE TABLE IF NOT EXISTS command_channels (guild_id TEXT NOT NULL, command TEXT NOT NULL, channel_id TEXT NOT NULL, PRIMARY KEY (guild_id, command, channel_id))',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch (_) {}
}

module.exports = db;
