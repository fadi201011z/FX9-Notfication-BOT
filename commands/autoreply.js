/**
 * /autoreply — نظام الردود التلقائية الاحترافي
 * الأوامر: add | list | edit | channels | test | remove
 */
const {
  SlashCommandBuilder, EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, MessageFlags,
  ChannelSelectMenuBuilder, ChannelType,
} = require('discord.js');
const db = require('../database/database');
const { hasPermission } = require('../utils/permissions');
const { sendLog }       = require('../utils/logger');

// ألوان وأنماط فاخرة للردود
const PALETTES = [
  { color: 0x1B5E20, icon: '🌿' }, { color: 0x2E7D32, icon: '📿' },
  { color: 0x0D47A1, icon: '📖' }, { color: 0x4A148C, icon: '🤲' },
  { color: 0x880E4F, icon: '💝' }, { color: 0x5865F2, icon: '💫' },
  { color: 0x1A8CD8, icon: '🌟' }, { color: 0xF39C12, icon: '☀️' },
  { color: 0x27AE60, icon: '🌸' }, { color: 0xE74C3C, icon: '✨' },
];

function randomPalette() {
  return PALETTES[Math.floor(Math.random() * PALETTES.length)];
}

function errEmbed(msg) {
  return new EmbedBuilder().setColor(0xE74C3C).setTitle('❌ خطأ').setDescription(msg).setTimestamp();
}

function successEmbed(title, desc) {
  return new EmbedBuilder().setColor(0x2ECC71).setTitle(title).setDescription(desc).setTimestamp();
}

// ── بناء إمبد اللائحة ──────────────────────────────────────
function buildListEmbed(replies) {
  const defaults = replies.filter(r => r.created_by === 'البوت');
  const custom   = replies.filter(r => r.created_by !== 'البوت');

  const lines = [];

  if (custom.length) {
    lines.push('**━━━━ 👤 ردود مخصصة ━━━━**');
    for (const r of custom) {
      const count = r.responses.split('\n').filter(x => x.trim()).length;
      const chStr = r.allowed_channels
        ? r.allowed_channels.split(',').filter(Boolean).map(c => `<#${c.trim()}>`).join(' ')
        : '🟢 كل القنوات';
      lines.push([
        `**\`#${String(r.id).padStart(3,'0')}\`** 💬  \`${r.keyword}\``,
        `┣ 💬 **${count}** رد  ┃  ⏱️ ${r.cooldown}ث`,
        `┣ 📢 ${chStr}`,
        `┗ ${r.responses.split('\n')[0]?.slice(0,55) || '—'}…`,
      ].join('\n'));
    }
  }

  if (defaults.length) {
    lines.push(custom.length ? '\n**━━━━ 🤖 ردود افتراضية ━━━━**' : '**━━━━ 🤖 ردود افتراضية ━━━━**');
    for (const r of defaults) {
      const count = r.responses.split('\n').filter(x => x.trim()).length;
      const chStr = r.allowed_channels
        ? r.allowed_channels.split(',').filter(Boolean).map(c => `<#${c.trim()}>`).join(' ')
        : '🟢 كل القنوات';
      lines.push([
        `**\`#${String(r.id).padStart(3,'0')}\`** 🤖  \`${r.keyword}\``,
        `┣ 💬 **${count}** رد  ┃  ⏱️ ${r.cooldown}ث  ┃  📢 ${chStr}`,
      ].join('\n'));
    }
  }

  return new EmbedBuilder()
    .setColor(0x2E7D32)
    .setAuthor({ name: '💬 نظام الردود التلقائية' })
    .setTitle(`📋 لائحة الردود — ${replies.length} رد`)
    .setDescription(lines.length ? lines.join('\n\n') : '*(لا يوجد ردود بعد)*')
    .addFields(
      { name: '👤 مخصصة',   value: `**${custom.length}**`,   inline: true },
      { name: '🤖 افتراضية', value: `**${defaults.length}**`, inline: true },
      { name: '📊 الإجمالي', value: `**${replies.length}**`,  inline: true },
    )
    .setFooter({ text: 'edit • channels • test • remove' })
    .setTimestamp();
}

// ═══════════════════════════════════════════════════════════
module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoreply')
    .setDescription('💬 إدارة الردود التلقائية الاحترافية')
    .addSubcommand(s => s.setName('add').setDescription('➕ إضافة رد تلقائي جديد'))
    .addSubcommand(s => s.setName('list').setDescription('📋 عرض قائمة الردود التلقائية'))
    .addSubcommand(s => s
      .setName('edit')
      .setDescription('✏️ تعديل رد تلقائي')
      .addIntegerOption(o => o.setName('id').setDescription('رقم الرد').setRequired(true)))
    .addSubcommand(s => s
      .setName('channels')
      .setDescription('📢 تحديد القنوات التي يعمل فيها الرد')
      .addIntegerOption(o => o.setName('id').setDescription('رقم الرد').setRequired(true)))
    .addSubcommand(s => s
      .setName('test')
      .setDescription('🧪 تجربة رد تلقائي — يُظهر ما سيُرسله البوت')
      .addIntegerOption(o => o.setName('id').setDescription('رقم الرد').setRequired(true)))
    .addSubcommand(s => s
      .setName('remove')
      .setDescription('🗑️ حذف رد تلقائي')
      .addIntegerOption(o => o.setName('id').setDescription('رقم الرد').setRequired(true))),

  // ──────────────────────────────────────────────────────
  async execute(interaction) {
    if (!hasPermission(interaction.member, interaction.guildId, 'autoreply', interaction.channelId)) {
      return interaction.reply({ embeds: [errEmbed('ليس لديك صلاحية إدارة الردود التلقائية.')], flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    // ── ADD ──────────────────────────────────────────────
    if (sub === 'add') {
      const modal = new ModalBuilder().setCustomId('autoreply_add_modal').setTitle('➕ إضافة رد تلقائي');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('keyword').setLabel('🔑 الكلمة المفتاحية')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)
            .setPlaceholder('مثال: مرحبا')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('responses').setLabel('💬 الردود (سطر لكل رد — يختار عشوائياً)')
            .setStyle(TextInputStyle.Paragraph).setRequired(true)
            .setPlaceholder('✨ أهلاً وسهلاً!\n🌟 مرحباً بك!\n💫 أهلين!')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cooldown').setLabel('⏱️ وقت الانتظار بالثواني (افتراضي: 60)')
            .setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('60')
        )
      );
      return interaction.showModal(modal);
    }

    // ── LIST ─────────────────────────────────────────────
    if (sub === 'list') {
      const replies = db.prepare('SELECT * FROM auto_replies WHERE guild_id=? ORDER BY created_by DESC, id ASC').all(interaction.guildId);
      if (!replies.length) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setColor(0x2E7D32)
            .setTitle('📭 لا توجد ردود تلقائية')
            .setDescription('> استخدم `/autoreply add` لإضافة ردودك الخاصة\n> الردود الافتراضية (30 رداً) تُضاف تلقائياً عند إعداد البوت')
            .setTimestamp()],
          flags: MessageFlags.Ephemeral
        });
      }
      return interaction.reply({ embeds: [buildListEmbed(replies)], flags: MessageFlags.Ephemeral });
    }

    // ── EDIT ─────────────────────────────────────────────
    if (sub === 'edit') {
      const id    = interaction.options.getInteger('id');
      const reply = db.prepare('SELECT * FROM auto_replies WHERE id=? AND guild_id=?').get(id, interaction.guildId);

      if (!reply) return interaction.reply({ embeds: [errEmbed(`لا يوجد رد برقم **#${id}**.`)], flags: MessageFlags.Ephemeral });

      const modal = new ModalBuilder().setCustomId(`autoreply_edit_modal_${id}`).setTitle(`✏️ تعديل الرد #${id}`);
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('keyword').setLabel('🔑 الكلمة المفتاحية')
            .setStyle(TextInputStyle.Short).setRequired(true).setValue(reply.keyword)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('responses').setLabel('💬 الردود (سطر لكل رد)')
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setValue(reply.responses)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cooldown').setLabel('⏱️ وقت الانتظار بالثواني')
            .setStyle(TextInputStyle.Short).setRequired(false).setValue(String(reply.cooldown))
        )
      );
      return interaction.showModal(modal);
    }

    // ── CHANNELS ─────────────────────────────────────────
    if (sub === 'channels') {
      const id    = interaction.options.getInteger('id');
      const reply = db.prepare('SELECT * FROM auto_replies WHERE id=? AND guild_id=?').get(id, interaction.guildId);

      if (!reply) return interaction.reply({ embeds: [errEmbed(`لا يوجد رد برقم **#${id}**.`)], flags: MessageFlags.Ephemeral });

      const currentChannels = reply.allowed_channels
        ? reply.allowed_channels.split(',').filter(Boolean).map(c => `<#${c.trim()}>`).join(' ')
        : '🟢 **كل القنوات (بلا قيود)**';

      const chanSelect = new ChannelSelectMenuBuilder()
        .setCustomId(`autoreply_chan_select_${id}`)
        .setPlaceholder('📢 اختر قنوات محددة لهذا الرد')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1).setMaxValues(25);

      const clearBtn = new ButtonBuilder()
        .setCustomId(`autoreply_chan_clear_${id}`)
        .setLabel('🟢 السماح في كل القنوات')
        .setStyle(ButtonStyle.Success);

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x1A8CD8)
            .setTitle(`📢 قنوات الرد #${id} — كلمة: \`${reply.keyword}\``)
            .setDescription(
              `**القنوات الحالية:** ${currentChannels}\n\n` +
              '> اختر القنوات التي سيعمل فيها هذا الرد فقط\n' +
              '> أو اضغط "السماح في كل القنوات" لإزالة القيود'
            )
            .setTimestamp()
        ],
        components: [
          new ActionRowBuilder().addComponents(chanSelect),
          new ActionRowBuilder().addComponents(clearBtn),
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── TEST ─────────────────────────────────────────────
    if (sub === 'test') {
      const id    = interaction.options.getInteger('id');
      const reply = db.prepare('SELECT * FROM auto_replies WHERE id=? AND guild_id=?').get(id, interaction.guildId);

      if (!reply) return interaction.reply({ embeds: [errEmbed(`لا يوجد رد برقم **#${id}**.`)], flags: MessageFlags.Ephemeral });

      const responses = reply.responses.split('\n').filter(r => r.trim());
      const palette   = randomPalette();

      // إرسال نموذج لكل الردود الممكنة (أول 5)
      const preview = responses.slice(0, 5);
      const fields  = preview.map((r, i) => ({
        name: `رد #${i + 1}${i === 0 ? ' ← الرد التجريبي أدناه' : ''}`,
        value: r.slice(0, 200),
        inline: false,
      }));

      // إمبد المعاينة الفعلي (كما سيظهر)
      const previewEmbed = new EmbedBuilder()
        .setColor(palette.color)
        .setDescription(responses[0])
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ dynamic: true }) || undefined })
        .setFooter({ text: `${palette.icon} رد تلقائي`, iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`🧪 تجربة الرد #${id} — كلمة: \`${reply.keyword}\``)
            .setDescription(
              `**عدد الردود:** ${responses.length}\n` +
              `**القنوات:** ${reply.allowed_channels ? reply.allowed_channels.split(',').map(c => `<#${c.trim()}>`).join(' ') : '🟢 كل القنوات'}\n` +
              `**Cooldown:** ${reply.cooldown} ثانية\n\n` +
              `**معاينة الردود:**`
            )
            .addFields(fields)
            .setFooter({ text: 'الإمبد التالي يُظهر كيف سيبدو الرد للأعضاء ↓' })
            .setTimestamp(),
          previewEmbed,
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    // ── REMOVE ───────────────────────────────────────────
    if (sub === 'remove') {
      const id    = interaction.options.getInteger('id');
      const reply = db.prepare('SELECT * FROM auto_replies WHERE id=? AND guild_id=?').get(id, interaction.guildId);

      if (!reply) return interaction.reply({ embeds: [errEmbed(`لا يوجد رد برقم **#${id}**.`)], flags: MessageFlags.Ephemeral });

      return interaction.reply({
        embeds: [
          new EmbedBuilder().setColor(0xF39C12)
            .setTitle(`⚠️ تأكيد حذف الرد #${id}`)
            .setDescription(`الكلمة المفتاحية: **\`${reply.keyword}\`**`)
            .addFields(
              { name: '💬 عدد الردود',  value: `${reply.responses.split('\n').filter(x=>x.trim()).length}`, inline: true },
              { name: '⏱️ Cooldown',    value: `${reply.cooldown}ث`,                                        inline: true },
            )
            .setFooter({ text: 'هذا الإجراء لا يمكن التراجع عنه!' })
        ],
        components: [new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`autoreply_delete_${id}`).setLabel('🗑️ نعم، احذف').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('autoreply_cancel').setLabel('◀ إلغاء').setStyle(ButtonStyle.Secondary)
        )],
        flags: MessageFlags.Ephemeral
      });
    }
  },

  // ── Modals ─────────────────────────────────────────────
  async handleModal(interaction) {

    if (interaction.customId === 'autoreply_add_modal') {
      const keyword   = interaction.fields.getTextInputValue('keyword').toLowerCase().trim();
      const responses = interaction.fields.getTextInputValue('responses').trim();
      const cooldown  = parseInt(interaction.fields.getTextInputValue('cooldown').trim()) || 60;

      if (!keyword || !responses)
        return interaction.reply({ embeds: [errEmbed('الكلمة والردود إلزامية.')], flags: MessageFlags.Ephemeral });

      db.prepare(
        'INSERT INTO auto_replies (guild_id, keyword, responses, cooldown, created_by) VALUES (?,?,?,?,?)'
      ).run(interaction.guildId, keyword, responses, cooldown, interaction.user.id);

      const count = responses.split('\n').filter(x=>x.trim()).length;
      await sendLog(interaction.client, interaction.guildId, {
        type: 'success', title: '💬 رد تلقائي جديد',
        description: `**${interaction.user.tag}** أضاف رداً للكلمة: \`${keyword}\` (${count} ردود)`
      });

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('✅ تم إضافة الرد التلقائي')
            .setDescription(`سيرد البوت عند كتابة **\`${keyword}\`** بإمبد ملون عشوائي ✨`)
            .addFields(
              { name: '🔑 الكلمة',     value: `\`${keyword}\``, inline: true },
              { name: '💬 الردود',     value: `${count} رد`,    inline: true },
              { name: '⏱️ Cooldown',   value: `${cooldown}ث`,   inline: true },
              { name: '📢 القنوات',    value: '🟢 كل القنوات (يمكن تغييرها بـ `/autoreply channels`)', inline: false },
            )
            .setFooter({ text: 'استخدم /autoreply test للمعاينة!' })
            .setTimestamp()
        ],
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.customId.startsWith('autoreply_edit_modal_')) {
      const id        = parseInt(interaction.customId.replace('autoreply_edit_modal_', ''));
      const keyword   = interaction.fields.getTextInputValue('keyword').toLowerCase().trim();
      const responses = interaction.fields.getTextInputValue('responses').trim();
      const cooldown  = parseInt(interaction.fields.getTextInputValue('cooldown').trim()) || 60;

      db.prepare(
        'UPDATE auto_replies SET keyword=?, responses=?, cooldown=? WHERE id=? AND guild_id=?'
      ).run(keyword, responses, cooldown, id, interaction.guildId);

      const count = responses.split('\n').filter(x=>x.trim()).length;
      await sendLog(interaction.client, interaction.guildId, {
        type: 'info', title: `✏️ تعديل رد #${id}`,
        description: `**${interaction.user.tag}** عدّل الكلمة: \`${keyword}\``
      });

      return interaction.reply({
        embeds: [successEmbed(`✅ تم تعديل الرد #${id}`,
          `🔑 **\`${keyword}\`** — ${count} رد — cooldown ${cooldown}ث`)
        ],
        flags: MessageFlags.Ephemeral
      });
    }
  },

  // ── Select Menus ──────────────────────────────────────
  async handleSelectMenu(interaction) {

    // اختيار قنوات محددة
    if (interaction.customId.startsWith('autoreply_chan_select_')) {
      const id = parseInt(interaction.customId.replace('autoreply_chan_select_', ''));
      const channelIds = interaction.values.join(',');

      db.prepare('UPDATE auto_replies SET allowed_channels=? WHERE id=? AND guild_id=?').run(channelIds, id, interaction.guildId);

      const chStr = interaction.values.map(c => `<#${c}>`).join(' ');
      await sendLog(interaction.client, interaction.guildId, {
        type: 'info', title: `📢 تحديد قنوات الرد #${id}`,
        description: `**${interaction.user.tag}** حدّد القنوات: ${chStr}`
      });

      return interaction.update({
        embeds: [successEmbed(`✅ تم تحديد القنوات للرد #${id}`, `سيعمل هذا الرد فقط في:\n${chStr}`)],
        components: []
      });
    }
  },

  // ── Buttons ────────────────────────────────────────────
  async handleButton(interaction) {
    if (interaction.customId === 'autoreply_cancel') {
      return interaction.update({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setDescription('◀ تم الإلغاء.').setTimestamp()],
        components: []
      });
    }

    if (interaction.customId.startsWith('autoreply_chan_clear_')) {
      const id = parseInt(interaction.customId.replace('autoreply_chan_clear_', ''));
      db.prepare('UPDATE auto_replies SET allowed_channels=NULL WHERE id=? AND guild_id=?').run(id, interaction.guildId);

      await sendLog(interaction.client, interaction.guildId, {
        type: 'info', title: `🟢 فتح كل القنوات للرد #${id}`,
        description: `**${interaction.user.tag}** أزال قيود القنوات`
      });

      return interaction.update({
        embeds: [successEmbed(`✅ تم فتح كل القنوات للرد #${id}`, 'سيعمل الرد في جميع قنوات السيرفر.')],
        components: []
      });
    }

    if (interaction.customId.startsWith('autoreply_delete_')) {
      const id    = parseInt(interaction.customId.replace('autoreply_delete_', ''));
      const reply = db.prepare('SELECT keyword FROM auto_replies WHERE id=? AND guild_id=?').get(id, interaction.guildId);
      db.prepare('DELETE FROM auto_replies WHERE id=? AND guild_id=?').run(id, interaction.guildId);

      await sendLog(interaction.client, interaction.guildId, {
        type: 'warning', title: `🗑️ حذف رد #${id}`,
        description: `**${interaction.user.tag}** حذف كلمة: \`${reply?.keyword || '؟'}\``
      });

      return interaction.update({
        embeds: [successEmbed(`✅ تم حذف الرد #${id}`, `كلمة \`${reply?.keyword || '؟'}\` محذوفة.`)],
        components: []
      });
    }
  }
};
