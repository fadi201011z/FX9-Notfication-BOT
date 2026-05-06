// /test — يرسل إشعاراً حقيقياً إلى روم الإشعارات المحدد
const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags
} = require('discord.js');
const db      = require('../database/database');
const { hasPermission } = require('../utils/permissions');
const youtube = require('../utils/youtube');
const kick    = require('../utils/kick');
const twitter = require('../utils/twitter');

const CFG = {
  youtube: { color: 0xFF0000, label: 'YouTube',     icon: 'https://www.gstatic.com/youtube/img/branding/favicon/favicon_32x32.png' },
  kick:    { color: 0x53FC18, label: 'Kick',         icon: 'https://kick.com/favicon.ico' },
  twitter: { color: 0x1A8CD8, label: 'Twitter / X', icon: 'https://abs.twimg.com/favicons/twitter.2.ico' }
};

function errEmbed(desc) {
  return new EmbedBuilder().setColor(0xED4245).setTitle('❌ خطأ').setDescription(desc).setTimestamp();
}

function linkBtn(label, url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url)
  );
}

function toTs(d) { return d ? Math.floor(new Date(d).getTime() / 1000) : null; }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('اختبار الإشعارات — يرسل إشعاراً حقيقياً إلى الروم المحدد')
    .addStringOption(o =>
      o.setName('platform').setDescription('المنصة').setRequired(true)
        .addChoices(
          { name: '🎥 YouTube',    value: 'youtube' },
          { name: '🟢 Kick',       value: 'kick'    },
          { name: '𝕏  Twitter/X', value: 'twitter' }
        )
    ),

  async execute(interaction) {
    if (!hasPermission(interaction.member, interaction.guildId, 'test')) {
      return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية.')], flags: MessageFlags.Ephemeral });
    }

    const platform = interaction.options.getString('platform');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const cfg = CFG[platform];

    // 1. تحقق من وجود حساب مربوط
    const linked = db.prepare(
      'SELECT * FROM linked_accounts WHERE user_id=? AND guild_id=? AND platform=?'
    ).get(interaction.user.id, interaction.guildId, platform);

    if (!linked) {
      const examples = {
        youtube: 'https://youtube.com/@channelname',
        kick:    'https://kick.com/username',
        twitter: 'https://twitter.com/username'
      };
      return interaction.editReply({
        embeds: [errEmbed(
          `لم تربط حساب **${cfg.label}** بعد.\nاستخدم:\n\`/link url:${examples[platform]}\``
        )]
      });
    }

    // 2. تحقق من وجود روم إشعارات
    const notifRow = db.prepare(
      'SELECT discord_channel_id FROM notification_channels WHERE guild_id=? AND platform=?'
    ).get(interaction.guildId, platform);

    if (!notifRow) {
      return interaction.editReply({
        embeds: [errEmbed(
          `لم يتم تحديد روم الإشعارات لـ **${cfg.label}**.\nاستخدم:\n\`/setchannel platform:${platform}\``
        )]
      });
    }

    const notifChannel = await interaction.client.channels.fetch(notifRow.discord_channel_id).catch(() => null);
    if (!notifChannel) {
      return interaction.editReply({
        embeds: [errEmbed('روم الإشعارات غير موجود أو المبوت لا يملك صلاحية الوصول إليه.')]
      });
    }

    // 3. جلب البيانات الحقيقية وإرسال الإشعار
    try {
      let embed, btn;

      // ── YouTube ──────────────────────────────────────────────────────────
      if (platform === 'youtube') {
        const video = await youtube.getLatestVideo(linked.channel_id);

        if (!video) {
          return interaction.editReply({ embeds: [errEmbed('لا توجد فيديوهات على هذه القناة.')] });
        }

        const ts = toTs(video.publishedAt);
        embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setAuthor({ name: `🎥  ${video.channelName}`, iconURL: cfg.icon })
          .setTitle(video.title)
          .setURL(video.url)
          .setImage(video.thumbnail)
          .addFields({ name: '📅 نُشر', value: ts ? `<t:${ts}:R>` : 'الآن', inline: true })
          .setFooter({ text: '⚙️ إشعار تجريبي • YouTube' })
          .setTimestamp();
        btn = linkBtn('🎥 مشاهدة الفيديو', video.url);

      // ── Kick ──────────────────────────────────────────────────────────────
      } else if (platform === 'kick') {
        const slug = linked.channel_slug || linked.channel_name;
        const stream = await kick.isLive(slug);

        if (stream) {
          const ts = toTs(stream.startedAt);
          embed = new EmbedBuilder()
            .setColor(0x53FC18)
            .setAuthor({ name: `🔴  ${linked.channel_name} — يبث الآن!`, iconURL: cfg.icon })
            .setTitle(stream.title)
            .setURL(stream.url)
            .setImage(stream.thumbnail || null)
            .addFields(
              { name: '🎮 الفئة',     value: stream.categories,                       inline: true },
              { name: '👥 المشاهدون', value: stream.viewers.toLocaleString('ar-SA'),  inline: true },
              ...(ts ? [{ name: '⏰ بدأ', value: `<t:${ts}:R>`, inline: true }] : [])
            )
            .setFooter({ text: '⚙️ إشعار تجريبي • Kick' })
            .setTimestamp();
          btn = linkBtn('🟢 مشاهدة البث', stream.url);
        } else {
          // غير متصل: أرسل إشعاراً تجريبياً بالبيانات المحفوظة
          embed = new EmbedBuilder()
            .setColor(0x53FC18)
            .setAuthor({ name: `🔴  ${linked.channel_name} — بث مباشر!`, iconURL: cfg.icon })
            .setTitle('هذا ما سيبدو عليه الإشعار عند البث')
            .setURL(`https://kick.com/${slug}`)
            .addFields(
              { name: '🎮 الفئة',     value: 'Just Chatting',  inline: true },
              { name: '👥 المشاهدون', value: '0',              inline: true }
            )
            .setFooter({ text: '⚙️ إشعار تجريبي • Kick (القناة غير متصلة حالياً)' })
            .setTimestamp();
          btn = linkBtn('🟢 زيارة القناة', `https://kick.com/${slug}`);
        }

      // ── Twitter ───────────────────────────────────────────────────────────
      } else if (platform === 'twitter') {
        const handle = linked.channel_slug || linked.channel_name;
        const tweet  = await twitter.getLatestTweet(handle);

        if (!tweet) {
          return interaction.editReply({ embeds: [errEmbed('تعذّر جلب التغريدات. تأكد من أن الحساب عام وحاول لاحقاً.')] });
        }

        const tweetUrl = tweet.url || `https://twitter.com/${handle}/status/${tweet.id}`;
        const ts       = toTs(tweet.created_at);
        embed = new EmbedBuilder()
          .setColor(0x1A8CD8)
          .setAuthor({ name: `𝕏  @${handle}`, iconURL: cfg.icon, url: `https://twitter.com/${handle}` })
          .setTitle('تغريدة جديدة')
          .setURL(tweetUrl)
          .setDescription(`> ${tweet.text}`)
          .addFields(
            ...(ts ? [{ name: '📅 نُشر', value: `<t:${ts}:R>`, inline: true }] : [])
          )
          .setFooter({ text: '⚙️ إشعار تجريبي • Twitter/X' })
          .setTimestamp();
        btn = linkBtn('𝕏 فتح التغريدة', tweetUrl);
      }

      // 4. أرسل الإشعار إلى روم الإشعارات
      await notifChannel.send({
        content: `> ⚙️ **إشعار تجريبي** من <@${interaction.user.id}>`,
        embeds: [embed],
        components: btn ? [btn] : []
      });

      // 5. أخبر المستخدم بالنجاح
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('✅ تم إرسال الإشعار التجريبي!')
            .setDescription(`تم إرسال إشعار **${cfg.label}** إلى ${notifChannel}`)
            .addFields(
              { name: '📺 القناة المربوطة', value: linked.channel_name, inline: true },
              { name: '📢 روم الإشعارات',  value: `${notifChannel}`,   inline: true }
            )
            .setFooter({ text: 'إذا كان الإشعار وصل، إعداداتك صحيحة ✅' })
            .setTimestamp()
        ]
      });

    } catch (err) {
      console.error(`[test/${platform}]`, err.message);
      return interaction.editReply({
        embeds: [errEmbed(`خطأ أثناء جلب البيانات:\n\`${err.message}\``)]
      });
    }
  }
};
