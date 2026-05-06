const express = require('express');
const app = express();

// Render سيقوم تلقائياً بتحديد المنفذ عبر متغير البيئة PORT
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('FX9 Bot is running!');
});

app.listen(port, () => {
  console.log(`Express server is listening on port ${port}`);
});
require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel]
});

loadCommands(client);
loadEvents(client);

client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('❌ فشل تسجيل الدخول:', err.message);
  console.error('تأكد من صحة DISCORD_TOKEN في ملف .env');
  process.exit(1);
});

process.on('unhandledRejection', err => {
  console.error('[UnhandledRejection]', err?.message || err);
});

process.on('uncaughtException', err => {
  console.error('[UncaughtException]', err?.message || err);
});
