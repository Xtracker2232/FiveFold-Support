const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
  AttachmentBuilder,
  OverwriteType,
} = require('discord.js');
const { errorEmbed, successEmbed, isStaff, getTextChannel } = require('../utils');
const config = require('../config');

const TYPES = {
  bug: { label: 'Bug report', emoji: '🐛', description: 'Something is broken in one of our games' },
  report: { label: 'Player report', emoji: '🚨', description: 'Report a cheater or rule breaker' },
  partner: { label: 'Partnership', emoji: '🤝', description: 'Collabs, partnerships, business' },
  other: { label: 'Other', emoji: '❓', description: 'Any other question' },
};

// The channel topic stores the ticket owner and type: "ticket:<userId>:<type>"
const ticketInfo = (channel) => {
  const [tag, ownerId, type] = (channel.topic ?? '').split(':');
  return tag === 'ticket' ? { ownerId, type } : null;
};

function ticketButtons(claimedBy) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel(claimedBy ? `Claimed by ${claimedBy}` : 'Claim')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Success)
      .setDisabled(Boolean(claimedBy)),
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );
}

async function buildTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const lines = [...messages.values()].reverse().map((m) => {
    const extra = [
      m.embeds.length ? '[embed]' : '',
      ...m.attachments.map((a) => a.url),
    ].filter(Boolean);
    return `[${m.createdAt.toISOString().slice(0, 16).replace('T', ' ')}] ${m.author.tag}: ${m.content} ${extra.join(' ')}`.trim();
  });
  return new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `${channel.name}.txt` });
}

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('ticket-panel')
      .setDescription('Post the support ticket panel in this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    async execute(i) {
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ name: i.guild.name, iconURL: i.guild.iconURL() ?? undefined })
        .setTitle('🎫 Support Center')
        .setDescription(
          'Need help from the team? Pick a category below and a **private ticket** will be created for you.\n\n' +
            Object.values(TYPES)
              .map((t) => `${t.emoji} **${t.label}** — ${t.description}`)
              .join('\n'),
        )
        .setFooter({ text: 'Please do not open tickets for no reason.' });
      const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket_type')
        .setPlaceholder('📩 Choose a category to open a ticket')
        .addOptions(
          Object.entries(TYPES).map(([value, t]) => ({ value, label: t.label, emoji: t.emoji, description: t.description })),
        );
      await i.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] });
      await i.reply({ content: 'Ticket panel posted.', ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('add')
      .setDescription('Add someone to this ticket')
      .addUserOption((o) => o.setName('user').setDescription('Member to add').setRequired(true)),
    async execute(i) {
      const info = await checkTicketAccess(i);
      if (!info) return;
      const member = i.options.getMember('user');
      if (!member) return i.reply({ embeds: [errorEmbed('This user is not on the server.')], ephemeral: true });
      await i.channel.permissionOverwrites.edit(
        member.id,
        { ViewChannel: true, SendMessages: true, AttachFiles: true, ReadMessageHistory: true },
        { type: OverwriteType.Member },
      );
      await i.reply({ embeds: [successEmbed(`${member} has been added to the ticket by ${i.user}.`)] });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('delete')
      .setDescription('Remove someone from this ticket')
      .addUserOption((o) => o.setName('user').setDescription('Member to remove').setRequired(true)),
    async execute(i) {
      const info = await checkTicketAccess(i);
      if (!info) return;
      const user = i.options.getUser('user');
      if (user.id === info.ownerId) {
        return i.reply({ embeds: [errorEmbed('You cannot remove the ticket owner. Close the ticket instead.')], ephemeral: true });
      }
      if (user.id === i.client.user.id) {
        return i.reply({ embeds: [errorEmbed('You cannot remove the bot from the ticket.')], ephemeral: true });
      }
      if (!i.channel.permissionOverwrites.cache.has(user.id)) {
        return i.reply({ embeds: [errorEmbed(`${user} is not in this ticket.`)], ephemeral: true });
      }
      await i.channel.permissionOverwrites.delete(user.id);
      await i.reply({ embeds: [successEmbed(`${user} has been removed from the ticket by ${i.user}.`)] });
    },
  },
];

// /add and /delete: only inside a ticket, by staff or the ticket owner
async function checkTicketAccess(i) {
  const info = ticketInfo(i.channel);
  if (!info) {
    await i.reply({ embeds: [errorEmbed('This command only works inside a ticket.')], ephemeral: true });
    return null;
  }
  if (i.user.id !== info.ownerId && !isStaff(i.member)) {
    await i.reply({ embeds: [errorEmbed('Only staff or the ticket owner can do this.')], ephemeral: true });
    return null;
  }
  return info;
}

const components = {
  async ticket_type(i) {
    const type = TYPES[i.values[0]] ? i.values[0] : 'other';
    const existing = i.guild.channels.cache.find((c) => ticketInfo(c)?.ownerId === i.user.id);
    if (existing) {
      return i.reply({ embeds: [errorEmbed(`You already have an open ticket: ${existing}`)], ephemeral: true });
    }
    await i.deferReply({ ephemeral: true });

    const overwrites = [
      { id: i.guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: i.user.id,
        type: OverwriteType.Member,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: i.client.user.id,
        type: OverwriteType.Member,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages],
      },
    ];
    const staffRole = config.staffRoleId ? i.guild.roles.cache.get(config.staffRoleId.trim()) : null;
    if (config.staffRoleId && !staffRole) {
      console.warn(`⚠️ STAFF_ROLE_ID "${config.staffRoleId}" is not a role of this server, staff won't see tickets`);
    }
    if (staffRole) {
      overwrites.push({
        id: staffRole.id,
        type: OverwriteType.Role,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      });
    }

    // Only use TICKET_CATEGORY_ID if it really is a category, otherwise create at the top
    const category = config.ticketCategoryId
      ? await i.guild.channels.fetch(config.ticketCategoryId).catch(() => null)
      : null;
    if (config.ticketCategoryId && category?.type !== ChannelType.GuildCategory) {
      console.warn('⚠️ TICKET_CATEGORY_ID is not a category ID, creating ticket without category');
    }

    const t = TYPES[type];
    let channel;
    try {
      channel = await i.guild.channels.create({
        name: `${type}-${i.user.username}`.toLowerCase().slice(0, 90),
        type: ChannelType.GuildText,
        parent: category?.type === ChannelType.GuildCategory ? category.id : null,
        topic: `ticket:${i.user.id}:${type}`,
        permissionOverwrites: overwrites,
      });
    } catch (err) {
      console.error('Ticket creation failed:', err);
      return i.editReply({
        embeds: [
          errorEmbed(
            `Could not create your ticket: \`${err.message}\`\n` +
              'Staff: make sure the bot has **Administrator** (or Manage Channels + Manage Roles) ' +
              'and that `STAFF_ROLE_ID` / `TICKET_CATEGORY_ID` are correct.',
          ),
        ],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(`${t.emoji} ${t.label}`)
      .setDescription(
        `Hi ${i.user}, thanks for reaching out!\n\n` +
          'Please describe your request with as much detail as possible ' +
          '(screenshots, Roblox username, game name...). A staff member will answer soon.',
      )
      .setTimestamp();
    await channel.send({
      content: `${i.user}${staffRole ? ` ${staffRole}` : ''}`,
      embeds: [embed],
      components: [ticketButtons()],
    });
    await i.editReply(`✅ Your ticket has been created: ${channel}`);
  },

  async ticket_claim(i) {
    if (!isStaff(i.member)) return i.reply({ embeds: [errorEmbed('Only staff can claim tickets.')], ephemeral: true });
    await i.update({ components: [ticketButtons(i.user.username)] });
    await i.channel.send(`🙋 ${i.user} will handle this ticket.`);
  },

  async ticket_close(i) {
    const info = ticketInfo(i.channel);
    if (!info) return;
    if (i.user.id !== info.ownerId && !isStaff(i.member)) {
      return i.reply({ embeds: [errorEmbed('You cannot close this ticket.')], ephemeral: true });
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Yes, close it').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );
    await i.reply({ content: 'Are you sure you want to close this ticket?', components: [row], ephemeral: true });
  },

  async ticket_close_cancel(i) {
    await i.update({ content: 'Cancelled.', components: [] });
  },

  async ticket_close_confirm(i) {
    const info = ticketInfo(i.channel);
    if (!info) return;
    await i.update({ content: '🔒 Closing...', components: [] });
    await i.channel.send(`🔒 Ticket closed by ${i.user}. This channel will be deleted in 5 seconds.`);

    const log = await getTextChannel(i.guild, config.modLogChannelId);
    if (log) {
      const embed = new EmbedBuilder()
        .setColor(0x8a8aa0)
        .setTitle('🎫 Ticket closed')
        .addFields(
          { name: 'Ticket', value: i.channel.name, inline: true },
          { name: 'Opened by', value: `<@${info.ownerId}>`, inline: true },
          { name: 'Closed by', value: `${i.user}`, inline: true },
        )
        .setTimestamp();
      await log.send({ embeds: [embed], files: [await buildTranscript(i.channel)] }).catch(console.error);
    }
    setTimeout(() => i.channel.delete().catch(console.error), 5000);
  },
};

module.exports = { commands, components };
