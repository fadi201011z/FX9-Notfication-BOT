const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, MessageFlags,
} = require('discord.js');

const PAGES = {
  setup: {
    title: '🚀 دليل الإعداد السريع',
    color: 0x1B5E20,
    fields: [
      { name: '1️⃣  أضِف البوت للسيرفر', value: 'استخدم رابط الدعوة من لوحة Discord Developers' },
      { name: '2️⃣  حدد رومات الإشعارات', value: '```\n/setchannel platform:YouTube  channel:#youtube\n/setchannel platform:Kick     channel:#kick\n/setchannel platform:Twitter  channel:#twitter\n```' },
      { name: '3️⃣  اربط قناتك بالرابط فقط', value: '```\n/link url:https://youtube.com/@channel\n/link url:https://kick.com/username\n/link url:https://twitter.com/user\n```' },
      { name: '4️⃣  جرّب إشعاراً تجريبياً', value: '```\n/test platform:YouTube\n/test platform:Kick\n/test platform:Twitter\n```' },
      { name: '5️⃣  فعّل التذكيرات الإسلامية', value: '```\n/reminder list           ← لرؤية القوالب\n/reminder setchannel id:1 channel:#الصلاة\n```' },
      { name: '6️⃣  اضبط الصلاحيات', value: '```\n/setroles    ← لوحة الصلاحيات المتقدمة\n```' },
      { name: '7️⃣  روم السجلات (اختياري)', value: '```\n/setlogchannel channel:#logs\n```' },
    ]
  },
  notifications: {
    title: '📡 الإشعارات والربط',
    color: 0x0D47A1,
    fields: [
      { name: '`/link url:<رابط>`', value: '🔗 ربط قناتك بالرابط المباشر — **بلا API Key!**\n**يدعم:** 🎥 YouTube • 🟢 Kick • 𝕏 Twitter/X' },
      { name: '`/test platform:<منصة>`', value: '🧪 إرسال إشعار حقيقي الآن للاختبار\n**يجلب:** آخر فيديو / حالة البث / آخر تغريدة' },
      { name: '`/setchannel`', value: '📢 تحديد روم الإشعارات لكل منصة *(للمسؤولين)*' },
      { name: '⚡ فترات الفحص التلقائي', value: '🎥 YouTube: كل 5 دقائق\n🟢 Kick: كل دقيقة\n𝕏 Twitter: كل دقيقتين' },
    ]
  },
  reminder: {
    title: '⏰ التذكيرات الإسلامية التلقائية',
    color: 0x1B5E20,
    fields: [
      { name: '`/reminder add`', value: '➕ إضافة تذكير جديد:\n• عنوان • Channel ID • نص • تكرار بالدقائق' },
      { name: '`/reminder list`', value: '📋 لائحة شاملة تشمل:\n🟢 مفعّلة | 🔴 موقوفة | 🔧 قوالب إسلامية جاهزة' },
      { name: '`/reminder setchannel id:<رقم> channel:<قناة>`', value: '📢 **تعيين قناة لتذكير بضغطة واحدة** — يفعّله تلقائياً!\nمثالي للقوالب الجاهزة!' },
      { name: '`/reminder test id:<رقم>`', value: '🧪 **جديد!** إرسال التذكير الآن للاختبار' },
      { name: '`/reminder edit id:<رقم>`', value: '✏️ تعديل عنوان أو نص أو وقت التذكير' },
      { name: '`/reminder toggle id:<رقم>`', value: '🔁 تشغيل / إيقاف تذكير' },
      { name: '`/reminder remove id:<رقم>`', value: '🗑️ حذف تذكير نهائياً' },
      { name: '🕌 القوالب الإسلامية الجاهزة (12 قالب)', value: '**تُضاف تلقائياً — عيّن القناة فقط!**\n🕌 فجر • ظهر • عصر • مغرب • عشاء\n📿 ذكر • 🌿 استغفار • 📖 قرآن • 🤲 دعاء\n💝 صلاة على النبي ﷺ • 🌙 قيام • 🌟 آية اليوم' },
    ]
  },
  autoreply: {
    title: '💬 الردود التلقائية الاحترافية',
    color: 0x2E7D32,
    fields: [
      { name: '`/autoreply add`', value: '➕ إضافة رد تلقائي:\n• كلمة مفتاحية • ردود متعددة عشوائية • cooldown' },
      { name: '`/autoreply list`', value: '📋 لائحة كاملة مع عدد الردود والقنوات لكل كلمة' },
      { name: '`/autoreply channels id:<رقم>`', value: '📢 **جديد!** تحديد القنوات التي يعمل فيها الرد\n• اختر قنوات محددة أو اتركه لكل القنوات' },
      { name: '`/autoreply test id:<رقم>`', value: '🧪 **جديد!** معاينة الرد — يُظهر كيف سيبدو الإمبد للأعضاء' },
      { name: '`/autoreply edit id:<رقم>`', value: '✏️ تعديل الكلمة أو الردود أو الـ cooldown' },
      { name: '`/autoreply remove id:<رقم>`', value: '🗑️ حذف رد تلقائي' },
      { name: '🤖 الردود الافتراضية (30 رد)', value: '**تُضاف تلقائياً عند إعداد البوت:**\n`مرحبا` `السلام عليكم` `شكرا` `الحمد لله`\n`سبحان الله` `صلوا على النبي` `مساعدة` وأكثر!' },
    ]
  },
  permissions: {
    title: '🔐 نظام الصلاحيات المتقدم',
    color: 0x2C3E50,
    fields: [
      { name: '`/setroles`', value: '🛡️ **لوحة الصلاحيات الكاملة** *(للمسؤولين)*\nتحكم في من يستطيع استخدام كل أمر' },
      { name: '👥 تحديد الرتب', value: 'حدد رتبة أو أكثر لكل أمر\nفقط هؤلاء سيتمكنون من استخدامه\n*(المسؤول يتجاوز كل القيود دائماً)*' },
      { name: '📢 تحديد القنوات', value: '**جديد!** قيّد الأمر على قنوات معينة فقط\nمثال: `/autoreply` يعمل فقط في #الإدارة' },
      { name: '🟢 للجميع بضغطة', value: 'زر واحد لإزالة جميع القيود على أمر\nيصبح متاحاً لجميع الأعضاء' },
      { name: '📊 لوحة مرئية', value: 'ترى حالة كل أمر دفعة واحدة:\n🟢 للجميع | 🟡 رتب محددة | 🔵 قنوات محددة | 🔴 كلاهما' },
      { name: '`/setlogchannel`', value: '📋 تحديد روم السجلات *(للمسؤولين)*' },
    ]
  },
  announcements: {
    title: '📢 نظام الإعلانات المتطور',
    color: 0x4A148C,
    fields: [
      { name: '`/add`', value: '9 أنواع إعلان احترافية + منشن + اختيار القناة' },
      { name: '📌 أنواع الإعلانات', value: '🎥 YouTube فيديو • 🔴 YouTube بث • 🟢 Kick بث\n𝕏 Twitter • 📅 حدث • 🎁 مسابقة • 👋 ترحيب • 📰 خبر • 📢 عام' },
      { name: '📣 المنشن', value: '📢 @everyone • 👥 @here • 🏷️ رتبة محددة • 🔇 بدون' },
      { name: '🖼️ الإمبد', value: 'عنوان + نص + رابط + صورة كاملة + ألوان تلقائية' },
    ]
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📖 دليل استخدام جميع أوامر البوت'),

  async execute(interaction) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('help_page')
      .setPlaceholder('📖 اختر قسماً...')
      .addOptions([
        { label: '🚀  دليل الإعداد السريع',         value: 'setup',         emoji: '🚀' },
        { label: '📡  الإشعارات والربط',              value: 'notifications', emoji: '📡' },
        { label: '⏰  التذكيرات الإسلامية',           value: 'reminder',     emoji: '⏰' },
        { label: '💬  الردود التلقائية',              value: 'autoreply',    emoji: '💬' },
        { label: '🔐  نظام الصلاحيات المتقدم',       value: 'permissions',  emoji: '🔐' },
        { label: '📢  نظام الإعلانات',               value: 'announcements', emoji: '📢' },
      ]);

    const overview = new EmbedBuilder()
      .setColor(0x1B5E20)
      .setAuthor({
        name: '🤖 بوت الإشعارات الإسلامي الذكي',
        iconURL: interaction.client.user.displayAvatarURL()
      })
      .setTitle('📖 دليل الاستخدام الشامل')
      .setDescription(
        '**المنصات:** 🎥 YouTube • 🟢 Kick • 𝕏 Twitter/X\n' +
        '**✨ بلا API Keys** — فقط رابط القناة!\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .addFields(
        { name: '⏰ تذكيرات إسلامية',  value: '`/reminder` — 12 قالب جاهز',                   inline: true },
        { name: '💬 ردود تلقائية',      value: '`/autoreply` — 30 رد افتراضي',                  inline: true },
        { name: '🔐 صلاحيات متقدمة',   value: '`/setroles` — رتب + قنوات',                     inline: true },
        { name: '📡 إشعارات فورية',    value: '`/link` `/test` `/setchannel`',                  inline: true },
        { name: '📢 إعلانات فاخرة',    value: '`/add` — 9 أنواع + منشن',                        inline: true },
        { name: '🆕 أوامر جديدة',       value: '`/reminder setchannel` `/reminder test`\n`/autoreply channels` `/autoreply test`', inline: true },
      )
      .setFooter({ text: 'اختر قسماً من القائمة للتفاصيل ↓' })
      .setTimestamp();

    await interaction.reply({
      embeds: [overview],
      components: [new ActionRowBuilder().addComponents(select)],
      flags: MessageFlags.Ephemeral
    });
  },

  async handleSelectMenu(interaction) {
    if (interaction.customId !== 'help_page') return;
    const page = PAGES[interaction.values[0]];
    if (!page) return;

    const embed = new EmbedBuilder()
      .setColor(page.color)
      .setTitle(page.title)
      .addFields(page.fields)
      .setFooter({ text: 'استخدم القائمة للتنقل  •  /help' })
      .setTimestamp();

    await interaction.update({ embeds: [embed] });
  }
};
