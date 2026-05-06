const { ActivityType } = require('discord.js');
const { startNotificationPoller } = require('../handlers/notificationPoller');
const { startReminderManager }    = require('../handlers/reminderManager');
const { setupGuildDefaults }      = require('../handlers/setupDefaults');

module.exports = {
  name: 'clientReady',   // إصلاح: كان 'ready' (deprecated في v14)
  once: true,
  async execute(client) {
    console.log(`\n✅ البوت جاهز: ${client.user.tag}`);
    console.log(`📡 السيرفرات: ${client.guilds.cache.size}`);
    console.log(`🤖 الأوامر:   ${client.commands?.size || 0}\n`);

    client.user.setPresence({
      activities: [{ name: '🎥 YouTube • Kick • Twitter', type: ActivityType.Watching }],
      status: 'online'
    });

    // إعداد البيانات الافتراضية لكل سيرفر
    for (const guild of client.guilds.cache.values()) {
      setupGuildDefaults(guild.id).catch(() => {});
    }

    startNotificationPoller(client);
    startReminderManager(client);

    client.on('reminderRestart', (c) => startReminderManager(c));
  }
};
