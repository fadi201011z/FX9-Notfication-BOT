const { EmbedBuilder } = require('discord.js');
const db = require('../database/database');
const { isOnCooldown, setCooldown } = require('../utils/cooldown');

// ألوان وأيقونات إسلامية + فاخرة
const PALETTES = [
  { color: 0x1B5E20, icon: '🌿' },
  { color: 0x2E7D32, icon: '📿' },
  { color: 0x0D47A1, icon: '📖' },
  { color: 0x4A148C, icon: '🤲' },
  { color: 0x880E4F, icon: '💝' },
  { color: 0x37474F, icon: '✨' },
  { color: 0x5865F2, icon: '💫' },
  { color: 0x1A8CD8, icon: '🌟' },
  { color: 0xF39C12, icon: '☀️' },
  { color: 0x27AE60, icon: '🌸' },
];

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot) return;
    if (!message.guild)     return;

    const content = message.content.toLowerCase();
    const guildId = message.guild.id;

    const replies = db.prepare('SELECT * FROM auto_replies WHERE guild_id=?').all(guildId);

    for (const reply of replies) {
      if (!content.includes(reply.keyword.toLowerCase())) continue;

      // تحقق من القنوات المسموحة لهذا الرد
      if (reply.allowed_channels) {
        const allowed = reply.allowed_channels.split(',').map(c => c.trim()).filter(Boolean);
        if (allowed.length > 0 && !allowed.includes(message.channel.id)) continue;
      }

      const cooldownKey = `ar_${reply.id}`;
      if (isOnCooldown(message.author.id, guildId, cooldownKey, reply.cooldown)) continue;

      const responses = reply.responses.split('\n').filter(r => r.trim());
      if (!responses.length) continue;

      const chosen = responses[Math.floor(Math.random() * responses.length)];

      // اختيار نمط عشوائي
      const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];

      const embed = new EmbedBuilder()
        .setColor(palette.color)
        .setDescription(chosen)
        .setAuthor({
          name: message.guild.name,
          iconURL: message.guild.iconURL({ dynamic: true }) || undefined,
        })
        .setFooter({
          text: `${palette.icon} رد تلقائي`,
          iconURL: message.client.user.displayAvatarURL(),
        })
        .setTimestamp();

      try {
        await message.reply({ embeds: [embed] });
        setCooldown(message.author.id, guildId, cooldownKey);
      } catch (err) {
        console.error('[AutoReply]', err.message);
      }
      break;
    }
  }
};
