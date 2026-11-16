const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getWarns } = require('../utils');
const config = require('../config');

const ts = (date, style = 'D') => `<t:${Math.floor(new Date(date).getTime() / 1000)}:${style}>`;

const commands = [
  {
    data: new SlashCommandBuilder().setName('help').setDescription('List all bot commands'),
    async execute(i) {
      const list = await i.guild.commands.fetch();
      const mine = list.filter((c) => c.applicationId === i.client.user.id);
      const fmt = (c) => `</${c.name}:${c.id}> — ${c.description}`;
      const everyone = mine.filter((c) => c.defaultMemberPermissions === null).map(fmt);
      const staff = mine.filter((c) => c.defaultMemberPermissions !== null).map(fmt);

      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ name: `${i.client.user.username} — Help`, iconURL: i.client.user.displayAvatarURL() })
        .addFields({ name: '🌍 Everyone', value: everyone.join('\n') || '—' });
      if (staff.length) embed.addFields({ name: '🛡️ Staff', value: staff.join('\n') });
      await i.reply({ embeds: [embed], ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder().setName('ping').setDescription('Check the bot latency'),
    async execute(i) {
      await i.reply({
        embeds: [new EmbedBuilder().setColor(config.color).setDescription(`🏓 Pong! **${i.client.ws.ping} ms**`)],
        ephemeral: true,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Show info about a member')
      .addUserOption((o) => o.setName('user').setDescription('Member (default: you)')),
    async execute(i) {
      const user = i.options.getUser('user') ?? i.user;
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      const roles = member?.roles.cache
        .filter((r) => r.id !== i.guild.id)
        .sort((a, b) => b.position - a.position)
        .first(10)
        .join(' ');

      const embed = new EmbedBuilder()
        .setColor(member?.displayColor || config.color)
        .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .addFields(
          { name: '🆔 ID', value: user.id, inline: true },
          { name: '📅 Account created', value: ts(user.createdAt), inline: true },
          { name: '📥 Joined server', value: member ? ts(member.joinedAt) : 'Not a member', inline: true },
          { name: '⚠️ Warnings', value: `${getWarns(user.id).length}`, inline: true },
          { name: '🎭 Roles', value: roles || 'None' },
        );
      await i.reply({ embeds: [embed] });
    },
  },
  {
    data: new SlashCommandBuilder().setName('serverinfo').setDescription('Show info about the server'),
    async execute(i) {
      const g = i.guild;
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(g.name)
        .setThumbnail(g.iconURL({ size: 256 }))
        .addFields(
          { name: '👑 Owner', value: `<@${g.ownerId}>`, inline: true },
          { name: '👥 Members', value: `${g.memberCount}`, inline: true },
          { name: '📅 Created', value: ts(g.createdAt), inline: true },
          { name: '💬 Channels', value: `${g.channels.cache.size}`, inline: true },
          { name: '🎭 Roles', value: `${g.roles.cache.size - 1}`, inline: true },
          { name: '🚀 Boosts', value: `${g.premiumSubscriptionCount ?? 0} (level ${g.premiumTier})`, inline: true },
        );
      await i.reply({ embeds: [embed] });
    },
  },
];

module.exports = { commands };
