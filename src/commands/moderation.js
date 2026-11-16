const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { modLog, addWarn, getWarns, errorEmbed, successEmbed } = require('../utils');
const config = require('../config');

const reasonOf = (i) => i.options.getString('reason') ?? 'No reason provided';

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a member from the server')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((o) => o.setName('user').setDescription('Member to ban').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason')),
    async execute(i) {
      const user = i.options.getUser('user');
      const member = await i.guild.members.fetch(user.id).catch(() => null);
      if (member && !member.bannable) {
        return i.reply({ embeds: [errorEmbed('I cannot ban this member (role too high).')], ephemeral: true });
      }
      const reason = reasonOf(i);
      await user.send(`You have been banned from **${i.guild.name}**. Reason: ${reason}`).catch(() => {});
      await i.guild.members.ban(user, { reason });
      await i.reply({ embeds: [successEmbed(`**${user.tag}** has been banned.`)] });
      await modLog(i.guild, { action: 'Ban', target: user, moderator: i.user, reason });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a member from the server')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason')),
    async execute(i) {
      const member = i.options.getMember('user');
      if (!member) return i.reply({ embeds: [errorEmbed('Member not found.')], ephemeral: true });
      if (!member.kickable) {
        return i.reply({ embeds: [errorEmbed('I cannot kick this member (role too high).')], ephemeral: true });
      }
      const reason = reasonOf(i);
      await member.send(`You have been kicked from **${i.guild.name}**. Reason: ${reason}`).catch(() => {});
      await member.kick(reason);
      await i.reply({ embeds: [successEmbed(`**${member.user.tag}** has been kicked.`)] });
      await modLog(i.guild, { action: 'Kick', target: member.user, moderator: i.user, reason, color: 0xffa94d });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Timeout a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('user').setDescription('Member to timeout').setRequired(true))
      .addIntegerOption((o) =>
        o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320),
      )
      .addStringOption((o) => o.setName('reason').setDescription('Reason')),
    async execute(i) {
      const member = i.options.getMember('user');
      if (!member) return i.reply({ embeds: [errorEmbed('Member not found.')], ephemeral: true });
      if (!member.moderatable) {
        return i.reply({ embeds: [errorEmbed('I cannot timeout this member (role too high).')], ephemeral: true });
      }
      const minutes = i.options.getInteger('minutes');
      const reason = reasonOf(i);
      await member.timeout(minutes * 60_000, reason);
      await i.reply({ embeds: [successEmbed(`**${member.user.tag}** has been timed out for ${minutes} min.`)] });
      await modLog(i.guild, {
        action: `Timeout (${minutes} min)`,
        target: member.user,
        moderator: i.user,
        reason,
        color: 0xffd43b,
      });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('clear')
      .setDescription('Delete messages in this channel')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addIntegerOption((o) =>
        o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
      ),
    async execute(i) {
      const amount = i.options.getInteger('amount');
      // bulkDelete skips messages older than 14 days (Discord limit)
      const deleted = await i.channel.bulkDelete(amount, true);
      await i.reply({ embeds: [successEmbed(`Deleted **${deleted.size}** message(s).`)], ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warn a member')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('user').setDescription('Member to warn').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true)),
    async execute(i) {
      const user = i.options.getUser('user');
      const reason = reasonOf(i);
      const count = addWarn(user.id, { reason, moderator: i.user.id, date: Date.now() });
      await user.send(`You have been warned in **${i.guild.name}**. Reason: ${reason}`).catch(() => {});
      await i.reply({ embeds: [successEmbed(`**${user.tag}** has been warned. (Total: ${count})`)] });
      await modLog(i.guild, { action: `Warn #${count}`, target: user, moderator: i.user, reason, color: 0xffd43b });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('warnings')
      .setDescription("Show a member's warnings")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
    async execute(i) {
      const user = i.options.getUser('user');
      const warns = getWarns(user.id);
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setTitle(`Warnings for ${user.tag}`)
        .setDescription(
          warns.length
            ? warns
                .slice(-15)
                .map((w, n) => `**${n + 1}.** ${w.reason} — <@${w.moderator}> <t:${Math.floor(w.date / 1000)}:R>`)
                .join('\n')
            : 'No warnings. 🎉',
        );
      await i.reply({ embeds: [embed], ephemeral: true });
    },
  },
];
