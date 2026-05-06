// إصلاح: بدل تخزين البيانات في customId (حد 100 حرف)
// نخزّنها في Map على الـ client ونستخدم مفتاح قصير فقط
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db      = require('../database/database');
const { hasPermission }            = require('../utils/permissions');
const { isOnCooldown, setCooldown, getRemainingCooldown } = require('../utils/cooldown');
const youtube = require('../utils/youtube');
const kick    = require('../utils/kick');
const twitter = require('../utils/twitter');
const { sendLog } = require('../utils/logger');

const COOLDOWN_SECONDS = 15;
const SESSION_TTL_MS   = 5 * 60 * 1000; // 5 دقائق

const PLATFORMS = {
  youtube: {
    color: 0xFF0000, label: 'YouTube',
    icon: 'https://www.gstatic.com/youtube/img/branding/favicon/favicon_32x32.png',
    examples: ['https://youtube.com/@channelname'],
    detect: (u) => /youtube\.com|youtu\.be/.test(u),
    extract: (u) => u,
    fetch:   (u) => youtube.searchByUrl(u)
  },
  kick: {
    color: 0x53FC18, label: 'Kick',
    icon: 'https://kick.com/favicon.ico',
    examples: ['https://kick.com/username'],
    detect: (u) => /kick\.com/.test(u),
    extract: (u) => u.match(/kick\.com\/([\w-]+)/)?.[1]?.toLowerCase() || null,
    fetch:   (h) => kick.searchChannel(h)
  },
  twitter: {
    color: 0x1A8CD8, label: 'Twitter / X',
    icon: 'https://abs.twimg.com/favicons/twitter.2.ico',
    examples: ['https://twitter.com/username', 'https://x.com/username'],
    detect: (u) => /twitter\.com|x\.com/.test(u),
    extract: (u) => u.match(/(?:twitter|x)\.com\/([\w]+)/)?.[1] || null,
    fetch:   (h) => twitter.searchUser(h)
  }
};

const BLOCKED = new Set(['login','signup','browse','dashboard','settings','explore','notifications','messages','home','search','i','intent','about']);

function detectPlatform(url) {
  for (const [key, cfg] of Object.entries(PLATFORMS)) {
    if (cfg.detect(url)) return key;
  }
  return null;
}

function errEmbed(desc) {
  return new EmbedBuilder().setColor(0xED4245).setTitle('❌ خطأ').setDescription(desc).setTimestamp();
}

// نظّف الجلسات المنتهية
function cleanSessions(client) {
  if (!client._linkSessions) return;
  const now = Date.now();
  for (const [k, v] of client._linkSessions) {
    if (now > v.expires) client._linkSessions.delete(k);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('ربط قناة YouTube / Kick أو حساب Twitter عبر الرابط المباشر')
    .addStringOption(o =>
      o.setName('url')
        .setDescription('الرابط — youtube.com/@ أو kick.com/ أو twitter.com/')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member, interaction.guildId, 'link')) {
      return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية استخدام هذا الأمر.')], flags: MessageFlags.Ephemeral });
    }
    if (isOnCooldown(interaction.user.id, interaction.guildId, 'link', COOLDOWN_SECONDS)) {
      const rem = getRemainingCooldown(interaction.user.id, interaction.guildId, 'link', COOLDOWN_SECONDS);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription(`⏳ انتظر **${rem}** ثانية أولاً.`)],
        flags: MessageFlags.Ephemeral
      });
    }

    const rawInput = interaction.options.getString('url').trim();
    const urlStr   = /^https?:\/\//i.test(rawInput) ? rawInput : `https://${rawInput}`;

    let parsedUrl;
    try { parsedUrl = new URL(urlStr); } catch {
      return interaction.reply({
        embeds: [errEmbed(
          '**الرابط غير صالح.**\n\n**أمثلة مقبولة:**\n```\nhttps://youtube.com/@channel\nhttps://kick.com/username\nhttps://twitter.com/username\n```'
        )],
        flags: MessageFlags.Ephemeral
      });
    }

    const platform = detectPlatform(parsedUrl.href);
    if (!platform) {
      return interaction.reply({
        embeds: [errEmbed(
          '**المنصة غير مدعومة.**\n\n🎥 **YouTube** — `youtube.com`\n🟢 **Kick** — `kick.com`\n𝕏 **Twitter/X** — `twitter.com` أو `x.com`'
        )],
        flags: MessageFlags.Ephemeral
      });
    }

    const cfg    = PLATFORMS[platform];
    const handle = cfg.extract(parsedUrl.href);

    if (!handle || BLOCKED.has(String(handle).toLowerCase())) {
      return interaction.reply({
        embeds: [errEmbed(`تعذّر استخراج اسم القناة.\n\n**مثال صحيح:** \`${cfg.examples[0]}\``)],
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    let data;
    try {
      data = await cfg.fetch(handle);
    } catch (err) {
      console.error(`[link/${platform}]`, err.message);
      return interaction.editReply({
        embeds: [errEmbed(
          err.response?.status === 404
            ? `لم يُعثر على **${handle}** في **${cfg.label}**.\nتأكد من صحة الرابط وأن القناة/الحساب عام.`
            : `فشل الاتصال بـ **${cfg.label}**:\n\`${err.message}\``
        )]
      });
    }

    if (!data) {
      return interaction.editReply({ embeds: [errEmbed(`لم يُعثر على نتيجة في **${cfg.label}** بهذا الرابط.`)] });
    }

    // ─── تخزين البيانات في الجلسة (بدل customId الطويل) ────────────────────
    if (!interaction.client._linkSessions) interaction.client._linkSessions = new Map();
    cleanSessions(interaction.client);

    const sessionKey = `${interaction.guildId}_${interaction.user.id}`;
    interaction.client._linkSessions.set(sessionKey, {
      platform,
      channelId:   String(data.id || handle),
      channelName: data.name,
      channelSlug: data.slug || handle,
      channelImg:  data.image || '',
      expires:     Date.now() + SESSION_TTL_MS
    });

    // ─── Embed التأكيد ────────────────────────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(cfg.color)
      .setAuthor({ name: cfg.label, iconURL: cfg.icon })
      .setTitle('هل هذا الحساب صحيح؟')
      .setDescription(`## ${data.name}${data.description ? `\n> ${data.description.slice(0, 180)}` : ''}`)
      .setThumbnail(data.image || null)
      .addFields({ name: '🔗 الرابط', value: data.url })
      .setFooter({ text: 'تنتهي هذه الجلسة خلال 5 دقائق' })
      .setTimestamp();

    if (data.subscribers) embed.addFields({ name: '👥 المشتركون',  value: Number(data.subscribers).toLocaleString('ar-SA'), inline: true });
    if (data.followers)   embed.addFields({ name: '👥 المتابعون',   value: Number(data.followers).toLocaleString('ar-SA'),   inline: true });
    if (platform === 'kick' && data.isLiveNow) embed.addFields({ name: '🔴 الحالة', value: 'يبث الآن!', inline: true });

    // customId قصير جداً — البيانات محفوظة في الجلسة
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lk_confirm').setLabel('✅  تأكيد الربط').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('lk_cancel').setLabel('❌  إلغاء').setStyle(ButtonStyle.Danger)
    );

    setCooldown(interaction.user.id, interaction.guildId, 'link');
    await interaction.editReply({ embeds: [embed], components: [row] });
  },

  async handleButton(interaction) {
    const sessionKey = `${interaction.guildId}_${interaction.user.id}`;

    if (interaction.customId === 'lk_cancel') {
      interaction.client._linkSessions?.delete(sessionKey);
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription('❌ تم إلغاء عملية الربط.')],
        components: []
      });
    }

    if (interaction.customId === 'lk_confirm') {
      const session = interaction.client._linkSessions?.get(sessionKey);

      if (!session || Date.now() > session.expires) {
        interaction.client._linkSessions?.delete(sessionKey);
        return interaction.update({
          embeds: [errEmbed('انتهت صلاحية هذه الجلسة (5 دقائق).\nاستخدم `/link` مرة أخرى.')],
          components: []
        });
      }

      const { platform, channelId, channelName, channelSlug, channelImg } = session;
      const cfg = PLATFORMS[platform];

      try {
        db.prepare(`
          INSERT INTO linked_accounts
            (user_id, guild_id, platform, channel_id, channel_name, channel_slug, channel_image)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, guild_id, platform) DO UPDATE SET
            channel_id    = excluded.channel_id,
            channel_name  = excluded.channel_name,
            channel_slug  = excluded.channel_slug,
            channel_image = excluded.channel_image
        `).run(interaction.user.id, interaction.guildId, platform, channelId, channelName, channelSlug, channelImg);
      } catch (err) {
        return interaction.update({ embeds: [errEmbed(`خطأ في قاعدة البيانات:\n\`${err.message}\``)], components: [] });
      }

      interaction.client._linkSessions.delete(sessionKey);

      const done = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ تم ربط الحساب بنجاح!')
        .setThumbnail(channelImg || null)
        .addFields(
          { name: '👤 المستخدم', value: `<@${interaction.user.id}>`, inline: true },
          { name: '📺 القناة',   value: channelName,                  inline: true },
          { name: '🌐 المنصة',   value: cfg?.label || platform,        inline: true }
        )
        .addFields({ name: '💡 الخطوة التالية', value: '`/setchannel` — حدد روم الإشعارات\n`/test` — جرّب إرسال إشعار تجريبي' })
        .setTimestamp();

      await sendLog(interaction.client, interaction.guildId, {
        type: 'success',
        title: 'ربط حساب جديد',
        description: `**${interaction.user.tag}** ربط **${cfg?.label || platform}**: \`${channelName}\``
      });

      return interaction.update({ embeds: [done], components: [] });
    }
  }
};
