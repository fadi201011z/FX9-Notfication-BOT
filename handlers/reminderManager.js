const { EmbedBuilder } = require('discord.js');
const db = require('../database/database');

let activeTimers = new Map();

// ألوان إسلامية احترافية
const ISLAMIC_PALETTE = {
  prayer:   0x1B5E20, // أخضر داكن — الصلوات
  dhikr:    0x2E7D32, // أخضر متوسط — الذكر
  quran:    0x0D47A1, // أزرق داكن — القرآن
  dua:      0x4A148C, // بنفسجي — الدعاء
  prophet:  0x880E4F, // قرمزي — الصلاة على النبي
  general:  0x37474F, // رمادي داكن — عام
};

// اكتشاف نوع التذكير تلقائياً من العنوان
function detectType(title = '') {
  const t = title.toLowerCase();
  if (t.includes('صلاة') || t.includes('فجر') || t.includes('ظهر') || t.includes('عصر') || t.includes('مغرب') || t.includes('عشاء')) return 'prayer';
  if (t.includes('قرآن') || t.includes('تلاوة') || t.includes('آية'))   return 'quran';
  if (t.includes('النبي') || t.includes('صل') || t.includes('محمد'))    return 'prophet';
  if (t.includes('دعاء') || t.includes('قيام'))                          return 'dua';
  if (t.includes('ذكر') || t.includes('تسبيح') || t.includes('استغفار')) return 'dhikr';
  return 'general';
}

function fmtInterval(minutes) {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)} يوم`;
  if (minutes >= 60)   return `${Math.round(minutes / 60)} ساعة`;
  return `${minutes} دقيقة`;
}

async function sendReminder(client, reminder) {
  try {
    if (!reminder.channel_id || reminder.channel_id === '0') return;
    const channel = await client.channels.fetch(reminder.channel_id).catch(() => null);
    if (!channel) return;

    const type  = detectType(reminder.title);
    const color = ISLAMIC_PALETTE[type];
    const hr    = fmtInterval(reminder.interval_minutes);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(reminder.message)
      .setFooter({ text: `⏰ تذكير تلقائي • كل ${hr}  |  ${client.user.username}` })
      .setTimestamp();

    if (reminder.title) {
      embed.setAuthor({
        name: reminder.title,
        iconURL: client.user.displayAvatarURL()
      });
    }

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error(`[Reminder #${reminder.id}] Error:`, err.message);
  }
}

function startReminderManager(client) {
  for (const timer of activeTimers.values()) clearInterval(timer);
  activeTimers.clear();

  const reminders = db.prepare(
    "SELECT * FROM reminders WHERE enabled=1 AND channel_id != '0' AND channel_id IS NOT NULL"
  ).all();

  if (!reminders.length) return console.log('[Reminder] No active reminders.');

  for (const reminder of reminders) {
    const ms = reminder.interval_minutes * 60 * 1000;
    if (ms < 60_000) {
      console.warn(`[Reminder #${reminder.id}] Too short (<1 min), skip.`);
      continue;
    }

    const timer = setInterval(async () => {
      const current = db.prepare("SELECT * FROM reminders WHERE id=? AND enabled=1").get(reminder.id);
      if (current && current.channel_id !== '0') {
        await sendReminder(client, current);
      } else {
        clearInterval(activeTimers.get(reminder.id));
        activeTimers.delete(reminder.id);
      }
    }, ms);

    activeTimers.set(reminder.id, timer);
    console.log(`[Reminder #${reminder.id}] "${reminder.title || '?'}" ▶ every ${reminder.interval_minutes}min`);
  }
}

// إرسال تذكير واحد فوراً (للاختبار)
async function sendReminderNow(client, reminderId) {
  const reminder = db.prepare('SELECT * FROM reminders WHERE id=?').get(reminderId);
  if (!reminder) return false;
  await sendReminder(client, reminder);
  return true;
}

module.exports = { startReminderManager, sendReminderNow };
