const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, ChannelSelectMenuBuilder,
  ChannelType, MessageFlags
} = require('discord.js');
const db = require('../database/database');
const { sendLog } = require('../utils/logger');

const PLATFORMS = {
  youtube: { color: 0xFF0000, label: '🎥 YouTube',      icon: 'https://www.gstatic.com/youtube/img/branding/favicon/favicon_32x32.png' },
  kick:    { color: 0x53FC18, label: '🟢 Kick',          icon: 'https://kick.com/favicon.ico' },
  twitter: { color: 0x1A8CD8, label: '𝕏 Twitter / X',  icon: 'https://abs.twimg.com/favicons/twitter.2.ico' }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('تحديد روم الإشعارات لكل منصة')
    .setDefaultMemberPermissions(8)
    .addStringOption(o =>
      o.setName('platform')
        .setDescription('المنصة')
        .setRequired(true)
        .addChoices(
          { name: '🎥 YouTube',      value: 'youtube' },
          { name: '🟢 Kick',          value: 'kick'    },
          { name: '𝕏 Twitter / X',  value: 'twitter' }
        )
    )
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('القناة التي ستصلها الإشعارات')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ خطأ')
            .setDescription('هذا الأمر للمسؤولين فقط.')
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    const platform = interaction.options.getString('platform');
    const channel  = interaction.options.getChannel('channel');
    const cfg      = PLATFORMS[platform];

    db.prepare(`
      INSERT INTO notification_channels (guild_id, platform, discord_channel_id)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, platform) DO UPDATE SET discord_channel_id = excluded.discord_channel_id
    `).run(interaction.guildId, platform, channel.id);

    const embed = new EmbedBuilder()
      .setColor(cfg.color)
      .setTitle('✅ تم تحديد روم الإشعارات')
      .setDescription(`سيتم إرسال إشعارات **${cfg.label}** إلى ${channel}`)
      .addFields(
        { name: '🌐 المنصة',  value: cfg.label,       inline: true },
        { name: '📢 القناة',  value: `${channel}`,    inline: true }
      )
      .setFooter({ text: 'استخدم /link لربط قناتك أولاً' })
      .setTimestamp();

    await sendLog(interaction.client, interaction.guildId, {
      type: 'success',
      title: 'تم تحديد روم إشعارات',
      description: `**${interaction.user.tag}** حدّد روم الإشعارات لـ **${cfg.label}**: ${channel}`,
      fields: [{ name: '📢 الروم', value: `<#${channel.id}>`, inline: true }]
    });

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
