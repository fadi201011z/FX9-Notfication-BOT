const { MessageFlags } = require('discord.js');
const { sendLog } = require('../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {

      // ── Slash Commands ──────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const cmd = interaction.client.commands.get(interaction.commandName);
        if (!cmd) return interaction.reply({ content: '❌ أمر غير معروف.', flags: MessageFlags.Ephemeral });
        await cmd.execute(interaction);

      // ── Buttons ────────────────────────────────────────────────
      } else if (interaction.isButton()) {
        const id = interaction.customId;
        if      (id === 'lk_confirm' || id === 'lk_cancel')
          await interaction.client.commands.get('link')?.handleButton(interaction);
        else if (id.startsWith('add_'))
          await interaction.client.commands.get('add')?.handleButton(interaction);
        else if (id.startsWith('setroles_'))
          await interaction.client.commands.get('setroles')?.handleButton(interaction);
        else if (id.startsWith('autoreply_'))
          await interaction.client.commands.get('autoreply')?.handleButton(interaction);
        else if (id.startsWith('reminder_'))
          await interaction.client.commands.get('reminder')?.handleButton(interaction);

      // ── All Select Menus ───────────────────────────────────────
      } else if (
        interaction.isStringSelectMenu()     ||
        interaction.isRoleSelectMenu()       ||
        interaction.isChannelSelectMenu()    ||
        interaction.isUserSelectMenu()       ||
        interaction.isMentionableSelectMenu()
      ) {
        const id = interaction.customId;
        if      (id === 'help_page')
          await interaction.client.commands.get('help')?.handleSelectMenu(interaction);
        else if (id.startsWith('add_'))
          await interaction.client.commands.get('add')?.handleSelectMenu(interaction);
        else if (id.startsWith('setroles_'))
          await interaction.client.commands.get('setroles')?.handleSelectMenu(interaction);
        else if (id.startsWith('autoreply_'))
          await interaction.client.commands.get('autoreply')?.handleSelectMenu(interaction);

      // ── Modals ─────────────────────────────────────────────────
      } else if (interaction.isModalSubmit()) {
        const id = interaction.customId;
        if      (id.startsWith('add_modal_'))
          await interaction.client.commands.get('add')?.handleModal(interaction);
        else if (id.startsWith('autoreply_'))
          await interaction.client.commands.get('autoreply')?.handleModal(interaction);
        else if (id.startsWith('reminder_'))
          await interaction.client.commands.get('reminder')?.handleModal(interaction);
      }

    } catch (err) {
      console.error('[InteractionCreate]', err.message);
      const msg = { content: `❌ خطأ: \`${err.message}\``, flags: MessageFlags.Ephemeral };
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      } catch (_) {}

      if (interaction.guildId) {
        await sendLog(interaction.client, interaction.guildId, {
          type: 'error', title: 'خطأ في تفاعل',
          description: `\`${err.message}\``,
          fields: [
            { name: '📋 الأمر',    value: interaction.commandName || interaction.customId || '?', inline: true },
            { name: '👤 المستخدم', value: interaction.user?.tag || '?',                           inline: true },
          ]
        }).catch(() => {});
      }
    }
  }
};
