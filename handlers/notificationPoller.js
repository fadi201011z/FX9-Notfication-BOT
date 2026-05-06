const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db      = require('../database/database');
const youtube = require('../utils/youtube');
const kick    = require('../utils/kick');
const twitter = require('../utils/twitter');

const INTERVALS = {
  youtube: parseInt(process.env.YOUTUBE_POLL_INTERVAL) || 300000,  // 5 دقائق
  kick:    parseInt(process.env.KICK_POLL_INTERVAL)    || 60000,   // دقيقة
  twitter: parseInt(process.env.TWITTER_POLL_INTERVAL) || 120000   // دقيقتان
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function wasNotified(guildId, platform, contentId) {
  return !!db.prepare(
    'SELECT 1 FROM notification_history WHERE guild_id=? AND platform=? AND content_id=?'
  ).get(guildId, platform, String(contentId));
}

function markNotified(guildId, platform, contentId) {
  db.prepare(
    'INSERT OR IGNORE INTO notification_history (guild_id,platform,content_id) VALUES (?,?,?)'
  ).run(guildId, platform, String(contentId));
}

async function getNotifChannel(client, guildId, platform) {
  const row = db.prepare(
    'SELECT discord_channel_id FROM notification_channels WHERE guild_id=? AND platform=?'
  ).get(guildId, platform);
  if (!row) return null;
  return client.channels.fetch(row.discord_channel_id).catch(() => null);
}

function linkBtn(label, url) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url)
  );
}

function toTs(d) { return d ? Math.floor(new Date(d).getTime() / 1000) : null; }

// ─── YouTube Poller ───────────────────────────────────────────────────────────
async function pollYouTube(client) {
  const accounts = db.prepare(
    "SELECT DISTINCT channel_id, channel_name, guild_id FROM linked_accounts WHERE platform='youtube'"
  ).all();

  for (const acc of accounts) {
    try {
      const video = await youtube.getLatestVideo(acc.channel_id);
      if (!video || wasNotified(acc.guild_id, 'youtube', video.id)) continue;

      const ch = await getNotifChannel(client, acc.guild_id, 'youtube');
      if (!ch) continue;

      const ts = toTs(video.publishedAt);
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setAuthor({ name: `🎥  ${video.channelName}`, iconURL: 'https://www.gstatic.com/youtube/img/branding/favicon/favicon_32x32.png' })
        .setTitle(video.title)
        .setURL(video.url)
        .setImage(video.thumbnail)
        .addFields({ name: '📅  نُشر', value: ts ? `<t:${ts}:R>` : 'الآن', inline: true })
        .setFooter({ text: 'YouTube • فيديو جديد' })
        .setTimestamp();

      await ch.send({ content: '@everyone', embeds: [embed], components: [linkBtn('🎥  مشاهدة الفيديو', video.url)] });
      markNotified(acc.guild_id, 'youtube', video.id);
    } catch (err) {
      if (![403, 404].includes(err.response?.status)) {
        console.error(`[YouTube] ${acc.channel_name}:`, err.message);
      }
    }
  }
}

// ─── Kick Poller ──────────────────────────────────────────────────────────────
async function pollKick(client) {
  const accounts = db.prepare(
    "SELECT DISTINCT channel_id, channel_name, channel_slug, guild_id FROM linked_accounts WHERE platform='kick'"
  ).all();

  for (const acc of accounts) {
    try {
      const slug   = acc.channel_slug || acc.channel_name;
      const stream = await kick.isLive(slug);
      if (!stream) continue;

      const notifKey = `live_${stream.id}`;
      if (wasNotified(acc.guild_id, 'kick', notifKey)) continue;

      const ch = await getNotifChannel(client, acc.guild_id, 'kick');
      if (!ch) continue;

      const ts = toTs(stream.startedAt);
      const embed = new EmbedBuilder()
        .setColor(0x53FC18)
        .setAuthor({ name: `🔴  ${acc.channel_name} — بث مباشر!`, iconURL: 'https://kick.com/favicon.ico' })
        .setTitle(stream.title)
        .setURL(stream.url)
        .setImage(stream.thumbnail ? `${stream.thumbnail}?t=${Date.now()}` : null)
        .addFields(
          { name: '🎮  الفئة',      value: stream.categories,                      inline: true },
          { name: '👥  المشاهدون', value: stream.viewers.toLocaleString('ar-SA'), inline: true },
          ...(ts ? [{ name: '⏰  بدأ', value: `<t:${ts}:R>`, inline: true }] : [])
        )
        .setFooter({ text: 'Kick • بث مباشر' })
        .setTimestamp();

      await ch.send({ content: '@everyone', embeds: [embed], components: [linkBtn('🟢  مشاهدة البث', stream.url)] });
      markNotified(acc.guild_id, 'kick', notifKey);
    } catch (err) {
      if (err.response?.status !== 404) console.error(`[Kick] ${acc.channel_name}:`, err.message);
    }
  }
}

// ─── Twitter Poller ───────────────────────────────────────────────────────────
async function pollTwitter(client) {
  const accounts = db.prepare(
    "SELECT DISTINCT channel_id, channel_name, channel_slug, guild_id FROM linked_accounts WHERE platform='twitter'"
  ).all();

  for (const acc of accounts) {
    try {
      const tweet = await twitter.getLatestTweet(acc.channel_id);
      if (!tweet || wasNotified(acc.guild_id, 'twitter', tweet.id)) continue;

      const ch = await getNotifChannel(client, acc.guild_id, 'twitter');
      if (!ch) continue;

      const handle   = acc.channel_slug || acc.channel_name;
      const tweetUrl = `https://twitter.com/${handle}/status/${tweet.id}`;
      const ts       = toTs(tweet.created_at);

      const embed = new EmbedBuilder()
        .setColor(0x1A8CD8)
        .setAuthor({ name: `𝕏  @${handle}`, iconURL: 'https://abs.twimg.com/favicons/twitter.2.ico', url: `https://twitter.com/${handle}` })
        .setTitle('تغريدة جديدة')
        .setURL(tweetUrl)
        .setDescription(`> ${tweet.text}`)
        .addFields(
          ...(ts ? [{ name: '📅  نُشر', value: `<t:${ts}:R>`, inline: true }] : []),
          ...(tweet.public_metrics ? [
            { name: '❤️  إعجابات',      value: tweet.public_metrics.like_count.toLocaleString('ar-SA'),    inline: true },
            { name: '🔁  إعادة تغريد', value: tweet.public_metrics.retweet_count.toLocaleString('ar-SA'), inline: true }
          ] : [])
        )
        .setFooter({ text: 'Twitter/X • تغريدة جديدة' })
        .setTimestamp();

      await ch.send({ content: '@everyone', embeds: [embed], components: [linkBtn('𝕏  فتح التغريدة', tweetUrl)] });
      markNotified(acc.guild_id, 'twitter', tweet.id);
    } catch (err) {
      if (err.response?.status !== 404) console.error(`[Twitter] ${acc.channel_name}:`, err.message);
    }
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────
function startNotificationPoller(client) {
  const safe = (name, fn) => fn(client).catch(e => console.error(`[Poller/${name}]`, e.message));

  // تشغيل فوري
  safe('YouTube', pollYouTube);
  safe('Kick',    pollKick);
  safe('Twitter', pollTwitter);

  // فترات الفحص
  setInterval(() => safe('YouTube', pollYouTube), INTERVALS.youtube);
  setInterval(() => safe('Kick',    pollKick),    INTERVALS.kick);
  setInterval(() => safe('Twitter', pollTwitter), INTERVALS.twitter);

  console.log(`[Poller] ▶ YouTube:${INTERVALS.youtube/1000}s  Kick:${INTERVALS.kick/1000}s  Twitter:${INTERVALS.twitter/1000}s`);
}

module.exports = { startNotificationPoller };
