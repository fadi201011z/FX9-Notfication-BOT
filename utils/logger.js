const { EmbedBuilder } = require('discord.js');
const db = require('../database/database');

const TYPE_CONFIG = {
  info:    { color: 0x5865F2, icon: '📋', bar: '▬▬▬▬▬▬▬▬▬▬' },
  success: { color: 0x2ECC71, icon: '✅', bar: '▬▬▬▬▬▬▬▬▬▬' },
  warning: { color: 0xF39C12, icon: '⚠️', bar: '▬▬▬▬▬▬▬▬▬▬' },
  error:   { color: 0xE74C3C, icon: '❌', bar: '▬▬▬▬▬▬▬▬▬▬' },
};

async function sendLog(client, guildId, { type = 'info', title, description, fields = [] }) {
  try {
    const row = db.prepare('SELECT channel_id FROM log_channels WHERE guild_id=?').get(guildId);
    if (!row) return;

    const ch = await client.channels.fetch(row.channel_id).catch(() => null);
    if (!ch) return;

    const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;

    const embed = new EmbedBuilder()
      .setColor(cfg.color)
      .setAuthor({ name: `${cfg.icon}  ${title}`, iconURL: client.user.displayAvatarURL() })
      .setTimestamp()
      .setFooter({ text: `📋 سجل العمليات  •  ${client.user.username}` });

    if (description) embed.setDescription(description);

    if (fields.length > 0) {
      embed.addFields(fields.map(f => ({
        name: f.name, value: String(f.value), inline: f.inline ?? false
      })));
    }

    await ch.send({ embeds: [embed] });
  } catch (err) {
    console.error('[Logger]', err.message);
  }
}

module.exports = { sendLog };
