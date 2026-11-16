const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed } = require('../utils');
const config = require('../config');

async function getChannel(guild, id) {
  if (!id) return null;
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

module.exports = [
  {
    data: new SlashCommandBuilder()
      .setName('announce')
      .setDescription('Post a game update / announcement')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((o) => o.setName('title').setDescription('Title').setRequired(true))
      .addStringOption((o) =>
        o.setName('message').setDescription('Content (use \\n for new lines)').setRequired(true),
      )
      .addStringOption((o) => o.setName('image').setDescription('Image URL'))
      .addBooleanOption((o) => o.setName('ping').setDescription('Ping @everyone')),
    async execute(i) {
      const channel = (await getChannel(i.guild, config.announceChannelId)) ?? i.channel;
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ name: 'Fivefold Studio', iconURL: i.guild.iconURL() ?? undefined })
        .setTitle(i.options.getString('title'))
        .setDescription(i.options.getString('message').replaceAll('\\n', '\n'))
        .setFooter({ text: `Posted by ${i.user.username}` })
        .setTimestamp();
      const image = i.options.getString('image');
      if (image?.startsWith('http')) embed.setImage(image);

      const ping = i.options.getBoolean('ping');
      await channel.send({
        content: ping ? '@everyone' : undefined,
        embeds: [embed],
        allowedMentions: { parse: ping ? ['everyone'] : [] },
      });
      await i.reply({ embeds: [successEmbed(`Announcement posted in ${channel}.`)], ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('suggest')
      .setDescription('Submit a suggestion for our games')
      .addStringOption((o) =>
        o.setName('idea').setDescription('Your suggestion').setRequired(true).setMaxLength(1500),
      ),
    async execute(i) {
      const channel = await getChannel(i.guild, config.suggestionChannelId);
      if (!channel) return i.reply({ embeds: [errorEmbed('Suggestion channel is not configured.')], ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
        .setTitle('💡 New suggestion')
        .setDescription(i.options.getString('idea'))
        .setFooter({ text: 'Vote with ✅ or ❌' })
        .setTimestamp();
      const msg = await channel.send({ embeds: [embed] });
      await msg.react('✅');
      await msg.react('❌');
      await msg.startThread({ name: `Suggestion by ${i.user.username}`.slice(0, 100) }).catch(() => {});
      await i.reply({ embeds: [successEmbed(`Thanks! Your suggestion was posted in ${channel}.`)], ephemeral: true });
    },
  },
  {
    data: new SlashCommandBuilder()
      .setName('roblox')
      .setDescription('Show info about a Roblox player')
      .addStringOption((o) => o.setName('username').setDescription('Roblox username').setRequired(true)),
    async execute(i) {
      await i.deferReply();
      const username = i.options.getString('username');
      try {
        const lookup = await fetch('https://users.roblox.com/v1/usernames/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
        }).then((r) => r.json());
        const found = lookup.data?.[0];
        if (!found) return i.editReply({ embeds: [errorEmbed(`No Roblox user named **${username}**.`)] });

        const [user, thumb] = await Promise.all([
          fetch(`https://users.roblox.com/v1/users/${found.id}`).then((r) => r.json()),
          fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${found.id}&size=420x420&format=Png`,
          ).then((r) => r.json()),
        ]);

        const embed = new EmbedBuilder()
          .setColor(config.color)
          .setTitle(`${user.displayName} (@${user.name})`)
          .setURL(`https://www.roblox.com/users/${user.id}/profile`)
          .setDescription(user.description?.slice(0, 400) || '*No description*')
          .addFields(
            { name: 'User ID', value: `${user.id}`, inline: true },
            { name: 'Joined', value: `<t:${Math.floor(new Date(user.created).getTime() / 1000)}:D>`, inline: true },
            { name: 'Banned', value: user.isBanned ? 'Yes' : 'No', inline: true },
          );
        const img = thumb.data?.[0]?.imageUrl;
        if (img) embed.setThumbnail(img);
        await i.editReply({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        await i.editReply({ embeds: [errorEmbed('Could not reach the Roblox API, try again later.')] });
      }
    },
  },
];
