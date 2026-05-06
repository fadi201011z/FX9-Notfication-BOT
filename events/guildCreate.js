const { setupGuildDefaults } = require('../handlers/setupDefaults');

module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    console.log(`[GuildCreate] انضم البوت لسيرفر: ${guild.name} (${guild.id})`);
    setupGuildDefaults(guild.id);
  }
};
