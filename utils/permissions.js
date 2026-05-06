const db = require('../database/database');

/**
 * التحقق من صلاحية المستخدم لاستخدام أمر معين
 * @param {GuildMember} member
 * @param {string} guildId
 * @param {string} command
 * @param {string|null} channelId — إذا كان محدداً يتحقق من القناة أيضاً
 */
function hasPermission(member, guildId, command, channelId = null) {
  // المسؤول دائماً مسموح له
  if (member.permissions.has('Administrator')) return true;

  // التحقق من الرتب
  const roles = db.prepare(
    'SELECT role_id FROM role_permissions WHERE guild_id=? AND command=?'
  ).all(guildId, command);

  if (roles.length > 0 && !roles.some(r => member.roles.cache.has(r.role_id))) {
    return false;
  }

  // التحقق من القناة المسموحة للأمر
  if (channelId) {
    const channels = db.prepare(
      'SELECT channel_id FROM command_channels WHERE guild_id=? AND command=?'
    ).all(guildId, command);
    if (channels.length > 0 && !channels.some(c => c.channel_id === channelId)) {
      return false;
    }
  }

  return true;
}

/** الرتب المسموحة لأمر معين */
function getPermittedRoles(guildId, command) {
  return db.prepare(
    'SELECT role_id FROM role_permissions WHERE guild_id=? AND command=?'
  ).all(guildId, command).map(r => r.role_id);
}

/** القنوات المسموحة لأمر معين */
function getPermittedChannels(guildId, command) {
  return db.prepare(
    'SELECT channel_id FROM command_channels WHERE guild_id=? AND command=?'
  ).all(guildId, command).map(c => c.channel_id);
}

/** ملخص صلاحيات أمر معين */
function getPermissionSummary(guildId, command) {
  const roles    = getPermittedRoles(guildId, command);
  const channels = getPermittedChannels(guildId, command);
  let level = '🟢 **للجميع**';
  if (roles.length > 0 && channels.length > 0) level = '🔴 **رتب + قنوات محددة**';
  else if (roles.length > 0)                    level = '🟡 **رتب محددة**';
  else if (channels.length > 0)                 level = '🔵 **قنوات محددة**';
  return { roles, channels, level };
}

/** مسح جميع القيود (رتب وقنوات) لأمر معين */
function clearPermissions(guildId, command) {
  db.prepare('DELETE FROM role_permissions WHERE guild_id=? AND command=?').run(guildId, command);
  db.prepare('DELETE FROM command_channels WHERE guild_id=? AND command=?').run(guildId, command);
}

/** تعيين رتب لأمر (يستبدل القديمة) */
function setRoles(guildId, command, roleIds) {
  db.prepare('DELETE FROM role_permissions WHERE guild_id=? AND command=?').run(guildId, command);
  const insert = db.prepare('INSERT OR IGNORE INTO role_permissions (guild_id, command, role_id) VALUES (?,?,?)');
  for (const id of roleIds) insert.run(guildId, command, id);
}

/** تعيين قنوات لأمر (يستبدل القديمة) */
function setChannels(guildId, command, channelIds) {
  db.prepare('DELETE FROM command_channels WHERE guild_id=? AND command=?').run(guildId, command);
  const insert = db.prepare('INSERT OR IGNORE INTO command_channels (guild_id, command, channel_id) VALUES (?,?,?)');
  for (const id of channelIds) insert.run(guildId, command, id);
}

module.exports = {
  hasPermission,
  getPermittedRoles,
  getPermittedChannels,
  getPermissionSummary,
  clearPermissions,
  setRoles,
  setChannels,
};
