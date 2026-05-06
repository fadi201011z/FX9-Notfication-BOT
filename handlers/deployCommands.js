require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, '..', 'commands');
const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of files) {
  const command = require(path.join(commandsPath, file));
  if (command.data) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 جاري تسجيل ${commands.length} أمر(اً)...`);

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('✅ تم تسجيل جميع الأوامر بنجاح!');
    console.log('الأوامر المسجلة:', commands.map(c => `/${c.name}`).join(', '));
  } catch (err) {
    console.error('❌ خطأ في تسجيل الأوامر:', err);
    process.exit(1);
  }
})();
