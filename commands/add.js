// /add — نشر إعلان فاخر مع منشن (رتبة / @everyone / @here) وتحديد القناة
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  MessageFlags, ChannelType
} = require('discord.js');
const { hasPermission }            = require('../utils/permissions');
const { isOnCooldown, setCooldown, getRemainingCooldown } = require('../utils/cooldown');
const { sendLog }                  = require('../utils/logger');

const COOLDOWN_SECONDS = 10;

// ══════════════════════════════════════════════
//  منصات الإعلان (9 أنواع)
// ══════════════════════════════════════════════
const PLATFORM_CFG = {
  yt_video:  { color: 0xFF0000, label: '🎥 YouTube — فيديو جديد',  icon: 'https://www.gstatic.com/youtube/img/branding/favicon/favicon_32x32.png', badge: '▶ فيديو جديد' },
  yt_live:   { color: 0xFF2222, label: '🔴 YouTube — بث مباشر',   icon: 'https://www.gstatic.com/youtube/img/branding/favicon/favicon_32x32.png', badge: '🔴 مباشر الآن' },
  kick:      { color: 0x53FC18, label: '🟢 Kick — بث مباشر',       icon: 'https://kick.com/favicon.ico',                                           badge: '🟢 مباشر على Kick' },
  twitter:   { color: 0x1A8CD8, label: '𝕏 Twitter / X',            icon: 'https://abs.twimg.com/favicons/twitter.2.ico',                            badge: '𝕏 تغريدة جديدة' },
  event:     { color: 0xFEE75C, label: '📅 حدث أو فعالية',          icon: null,                                                                      badge: '📅 حدث قادم' },
  giveaway:  { color: 0xEB459E, label: '🎁 مسابقة / هدية',          icon: null,                                                                      badge: '🎁 مسابقة' },
  welcome:   { color: 0x57F287, label: '👋 ترحيب وإعلان',           icon: null,                                                                      badge: '👋 ترحيب' },
  news:      { color: 0x5865F2, label: '📰 خبر وتحديث',             icon: null,                                                                      badge: '📰 خبر جديد' },
  general:   { color: 0x99AAB5, label: '📢 إعلان عام',              icon: null,                                                                      badge: '📢 إعلان' },
};

// ══════════════════════════════════════════════
//  بناء الإمبد النهائي المنشور (فاخر)
// ══════════════════════════════════════════════
function buildFinalEmbed({ platform, title, description, link, imageUrl, thumbnailUrl, author }) {
  const cfg = PLATFORM_CFG[platform] || PLATFORM_CFG.general;

  const embed = new EmbedBuilder()
    .setColor(cfg.color)
    .setTimestamp();

  // Author / badge
  if (cfg.icon) embed.setAuthor({ name: `${cfg.badge}`, iconURL: cfg.icon });
  else          embed.setAuthor({ name: `${cfg.badge}` });

  if (title)        embed.setTitle(title);
  if (description)  embed.setDescription(description);
  if (imageUrl)     embed.setImage(imageUrl);
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

  if (link) {
    embed.addFields({
      name: '🔗 الرابط',
      value: `> [**اضغط هنا للمشاهدة ←**](${link})`,
    });
  }

  // إضافات خاصة لكل منصة
  if (platform === 'giveaway') {
    embed.addFields({ name: '🎊 كيفية المشاركة', value: '> تابع التعليمات أعلاه وشارك الآن!', inline: false });
  }
  if (platform === 'event') {
    embed.addFields({ name: '📌 ملاحظة', value: '> لا تفوّت هذا الحدث — سجّل حضورك!', inline: false });
  }
  if (platform === 'yt_live' || platform === 'kick') {
    embed.addFields({ name: '⚡ البث مباشر الآن', value: '> انضم الآن ولا تفوّتك اللحظات المميزة!', inline: false });
  }

  embed.setFooter({ text: `نُشر بواسطة ${author}  •  ${cfg.label}` });
  return embed;
}

// ══════════════════════════════════════════════
//  الإمبد التقديمي (معاينة أثناء الإعداد)
// ══════════════════════════════════════════════
function buildPreviewEmbed(state, authorTag) {
  const cfg = PLATFORM_CFG[state.platform] || PLATFORM_CFG.general;

  let mentionStr = '*بدون منشن*';
  if (state.mentionType === 'everyone') mentionStr = '`@everyone`';
  else if (state.mentionType === 'here') mentionStr = '`@here`';
  else if (state.mentionType === 'role' && state.roleId) mentionStr = `<@&${state.roleId}>`;
  else if (state.mentionType === 'role') mentionStr = '⏳ *اختر الرتبة...*';

  const channelStr = state.targetChannelId ? `<#${state.targetChannelId}>` : '*القناة الحالية (افتراضي)*';

  const embed = new EmbedBuilder()
    .setColor(cfg.color)
    .setAuthor({ name: `👁️ معاينة — ${cfg.label}` })
    .setTitle(state.title || '*(بدون عنوان)*')
    .setDescription(state.description || '*(بدون وصف)*')
    .addFields(
      { name: '📣 المنشن',        value: mentionStr,   inline: true },
      { name: '📢 قناة النشر',    value: channelStr,   inline: true },
      { name: '🔗 الرابط',        value: state.link ? `[رابط](${state.link})` : '*بدون*', inline: true },
    )
    .setFooter({ text: '✅ اضغط "نشر" عند الانتهاء من الإعداد' })
    .setTimestamp();

  if (state.imageUrl) embed.setImage(state.imageUrl);
  return embed;
}

// ══════════════════════════════════════════════
//  مكوّنات الخطوات
// ══════════════════════════════════════════════
function mentionRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('add_mention_select')
      .setPlaceholder('📣 اختر نوع المنشن')
      .addOptions([
        { label: '@everyone — تنبيه الجميع', value: 'everyone', emoji: '📢' },
        { label: '@here — تنبيه المتصلين',   value: 'here',     emoji: '👥' },
        { label: 'رتبة محددة',               value: 'role',     emoji: '🏷️' },
        { label: 'بدون منشن',                value: 'none',     emoji: '🔇' },
      ])
  );
}

function channelRow() {
  return new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('add_channel_select')
      .setPlaceholder('📢 اختر قناة النشر (أو اتركه للقناة الحالية)')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );
}

function roleRow() {
  return new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('add_role_select')
      .setPlaceholder('🏷️ اختر الرتبة التي سيتم منشنها')
  );
}

function actionRow(roleNeeded = false) {
  const publish = new ButtonBuilder()
    .setCustomId('add_publish')
    .setLabel('✅  نشر الإعلان')
    .setStyle(ButtonStyle.Success);
  const cancel = new ButtonBuilder()
    .setCustomId('add_cancel')
    .setLabel('❌  إلغاء')
    .setStyle(ButtonStyle.Danger);

  if (roleNeeded) {
    const rolesFirst = new ButtonBuilder()
      .setCustomId('add_publish')
      .setLabel('✅  نشر')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true);
    return new ActionRowBuilder().addComponents(rolesFirst, cancel);
  }
  return new ActionRowBuilder().addComponents(publish, cancel);
}

function buildStepComponents(state) {
  const rows = [mentionRow()];

  if (state.mentionType === 'role' && !state.roleId) {
    rows.push(roleRow());
  }

  rows.push(channelRow());
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('add_publish').setLabel('✅  نشر الإعلان').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('add_cancel').setLabel('❌  إلغاء').setStyle(ButtonStyle.Danger)
  ));
  return rows;
}

// ══════════════════════════════════════════════
//  الأمر
// ══════════════════════════════════════════════
module.exports = {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('نشر إعلان فاخر في السيرفر'),

  async execute(interaction) {
    if (!hasPermission(interaction.member, interaction.guildId, 'add')) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('🚫 لا صلاحية').setDescription('ليس لديك صلاحية استخدام هذا الأمر.')],
        flags: MessageFlags.Ephemeral
      });
    }
    if (isOnCooldown(interaction.user.id, interaction.guildId, 'add', COOLDOWN_SECONDS)) {
      const rem = getRemainingCooldown(interaction.user.id, interaction.guildId, 'add', COOLDOWN_SECONDS);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFEE75C).setTitle('⏳ انتظر قليلاً').setDescription(`انتظر **${rem}** ثانية قبل نشر إعلان جديد.`)],
        flags: MessageFlags.Ephemeral
      });
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('add_platform_select')
      .setPlaceholder('📌 اختر نوع الإعلان')
      .addOptions([
        { label: 'YouTube — فيديو جديد',   value: 'yt_video',  emoji: '🎥' },
        { label: 'YouTube — بث مباشر',     value: 'yt_live',   emoji: '🔴' },
        { label: 'Kick — بث مباشر',         value: 'kick',      emoji: '🟢' },
        { label: 'Twitter / X',             value: 'twitter',   emoji: '✖️' },
        { label: 'حدث أو فعالية',           value: 'event',     emoji: '📅' },
        { label: 'مسابقة / هدية',           value: 'giveaway',  emoji: '🎁' },
        { label: 'ترحيب وإعلان',            value: 'welcome',   emoji: '👋' },
        { label: 'خبر وتحديث',             value: 'news',      emoji: '📰' },
        { label: 'إعلان عام',              value: 'general',   emoji: '📢' },
      ]);

    setCooldown(interaction.user.id, interaction.guildId, 'add');

    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('📢  إنشاء إعلان جديد')
          .setDescription('اختر **نوع الإعلان** من القائمة أدناه لتبدأ الإعداد.')
          .setFooter({ text: 'يدعم 9 أنواع مختلفة من الإعلانات' })
      ],
      components: [new ActionRowBuilder().addComponents(select)],
      flags: MessageFlags.Ephemeral
    });
  },

  // ───── Select Menus ─────────────────────────────────────
  async handleSelectMenu(interaction) {

    // 1. اختيار نوع المنصة
    if (interaction.customId === 'add_platform_select') {
      const platform = interaction.values[0];
      const cfg      = PLATFORM_CFG[platform];

      const platformLabel = cfg.label.replace(/[^\w\u0600-\u06FF \-\/\.]/g, '').trim().slice(0, 40);

      const modal = new ModalBuilder()
        .setCustomId(`add_modal_${platform}`)
        .setTitle(platformLabel);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title').setLabel('عنوان الإعلان')
            .setStyle(TextInputStyle.Short).setRequired(false)
            .setMaxLength(200).setPlaceholder('مثال: بث جديد الليلة! 🎮')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('description').setLabel('نص الإعلان')
            .setStyle(TextInputStyle.Paragraph).setRequired(true)
            .setMaxLength(1800).setPlaceholder('اكتب تفاصيل الإعلان هنا...')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('link').setLabel('الرابط (اختياري)')
            .setStyle(TextInputStyle.Short).setRequired(false)
            .setPlaceholder('https://kick.com/username')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('image_url').setLabel('رابط الصورة (اختياري)')
            .setStyle(TextInputStyle.Short).setRequired(false)
            .setPlaceholder('https://i.imgur.com/example.png')
        )
      );

      return interaction.showModal(modal);
    }

    // 2. اختيار نوع المنشن
    if (interaction.customId === 'add_mention_select') {
      const stored = interaction.client._pendingAnnouncements?.get(interaction.user.id);
      if (!stored) return interaction.update({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ انتهت الجلسة، حاول مجدداً.')], components: [] });

      stored.mentionType = interaction.values[0];
      if (stored.mentionType !== 'role') stored.roleId = null;
      interaction.client._pendingAnnouncements.set(interaction.user.id, stored);

      return interaction.update({
        embeds: [buildPreviewEmbed(stored, interaction.user.tag)],
        components: buildStepComponents(stored)
      });
    }

    // 3. اختيار الرتبة
    if (interaction.customId === 'add_role_select') {
      const stored = interaction.client._pendingAnnouncements?.get(interaction.user.id);
      if (!stored) return interaction.update({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ انتهت الجلسة.')], components: [] });

      stored.roleId = interaction.values[0];
      interaction.client._pendingAnnouncements.set(interaction.user.id, stored);

      return interaction.update({
        embeds: [buildPreviewEmbed(stored, interaction.user.tag)],
        components: buildStepComponents(stored)
      });
    }

    // 4. اختيار قناة النشر
    if (interaction.customId === 'add_channel_select') {
      const stored = interaction.client._pendingAnnouncements?.get(interaction.user.id);
      if (!stored) return interaction.update({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ انتهت الجلسة.')], components: [] });

      stored.targetChannelId = interaction.values[0];
      interaction.client._pendingAnnouncements.set(interaction.user.id, stored);

      return interaction.update({
        embeds: [buildPreviewEmbed(stored, interaction.user.tag)],
        components: buildStepComponents(stored)
      });
    }
  },

  // ───── Modal ─────────────────────────────────────────────
  async handleModal(interaction) {
    if (!interaction.customId.startsWith('add_modal_')) return;

    const platform    = interaction.customId.replace('add_modal_', '');
    const title       = interaction.fields.getTextInputValue('title').trim();
    const description = interaction.fields.getTextInputValue('description').trim();
    const link        = interaction.fields.getTextInputValue('link').trim();
    const imageUrl    = interaction.fields.getTextInputValue('image_url').trim();

    if (!interaction.client._pendingAnnouncements) interaction.client._pendingAnnouncements = new Map();

    const state = { platform, title, description, link, imageUrl, guildId: interaction.guildId, mentionType: 'none', roleId: null, targetChannelId: null };
    interaction.client._pendingAnnouncements.set(interaction.user.id, state);

    return interaction.reply({
      embeds: [buildPreviewEmbed(state, interaction.user.tag)],
      components: buildStepComponents(state),
      flags: MessageFlags.Ephemeral
    });
  },

  // ───── Buttons ───────────────────────────────────────────
  async handleButton(interaction) {
    if (interaction.customId === 'add_cancel') {
      interaction.client._pendingAnnouncements?.delete(interaction.user.id);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('❌ تم الإلغاء').setDescription('تم إلغاء الإعلان.')],
        components: []
      });
    }

    if (interaction.customId === 'add_publish') {
      const stored = interaction.client._pendingAnnouncements?.get(interaction.user.id);
      if (!stored) return interaction.update({
        embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ انتهت الجلسة، حاول من جديد.')],
        components: []
      });

      // بناء الإمبد النهائي
      const finalEmbed = buildFinalEmbed({ ...stored, author: interaction.user.tag });

      // بناء المنشن
      let mentionContent = null;
      if (stored.mentionType === 'everyone')              mentionContent = '@everyone';
      else if (stored.mentionType === 'here')             mentionContent = '@here';
      else if (stored.mentionType === 'role' && stored.roleId) mentionContent = `<@&${stored.roleId}>`;

      // تحديد قناة النشر
      let targetChannel = interaction.channel;
      if (stored.targetChannelId) {
        const fetched = await interaction.guild.channels.fetch(stored.targetChannelId).catch(() => null);
        if (fetched) targetChannel = fetched;
      }

      await targetChannel.send({ content: mentionContent, embeds: [finalEmbed] });
      interaction.client._pendingAnnouncements.delete(interaction.user.id);

      const cfg = PLATFORM_CFG[stored.platform] || PLATFORM_CFG.general;
      await sendLog(interaction.client, interaction.guildId, {
        type: 'info', title: '📢 إعلان جديد',
        description: `**${interaction.user.tag}** نشر إعلان **${cfg.label}**`,
        fields: [
          { name: '📢 القناة',   value: `<#${targetChannel.id}>`,   inline: true },
          { name: '📣 المنشن',   value: mentionContent || 'بدون',   inline: true },
          { name: '📌 النوع',    value: cfg.label,                   inline: true },
        ]
      });

      return interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅  تم نشر الإعلان بنجاح!')
            .setDescription(`نُشر في <#${targetChannel.id}> ${mentionContent ? `مع تنبيه ${mentionContent}` : 'بدون منشن'}`)
            .setTimestamp()
        ],
        components: []
      });
    }
  }
};
