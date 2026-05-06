/**
 * /reminder — نظام التذكيرات الإسلامية الاحترافي
 * الأوامر: add | list | edit | setchannel | test | toggle | remove
 */
const {
  SlashCommandBuilder, EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, MessageFlags, ChannelType,
} = require('discord.js');
const db = require('../database/database');
const { hasPermission }         = require('../utils/permissions');
const { sendLog }               = require('../utils/logger');
const { sendReminderNow }       = require('../handlers/reminderManager');

// ألوان إسلامية
const ISLAMIC_PALETTE = {
  prayer:  0x1B5E20,
  dhikr:   0x2E7D32,
  quran:   0x0D47A1,
  dua:     0x4A148C,
  prophet: 0x880E4F,
  general: 0x37474F,
};

function detectType(title = '') {
  const t = title.toLowerCase();
  if (t.includes('صلاة') || t.includes('فجر') || t.includes('ظهر') || t.includes('عصر') || t.includes('مغرب') || t.includes('عشاء')) return 'prayer';
  if (t.includes('قرآن') || t.includes('تلاوة') || t.includes('آية'))  return 'quran';
  if (t.includes('النبي') || t.includes('صل') || t.includes('محمد'))   return 'prophet';
  if (t.includes('دعاء') || t.includes('قيام'))                         return 'dua';
  if (t.includes('ذكر') || t.includes('تسبيح') || t.includes('استغفار')) return 'dhikr';
  return 'general';
}

function fmtInterval(min) {
  if (min >= 1440) return `${Math.round(min / 1440)} يوم`;
  if (min >= 60)   return `${Math.round(min / 60)} ساعة`;
  return `${min} دقيقة`;
}

function errEmbed(msg) {
  return new EmbedBuilder().setColor(0xE74C3C).setTitle('❌ خطأ').setDescription(msg).setTimestamp();
}

function successEmbed(title, msg) {
  return new EmbedBuilder().setColor(0x2ECC71).setTitle(title).setDescription(msg).setTimestamp();
}

// ── بناء إمبد اللائحة ──────────────────────────────────────
function buildListEmbed(all) {
  const active    = all.filter(r => !r.is_template && r.enabled && r.channel_id !== '0');
  const inactive  = all.filter(r => !r.is_template && (!r.enabled || r.channel_id === '0'));
  const templates = all.filter(r => r.is_template);

  const lines = [];

  if (active.length) {
    lines.push('**━━━━ 🟢 تذكيرات مفعّلة ━━━━**');
    for (const r of active) {
      const type = detectType(r.title);
      const icon = { prayer:'🕌', quran:'📖', prophet:'💝', dua:'🤲', dhikr:'📿', general:'⏰' }[type];
      lines.push([
        `**\`#${String(r.id).padStart(3,'0')}\`** ${icon}  **${r.title || '*بدون عنوان*'}**`,
        `┣ ⏱️ كل **${fmtInterval(r.interval_minutes)}**  ┃  📢 <#${r.channel_id}>`,
        `┗ ${r.message.slice(0,70).replace(/\n/g,' ')}${r.message.length>70?'…':''}`,
      ].join('\n'));
    }
  }

  if (inactive.length) {
    lines.push('\n**━━━━ 🔴 تذكيرات موقوفة / تحتاج قناة ━━━━**');
    for (const r of inactive) {
      const needsChannel = r.channel_id === '0';
      lines.push([
        `**\`#${String(r.id).padStart(3,'0')}\`** 🔴  **${r.title || '*بدون عنوان*'}**`,
        `┣ ⏱️ كل **${fmtInterval(r.interval_minutes)}**`,
        `┗ ${needsChannel ? '⚠️ يحتاج تعيين القناة — `/reminder setchannel`' : '🔇 موقوف — `/reminder toggle`'}`,
      ].join('\n'));
    }
  }

  if (templates.length) {
    lines.push('\n**━━━━ 🔧 قوالب جاهزة (حدّد القناة للتفعيل) ━━━━**');
    for (const r of templates) {
      lines.push([
        `**\`#${String(r.id).padStart(3,'0')}\`** 🔧  **${r.title || '*قالب*'}**`,
        `┣ ⏱️ كل **${fmtInterval(r.interval_minutes)}**`,
        `┗ \`/reminder setchannel id:${r.id} channel:#القناة\``,
      ].join('\n'));
    }
  }

  return new EmbedBuilder()
    .setColor(0x1B5E20)
    .setAuthor({ name: '⏰ نظام التذكيرات الإسلامية' })
    .setTitle(`📋 لائحة التذكيرات — ${all.length} تذكير`)
    .setDescription(lines.length ? lines.join('\n\n') : '*(لا يوجد تذكيرات بعد)*')
    .addFields(
      { name: '🟢 مفعّلة',  value: `**${active.length}**`,    inline: true },
      { name: '🔴 موقوفة',  value: `**${inactive.length}**`,  inline: true },
      { name: '🔧 قوالب',   value: `**${templates.length}**`, inline: true },
    )
    .setFooter({ text: 'setchannel • edit • toggle • remove • test' })
    .setTimestamp();
}

// ═══════════════════════════════════════════════════════════
module.exports = {
  data: new SlashCommandBuilder()
    .setName('reminder')
    .setDescription('⏰ إدارة التذكيرات الإسلامية التلقائية')
    .addSubcommand(s => s.setName('add').setDescription('➕ إضافة تذكير جديد'))
    .addSubcommand(s => s.setName('list').setDescription('📋 عرض جميع التذكيرات والقوالب'))
    .addSubcommand(s => s
      .setName('setchannel')
      .setDescription('📢 تعيين قناة لتذكير (يفعّله تلقائياً)')
      .addIntegerOption(o => o.setName('id').setDescription('رقم التذكير').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('القناة').setRequired(true)
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
    .addSubcommand(s => s
      .setName('edit')
      .setDescription('✏️ تعديل تذكير')
      .addIntegerOption(o => o.setName('id').setDescription('رقم التذكير').setRequired(true)))
    .addSubcommand(s => s
      .setName('test')
      .setDescription('🧪 إرسال تذكير الآن للاختبار')
      .addIntegerOption(o => o.setName('id').setDescription('رقم التذكير').setRequired(true)))
    .addSubcommand(s => s
      .setName('toggle')
      .setDescription('🔁 تشغيل / إيقاف تذكير')
      .addIntegerOption(o => o.setName('id').setDescription('رقم التذكير').setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('🗑️ حذف تذكير نهائياً')
      .addIntegerOption(o => o.setName('id').setDescription('رقم التذكير').setRequired(true))),

  // ──────────────────────────────────────────────────────
  async execute(interaction) {
    if (!hasPermission(interaction.member, interaction.guildId, 'reminder', interaction.channelId)) {
      return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية إدارة التذكيرات.')], flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    // ── ADD ──────────────────────────────────────────────
    if (sub === 'add') {
      const modal = new ModalBuilder().setCustomId('reminder_add_modal').setTitle('➕ إضافة تذكير جديد');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('📌 عنوان التذكير (مثال: 🕌 تذكير الفجر)')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)
            .setPlaceholder('مثال: 🕌 تذكير صلاة الفجر')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('channel_id').setLabel('📢 معرّف القناة (Channel ID)')
            .setStyle(TextInputStyle.Short).setRequired(true)
            .setPlaceholder('كليك يمين على القناة ← Copy Channel ID')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('message').setLabel('💬 نص التذكير')
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1800)
            .setPlaceholder('🕌 حان وقت الصلاة — لا تفوّت الركعات!')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('interval').setLabel('⏱️ التكرار بالدقائق (60 = ساعة، 1440 = يوم)')
            .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('60')
        )
      );
      return interaction.showModal(modal);
    }

    // ── LIST ─────────────────────────────────────────────
    if (sub === 'list') {
      const all = db.prepare('SELECT * FROM reminders WHERE guild_id=? ORDER BY is_template ASC, id ASC').all(interaction.guildId);

      if (!all.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x1B5E20)
            .setTitle('📭 لا توجد تذكيرات بعد')
            .setDescription('> استخدم `/reminder add` لإضافة تذكير جديد\n> أو `/reminder list` بعد إعداد البوت لرؤية القوالب الإسلامية الجاهزة!')
            .setTimestamp()],
          flags: MessageFlags.Ephemeral
        });
      }
      return interaction.reply({ embeds: [buildListEmbed(all)], flags: MessageFlags.Ephemeral });
    }

    // ── SETCHANNEL ───────────────────────────────────────
    if (sub === 'setchannel') {
      const id      = interaction.options.getInteger('id');
      const channel = interaction.options.getChannel('channel');
      const reminder = db.prepare('SELECT * FROM reminders WHERE id=? AND guild_id=?').get(id, interaction.guildId);

      if (!reminder) return interaction.reply({ embeds: [errEmbed(`لا يوجد تذكير برقم **#${id}**.`)], flags: MessageFlags.Ephemeral });

      db.prepare('UPDATE reminders SET channel_id=?, enabled=1, is_template=0 WHERE id=?').run(channel.id, id);
      interaction.client.emit('reminderRestart', interaction.client);

      const hr = fmtInterval(reminder.interval_minutes);
      await sendLog(interaction.client, interaction.guildId, {
        type: 'success', title: `📢 قناة التذكير #${id}`,
        description: `**${interaction.user.tag}** عيّن قناة "${reminder.title || `#${id}`}" → <#${channel.id}>`
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle(`✅ تم تعيين القناة وتفعيل التذكير #${id}`)
            .setDescription(`**${reminder.title || `التذكير #${id}`}**\nسيُرسل في <#${channel.id}> كل **${hr}** 🔔`)
            .setFooter({ text: 'استخدم /reminder test لتجربته الآن!' })
            .setTimestamp()
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── TEST ─────────────────────────────────────────────
    if (sub === 'test') {
      const id = interaction.options.getInteger('id');
      const reminder = db.prepare('SELECT * FROM reminders WHERE id=? AND guild_id=?').get(id, interaction.guildId);

      if (!reminder) return interaction.reply({ embeds: [errEmbed(`لا يوجد تذكير برقم **#${id}**.`)], flags: MessageFlags.Ephemeral });

      if (reminder.channel_id === '0' || !reminder.channel_id) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xF39C12)
            .setTitle('⚠️ لم يتم تعيين القناة')
            .setDescription(`استخدم \`/reminder setchannel id:${id} channel:#القناة\` أولاً`)
            .setTimestamp()],
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const ok = await sendReminderNow(interaction.client, id);

      return interaction.editReply({
        embeds: [
          ok
            ? successEmbed(`✅ تم إرسال التذكير #${id}`, `تم إرسال **${reminder.title || `التذكير #${id}`}** إلى <#${reminder.channel_id}> الآن!`)
            : errEmbed('فشل إرسال التذكير — تحقق من أن البوت لديه صلاحيات الكتابة في القناة.')
        ]
      });
    }

    // ── EDIT ─────────────────────────────────────────────
    if (sub === 'edit') {
      const id = interaction.options.getInteger('id');
      const reminder = db.prepare('SELECT * FROM reminders WHERE id=? AND guild_id=?').get(id, interaction.guildId);

      if (!reminder) return interaction.reply({ embeds: [errEmbed(`لا يوجد تذكير برقم **#${id}**.`)], flags: MessageFlags.Ephemeral });

      const modal = new ModalBuilder().setCustomId(`reminder_edit_modal_${id}`).setTitle(`✏️ تعديل التذكير #${id}`);
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('title').setLabel('📌 عنوان التذكير')
            .setStyle(TextInputStyle.Short).setRequired(false)
            .setValue(reminder.title || '')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('channel_id').setLabel('📢 Channel ID (اتركه لتغيير النص فقط)')
            .setStyle(TextInputStyle.Short).setRequired(false)
            .setValue(reminder.channel_id !== '0' ? reminder.channel_id : '')
            .setPlaceholder('فارغ = لا تغيير القناة')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('message').setLabel('💬 نص التذكير')
            .setStyle(TextInputStyle.Paragraph).setRequired(true)
            .setValue(reminder.message)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('interval').setLabel('⏱️ التكرار بالدقائق')
            .setStyle(TextInputStyle.Short).setRequired(true)
            .setValue(String(reminder.interval_minutes))
        )
      );
      return interaction.showModal(modal);
    }

    // ── TOGGLE ───────────────────────────────────────────
    if (sub === 'toggle') {
      const id = interaction.options.getInteger('id');
      const reminder = db.prepare('SELECT * FROM reminders WHERE id=? AND guild_id=?').get(id, interaction.guildId);

      if (!reminder) return interaction.reply({ embeds: [errEmbed(`لا يوجد تذكير برقم **#${id}**.`)], flags: MessageFlags.Ephemeral });

      if (!reminder.enabled && (reminder.channel_id === '0' || !reminder.channel_id)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0xF39C12)
            .setTitle('⚠️ يحتاج قناة أولاً')
            .setDescription(`استخدم \`/reminder setchannel id:${id} channel:#قناة\` لتعيين القناة ثم التفعيل`)
            .setTimestamp()],
          flags: MessageFlags.Ephemeral
        });
      }

      const newStatus = reminder.enabled ? 0 : 1;
      db.prepare('UPDATE reminders SET enabled=?, is_template=0 WHERE id=?').run(newStatus, id);
      if (newStatus) interaction.client.emit('reminderRestart', interaction.client);

      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(newStatus ? 0x2ECC71 : 0xE74C3C)
          .setTitle(newStatus ? `🟢 تم تفعيل التذكير #${id}` : `🔴 تم إيقاف التذكير #${id}`)
          .setDescription(newStatus
            ? `سيُرسل **${reminder.title || `التذكير #${id}`}** كل **${fmtInterval(reminder.interval_minutes)}** 🔔`
            : 'يمكنك إعادة تفعيله بنفس الأمر.')
          .setTimestamp()],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── REMOVE ───────────────────────────────────────────
    if (sub === 'remove') {
      const id = interaction.options.getInteger('id');
      const reminder = db.prepare('SELECT * FROM reminders WHERE id=? AND guild_id=?').get(id, interaction.guildId);

      if (!reminder) return interaction.reply({ embeds: [errEmbed(`لا يوجد تذكير برقم **#${id}**.`)], flags: MessageFlags.Ephemeral });

      return interaction.reply({
        embeds: [
          new EmbedBuilder().setColor(0xF39C12)
            .setTitle(`⚠️ تأكيد حذف التذكير #${id}`)
            .addFields(
              { name: '📌 العنوان',  value: reminder.title || '*(بدون)*', inline: true },
              { name: '⏱️ التكرار', value: fmtInterval(reminder.interval_minutes), inline: true },
            )
            .setDescription(`> ${reminder.message.slice(0,100).replace(/\n/g,' ')}${reminder.message.length>100?'…':''}`)
            .setFooter({ text: 'هذا الإجراء لا يمكن التراجع عنه!' })
        ],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`reminder_delete_${id}`).setLabel('🗑️ نعم، احذف').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('reminder_cancel').setLabel('◀ إلغاء').setStyle(ButtonStyle.Secondary)
        )],
        flags: MessageFlags.Ephemeral
      });
    }
  },

  // ── Modals ─────────────────────────────────────────────
  async handleModal(interaction) {

    if (interaction.customId === 'reminder_add_modal') {
      const title     = interaction.fields.getTextInputValue('title').trim();
      const channelId = interaction.fields.getTextInputValue('channel_id').trim();
      const message   = interaction.fields.getTextInputValue('message').trim();
      const interval  = parseInt(interaction.fields.getTextInputValue('interval').trim());

      if (isNaN(interval) || interval < 1)
        return interaction.reply({ embeds: [errEmbed('التكرار يجب أن يكون رقماً أكبر من صفر.')], flags: MessageFlags.Ephemeral });

      const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
      if (!channel)
        return interaction.reply({ embeds: [errEmbed('لم يتم العثور على القناة — تأكد من الـ Channel ID.')], flags: MessageFlags.Ephemeral });

      db.prepare(
        'INSERT INTO reminders (guild_id, channel_id, title, message, interval_minutes, enabled, is_template, created_by) VALUES (?,?,?,?,?,1,0,?)'
      ).run(interaction.guildId, channelId, title || null, message, interval, interaction.user.id);

      interaction.client.emit('reminderRestart', interaction.client);

      const hr = fmtInterval(interval);
      await sendLog(interaction.client, interaction.guildId, {
        type: 'success', title: '⏰ تذكير جديد',
        description: `**${interaction.user.tag}** أضاف "${title || message.slice(0,30)}" → <#${channelId}> كل ${hr}`
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(ISLAMIC_PALETTE[detectType(title)])
            .setTitle('✅ تم إضافة التذكير')
            .setDescription(`سيُرسل كل **${hr}** في <#${channelId}> 🔔`)
            .addFields(
              { name: '📌 العنوان',  value: title || '*(بدون عنوان)*', inline: true },
              { name: '⏱️ التكرار', value: `كل ${hr}`,                 inline: true },
            )
            .setFooter({ text: 'استخدم /reminder test لتجربته الآن!' })
            .setTimestamp()
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.customId.startsWith('reminder_edit_modal_')) {
      const id       = parseInt(interaction.customId.replace('reminder_edit_modal_', ''));
      const old      = db.prepare('SELECT * FROM reminders WHERE id=? AND guild_id=?').get(id, interaction.guildId);
      if (!old) return interaction.reply({ embeds: [errEmbed('تذكير غير موجود.')], flags: MessageFlags.Ephemeral });

      const title     = interaction.fields.getTextInputValue('title').trim();
      const rawCh     = interaction.fields.getTextInputValue('channel_id').trim();
      const message   = interaction.fields.getTextInputValue('message').trim();
      const interval  = parseInt(interaction.fields.getTextInputValue('interval').trim());

      if (isNaN(interval) || interval < 1)
        return interaction.reply({ embeds: [errEmbed('التكرار يجب أن يكون رقماً أكبر من صفر.')], flags: MessageFlags.Ephemeral });

      let channelId = old.channel_id;
      if (rawCh) {
        const ch = await interaction.guild.channels.fetch(rawCh).catch(() => null);
        if (!ch) return interaction.reply({ embeds: [errEmbed('لم يتم العثور على القناة.')], flags: MessageFlags.Ephemeral });
        channelId = rawCh;
      }

      db.prepare(
        'UPDATE reminders SET title=?, channel_id=?, message=?, interval_minutes=?, is_template=0, enabled=1 WHERE id=? AND guild_id=?'
      ).run(title || null, channelId, message, interval, id, interaction.guildId);

      interaction.client.emit('reminderRestart', interaction.client);

      await sendLog(interaction.client, interaction.guildId, {
        type: 'info', title: `✏️ تعديل تذكير #${id}`,
        description: `**${interaction.user.tag}** عدّل "${title || message.slice(0,30)}"`
      });

      return interaction.reply({
        embeds: [successEmbed(`✅ تم تعديل التذكير #${id}`,
          `📌 **${title || '*(بدون عنوان)*'}**\n📢 <#${channelId}> — كل **${fmtInterval(interval)}**`)
        ],
        flags: MessageFlags.Ephemeral
      });
    }
  },

  // ── Buttons ────────────────────────────────────────────
  async handleButton(interaction) {
    if (interaction.customId === 'reminder_cancel') {
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription('◀ تم الإلغاء.').setTimestamp()],
        components: []
      });
    }

    if (interaction.customId.startsWith('reminder_delete_')) {
      const id = parseInt(interaction.customId.replace('reminder_delete_', ''));
      const r  = db.prepare('SELECT title FROM reminders WHERE id=? AND guild_id=?').get(id, interaction.guildId);
      db.prepare('DELETE FROM reminders WHERE id=? AND guild_id=?').run(id, interaction.guildId);

      await sendLog(interaction.client, interaction.guildId, {
        type: 'warning', title: `🗑️ حذف تذكير #${id}`,
        description: `**${interaction.user.tag}** حذف "${r?.title || `#${id}`}"`
      });

      return interaction.update({
        embeds: [successEmbed(`✅ تم حذف التذكير #${id}`, `تم الحذف بنجاح.`)],
        components: []
      });
    }
  }
};
