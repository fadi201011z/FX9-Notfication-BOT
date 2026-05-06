const db = require('../database/database');

function isOnCooldown(userId, guildId, action, seconds) {
  const row = db.prepare(
    'SELECT last_used FROM cooldowns WHERE user_id = ? AND guild_id = ? AND action = ?'
  ).get(userId, guildId, action);

  if (!row) return false;

  const elapsed = Math.floor(Date.now() / 1000) - row.last_used;
  return elapsed < seconds;
}

function getRemainingCooldown(userId, guildId, action, seconds) {
  const row = db.prepare(
    'SELECT last_used FROM cooldowns WHERE user_id = ? AND guild_id = ? AND action = ?'
  ).get(userId, guildId, action);

  if (!row) return 0;

  const elapsed = Math.floor(Date.now() / 1000) - row.last_used;
  const remaining = seconds - elapsed;
  return remaining > 0 ? remaining : 0;
}

function setCooldown(userId, guildId, action) {
  db.prepare(`
    INSERT INTO cooldowns (user_id, guild_id, action, last_used)
    VALUES (?, ?, ?, strftime('%s','now'))
    ON CONFLICT(user_id, guild_id, action) DO UPDATE SET last_used = strftime('%s','now')
  `).run(userId, guildId, action);
}

module.exports = { isOnCooldown, getRemainingCooldown, setCooldown };
