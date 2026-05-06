/**
 * /setroles — لوحة الصلاحيات المتقدمة
 * يدعم: تحديد الرتب + القنوات المسموحة لكل أمر
 */
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  RoleSelectMenuBuilder, ChannelSelectMenuBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags, ChannelType,
} = require('discord.js');
const db = require('../database/database');
const { sendLog }        = require('../utils/logger');
const {
  getPermissionSummary, clearPermissions, setRoles, setChannels
} = require('../utils/permissions');

// الأوامر القابلة للضبط
const MANAGEABLE_COMMANDS = [
  { value: 'add',       label: '📢 /add',       desc: 'نشر الإعلانات' },
  { value: 'link',      label: '🔗 /link',      desc: 'ربط القنوات' },
  { value: 'test',      label: '🧪 /test',      desc: 'اختبار الإشعارات' },
  { value: 'autoreply', label: '💬 /autoreply', desc: 'الردود التلقائية' },
  { value: 'reminder',  label: '⏰ /reminder',  desc: 'التذكيرات التلقائية' },
];

// ── بناء إمبد اللوحة الرئيسية ──────────────────────────────
function buildDashboardEmbed(guildId) {
  const lines = MANAGEABLE_COMMANDS.map(cmd => {
    const { roles, channels, level } = getPermissionSummary(guildId, cmd.value);
    const roleStr    = roles.length    ? roles.map(r => `<@&${r}>`).join(' ').slice(0, 60)    : '─';
    const channelStr = channels.length ? channels.map(c => `<#${c}>`).join(' ').slice(0, 60)  : '─';
    return [
      `**${cmd.label}** — ${level}`,
      `┣ 👥 الرتب: ${roleStr}`,
      `┗ 📢 القنوات: ${channelStr}`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setColor(0x2C3E50)
    .setAuthor({ name: '🔐 لوحة إدارة الصلاحيات' })
    .setTitle('🛡️ نظام الصلاحيات المتقدم')
    .setDescription(
      '> اختر أمراً من القائمة لضبط صلاحياته\n' +
      '> يمكنك تحديد **الرتب المسموحة** و**القنوات المسموحة** لكل أمر\n\n' +
      '**━━━ حالة الأوامر الحالية ━━━**\n\n' +
      lines.join('\n\n')
    )
    .addFields(
      { name: '🟢 للجميع',            value: 'لا يوجد قيود',                  inline: true },
      { name: '🟡 رتب محددة',          value: 'فقط الرتب المختارة',             inline: true },
      { name: '🔵 قنوات محددة',        value: 'فقط في قنوات معينة',             inline: true },
    )
    .setFooter({ text: 'المسؤول يتجاوز جميع القيود دائماً' })
    .setTimestamp();
}

// ── بناء إمبد تفاصيل أمر واحد ─────────────────────────────
function buildCommandEmbed(guildId, command) {
  const cmd = MANAGEABLE_COMMANDS.find(c => c.value === command);
  const { roles, channels, level } = getPermissionSummary(guildId, command);

  const roleStr    = roles.length    ? roles.map(r => `<@&${r}>`).join('\n')   : '🟢 **الجميع مسموح لهم**';
  const channelStr = channels.length ? channels.map(c => `<#${c}>`).join('\n') : '🟢 **كل القنوات مسموحة**';

  return new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({ name: `🔧 إعدادات أمر ${cmd?.label || command}` })
    .setTitle(`${level}`)
    .setDescription(`إدارة الصلاحيات للأمر **${cmd?.label || command}** — ${cmd?.desc || ''}`)
    .addFields(
      { name: '👥 الرتب المسموحة',    value: roleStr,    inline: true },
      { name: '📢 القنوات المسموحة',  value: channelStr, inline: true },
    )
    .setFooter({ text: 'استخدم الأزرار أدناه لتعديل الإعدادات' })
    .setTimestamp();
}

// ── مكوّنات القائمة الرئيسية ─────────────────────────────
function dashboardComponents() {
  const select = new StringSelectMenuBuilder()
    .setCustomId('setroles_command_select')
    .setPlaceholder('🔧 اختر الأمر الذي تريد ضبط صلاحياته')
    .addOptions(MANAGEABLE_COMMANDS.map(cmd => ({
      label: cmd.label, value: cmd.value, description: cmd.desc
    })));
  return [new ActionRowBuilder().addComponents(select)];
}

// ── مكوّنات صفحة الأمر ──────────────────────────────────
function commandComponents(command) {
  const rolesBtn = new ButtonBuilder()
    .setCustomId('setroles_roles_btn')
    .setLabel('👥 تعديل الرتب')
    .setStyle(ButtonStyle.Primary);

  const chansBtn = new ButtonBuilder()
    .setCustomId('setroles_chans_btn')
    .setLabel('📢 تعديل القنوات')
    .setStyle(ButtonStyle.Primary);

  const clearBtn = new ButtonBuilder()
    .setCustomId('setroles_clear_all')
    .setLabel('🟢 للجميع بلا قيود')
    .setStyle(ButtonStyle.Success);

  const backBtn = new ButtonBuilder()
    .setCustomId('setroles_back')
    .setLabel('◀ رجوع')
    .setStyle(ButtonStyle.Secondary);

  return [new ActionRowBuilder().addComponents(rolesBtn, chansBtn, clearBtn, backBtn)];
}

// ═══════════════════════════════════════════════════════════
module.exports = {
  data: new SlashCommandBuilder()
    .setName('setroles')
    .setDescription('🔐 لوحة إدارة الصلاحيات المتقدمة')
    .setDefaultMemberPermissions(8),

  // ── /setroles ─────────────────────────────────────────
  async execute(interaction) {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('🚫 أدمن فقط').setDescription('هذا الأمر للمسؤولين فقط.')],
        flags: MessageFlags.Ephemeral
      });
    }

    return interaction.reply({
      embeds: [buildDashboardEmbed(interaction.guildId)],
      components: dashboardComponents(),
      flags: MessageFlags.Ephemeral
    });
  },

  // ── Select Menus ──────────────────────────────────────
  async handleSelectMenu(interaction) {

    // اختيار الأمر من القائمة
    if (interaction.customId === 'setroles_command_select') {
      const command = interaction.values[0];
      if (!interaction.client._pendingRoleSetup) interaction.client._pendingRoleSetup = new Map();
      interaction.client._pendingRoleSetup.set(`${interaction.guildId}_${interaction.user.id}`, { command });

      return interaction.update({
        embeds: [buildCommandEmbed(interaction.guildId, command)],
        components: commandComponents(command)
      });
    }

    // اختيار الرتب
    if (interaction.customId === 'setroles_role_select') {
      const stored = interaction.client._pendingRoleSetup?.get(`${interaction.guildId}_${interaction.user.id}`);
      if (!stored) return interaction.update({ content: '❌ انتهت الجلسة.', embeds: [], components: [] });

      const { command } = stored;
      setRoles(interaction.guildId, command, interaction.values);

      await sendLog(interaction.client, interaction.guildId, {
        type: 'success', title: `🔐 تحديث صلاحيات /${command}`,
        description: `**${interaction.user.tag}** حدّد الرتب: ${interaction.values.map(r => `<@&${r}>`).join(', ')}`
      });

      return interaction.update({
        embeds: [buildCommandEmbed(interaction.guildId, command)],
        components: commandComponents(command)
      });
    }

    // اختيار القنوات
    if (interaction.customId === 'setroles_chan_select') {
      const stored = interaction.client._pendingRoleSetup?.get(`${interaction.guildId}_${interaction.user.id}`);
      if (!stored) return interaction.update({ content: '❌ انتهت الجلسة.', embeds: [], components: [] });

      const { command } = stored;
      setChannels(interaction.guildId, command, interaction.values);

      await sendLog(interaction.client, interaction.guildId, {
        type: 'success', title: `🔐 تقييد قنوات /${command}`,
        description: `**${interaction.user.tag}** حدّد القنوات: ${interaction.values.map(c => `<#${c}>`).join(', ')}`
      });

      return interaction.update({
        embeds: [buildCommandEmbed(interaction.guildId, command)],
        components: commandComponents(command)
      });
    }
  },

  // ── Buttons ───────────────────────────────────────────
  async handleButton(interaction) {

    // رجوع للوحة الرئيسية
    if (interaction.customId === 'setroles_back') {
      return interaction.update({
        embeds: [buildDashboardEmbed(interaction.guildId)],
        components: dashboardComponents()
      });
    }

    // فتح قائمة اختيار الرتب
    if (interaction.customId === 'setroles_roles_btn') {
      const stored = interaction.client._pendingRoleSetup?.get(`${interaction.guildId}_${interaction.user.id}`);
      if (!stored) return interaction.update({ content: '❌ انتهت الجلسة.', embeds: [], components: [] });

      const { command } = stored;
      const { roles } = getPermissionSummary(interaction.guildId, command);

      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('setroles_role_select')
        .setPlaceholder('👥 اختر رتبة أو أكثر')
        .setMinValues(1).setMaxValues(25);

      const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`👥 اختر الرتب المسموحة لـ /${command}`)
        .setDescription(
          `الرتب الحالية: ${roles.length ? roles.map(r => `<@&${r}>`).join(', ') : '**الجميع (بلا قيود)**'}\n\n` +
          '> اختر رتبة أو أكثر — فقط هؤلاء سيتمكنون من استخدام الأمر'
        )
        .setFooter({ text: 'المسؤولون يتجاوزون هذا الإعداد دائماً' });

      const backBtn = new ButtonBuilder()
        .setCustomId('setroles_back_cmd')
        .setLabel('◀ إلغاء')
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(roleSelect),
          new ActionRowBuilder().addComponents(backBtn)
        ]
      });
    }

    // فتح قائمة اختيار القنوات
    if (interaction.customId === 'setroles_chans_btn') {
      const stored = interaction.client._pendingRoleSetup?.get(`${interaction.guildId}_${interaction.user.id}`);
      if (!stored) return interaction.update({ content: '❌ انتهت الجلسة.', embeds: [], components: [] });

      const { command } = stored;
      const { channels } = getPermissionSummary(interaction.guildId, command);

      const chanSelect = new ChannelSelectMenuBuilder()
        .setCustomId('setroles_chan_select')
        .setPlaceholder('📢 اختر قناة أو أكثر')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1).setMaxValues(25);

      const embed = new EmbedBuilder()
        .setColor(0x1A8CD8)
        .setTitle(`📢 اختر القنوات المسموحة لـ /${command}`)
        .setDescription(
          `القنوات الحالية: ${channels.length ? channels.map(c => `<#${c}>`).join(', ') : '**كل القنوات (بلا قيود)**'}\n\n` +
          '> سيعمل الأمر فقط في القنوات المختارة'
        );

      const backBtn = new ButtonBuilder()
        .setCustomId('setroles_back_cmd')
        .setLabel('◀ إلغاء')
        .setStyle(ButtonStyle.Secondary);

      return interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder().addComponents(chanSelect),
          new ActionRowBuilder().addComponents(backBtn)
        ]
      });
    }

    // مسح جميع القيود
    if (interaction.customId === 'setroles_clear_all') {
      const stored = interaction.client._pendingRoleSetup?.get(`${interaction.guildId}_${interaction.user.id}`);
      if (!stored) return interaction.update({ content: '❌ انتهت الجلسة.', embeds: [], components: [] });

      const { command } = stored;
      clearPermissions(interaction.guildId, command);

      await sendLog(interaction.client, interaction.guildId, {
        type: 'warning', title: `🟢 إزالة قيود /${command}`,
        description: `**${interaction.user.tag}** أزال جميع قيود أمر /${command} — أصبح للجميع`
      });

      return interaction.update({
        embeds: [buildCommandEmbed(interaction.guildId, command)],
        components: commandComponents(command)
      });
    }

    // الرجوع لصفحة الأمر
    if (interaction.customId === 'setroles_back_cmd') {
      const stored = interaction.client._pendingRoleSetup?.get(`${interaction.guildId}_${interaction.user.id}`);
      const command = stored?.command;
      if (!command) {
        return interaction.update({
          embeds: [buildDashboardEmbed(interaction.guildId)],
          components: dashboardComponents()
        });
      }
      return interaction.update({
        embeds: [buildCommandEmbed(interaction.guildId, command)],
        components: commandComponents(command)
      });
    }
  }
};
