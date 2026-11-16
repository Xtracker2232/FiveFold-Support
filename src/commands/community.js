const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { errorEmbed, successEmbed, isStaff, getTextChannel } = require('../utils');
const config = require('../config');

async function decide(i, approved) {
  if (!isStaff(i.member)) return i.reply({ embeds: [errorEmbed('Only staff can do this.')], ephemeral: true });
  const embed = EmbedBuilder.from(i.message.embeds[0])
    .setColor(approved ? 0x4ade80 : 0xff5c5c)
    .setTitle(approved ? '✅ Suggestion approved' : '❌ Suggestion denied')
    .addFields({ name: 'Decision', value: `${approved ? 'Approved' : 'Denied'} by ${i.user}` });
  await i.update({ embeds: [embed], components: [] });
}

const commands = [
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
      .addStringOption((o) => o.setName('link').setDescription('Game link (adds a "Play now" button)'))
      .addBooleanOption((o) => o.setName('ping').setDescription('Ping @everyone')),
    async execute(i) {
      const channel = (await getTextChannel(i.guild, config.announceChannelId)) ?? i.channel;
      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ name: i.guild.name, iconURL: i.guild.iconURL() ?? undefined })
        .setTitle(`📢 ${i.options.getString('title')}`)
        .setDescription(i.options.getString('message').replaceAll('\\n', '\n'))
        .setFooter({ text: `Posted by ${i.user.username}` })
        .setTimestamp();
      const image = i.options.getString('image');
      if (image?.startsWith('http')) embed.setImage(image);

      const link = i.options.getString('link');
      const components = link?.startsWith('http')
        ? [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('Play now').setEmoji('🎮').setURL(link),
            ),
          ]
        : [];

      const ping = i.options.getBoolean('ping');
      await channel.send({
        content: ping ? '@everyone' : undefined,
        embeds: [embed],
        components,
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
      const channel = await getTextChannel(i.guild, config.suggestionChannelId);
      if (!channel) return i.reply({ embeds: [errorEmbed('Suggestion channel is not configured.')], ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(config.color)
        .setAuthor({ name: i.user.username, iconURL: i.user.displayAvatarURL() })
        .setTitle('💡 New suggestion')
        .setDescription(i.options.getString('idea'))
        .setFooter({ text: 'Vote with ✅ or ❌ • Staff can approve or deny' })
        .setTimestamp();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('suggest_approve').setLabel('Approve').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('suggest_deny').setLabel('Deny').setStyle(ButtonStyle.Danger),
      );
      const msg = await channel.send({ embeds: [embed], components: [row] });
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

        const id = found.id;
        const [user, thumb, friends, followers] = await Promise.all([
          fetch(`https://users.roblox.com/v1/users/${id}`).then((r) => r.json()),
          fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${id}&size=420x420&format=Png`).then((r) =>
            r.json(),
          ),
          fetch(`https://friends.roblox.com/v1/users/${id}/friends/count`).then((r) => r.json()).catch(() => ({})),
          fetch(`https://friends.roblox.com/v1/users/${id}/followers/count`).then((r) => r.json()).catch(() => ({})),
        ]);

        const embed = new EmbedBuilder()
          .setColor(config.color)
          .setTitle(`${user.displayName} (@${user.name})`)
          .setURL(`https://www.roblox.com/users/${id}/profile`)
          .setDescription(user.description?.slice(0, 400) || '*No description*')
          .addFields(
            { name: '🆔 User ID', value: `${id}`, inline: true },
            { name: '📅 Joined', value: `<t:${Math.floor(new Date(user.created).getTime() / 1000)}:D>`, inline: true },
            { name: '🚫 Banned', value: user.isBanned ? 'Yes' : 'No', inline: true },
            { name: '👥 Friends', value: `${friends.count ?? '?'}`, inline: true },
            { name: '⭐ Followers', value: `${followers.count ?? '?'}`, inline: true },
          );
        const img = thumb.data?.[0]?.imageUrl;
        if (img) embed.setThumbnail(img);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel('View profile')
            .setURL(`https://www.roblox.com/users/${id}/profile`),
        );
        await i.editReply({ embeds: [embed], components: [row] });
      } catch (err) {
        console.error(err);
        await i.editReply({ embeds: [errorEmbed('Could not reach the Roblox API, try again later.')] });
      }
    },
  },
];

const components = {
  suggest_approve: (i) => decide(i, true),
  suggest_deny: (i) => decide(i, false),
};

module.exports = { commands, components };
