const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const { errorEmbed } = require('../utils');
const config = require('../config');

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('ticket-panel')
      .setDescription('Post the support ticket panel in this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(i) {
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle('🎫 Fivefold Studio Support')
        .setDescription(
          'Need help? Click the button below to open a private ticket with our staff.\n\n' +
            '• 🐛 Bug reports\n• 🚨 Player reports\n• 🤝 Partnerships\n• ❓ Other questions',
        );
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel('Open a ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary),
      );
      await i.channel.send({ embeds: [embed], components: [row] });
      await i.reply({ content: 'Ticket panel posted.', ephemeral: true });
    },
  },
];

// Button handlers, keyed by customId
const buttons = {
  async ticket_open(i) {
    // One open ticket per user: we store the owner id in the channel topic
    const existing = i.guild.channels.cache.find((c) => c.topic === `ticket:${i.user.id}`);
    if (existing) {
      return i.reply({ embeds: [errorEmbed(`You already have an open ticket: ${existing}`)], ephemeral: true });
    }

    const overwrites = [
      { id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: i.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles],
      },
      { id: i.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
    ];
    if (config.staffRoleId) {
      overwrites.push({
        id: config.staffRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    }

    const channel = await i.guild.channels.create({
      name: `ticket-${i.user.username}`.toLowerCase().slice(0, 90),
      type: ChannelType.GuildText,
      parent: config.ticketCategoryId || null,
      topic: `ticket:${i.user.id}`,
      permissionOverwrites: overwrites,
    });

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle('🎫 Ticket opened')
      .setDescription(`Hi ${i.user}! Describe your issue and a staff member will answer soon.`);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close').setLabel('Close ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    );
    await channel.send({
      content: `${i.user}${config.staffRoleId ? ` <@&${config.staffRoleId}>` : ''}`,
      embeds: [embed],
      components: [row],
    });
    await i.reply({ content: `Your ticket has been created: ${channel}`, ephemeral: true });
  },

  async ticket_close(i) {
    if (!i.channel.topic?.startsWith('ticket:')) return;
    await i.reply('🔒 This ticket will be deleted in 5 seconds...');
    setTimeout(() => i.channel.delete().catch(console.error), 5000);
  },
};

module.exports = { commands, buttons };
