const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../database/database');
const { sendLog } = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('تحديد روم السجلات (Logs)')
    .setDefaultMemberPermissions(8)
    .addChannelOption(o => o.setName('channel').setDescription('القناة المخصصة للسجلات').setRequired(true)),

  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: '❌ هذا الأمر للمسؤولين فقط.', flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.options.getChannel('channel');

    db.prepare(`
      INSERT INTO log_channels (guild_id, channel_id) VALUES (?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET channel_id = excluded.channel_id
    `).run(interaction.guildId, channel.id);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ تم تحديد روم السجلات')
      .setDescription(`سيتم إرسال جميع السجلات إلى: ${channel}`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

    await sendLog(interaction.client, interaction.guildId, {
      type: 'info',
      title: 'تم تحديد روم السجلات',
      description: `بواسطة **${interaction.user.tag}** — القناة: ${channel}`
    });
  }
};
