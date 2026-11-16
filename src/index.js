const { Client, GatewayIntentBits, Events, EmbedBuilder, ActivityType } = require('discord.js');
const config = require('./config');
const { commands, buttons } = require('./commands');
const { errorEmbed } = require('./utils');
const startPanel = require('./panel/server');

const missing = ['DISCORD_TOKEN', 'GUILD_ID'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const commandMap = new Map(commands.map((c) => [c.data.name, c]));

client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Logged in as ${c.user.tag}`);
  c.user.setActivity('Fivefold Studio games', { type: ActivityType.Playing });

  // Register slash commands on the server at every start (no need to run `npm run deploy`)
  const guild = c.guilds.cache.get(config.guildId);
  if (guild) {
    await guild.commands
      .set(commands.map((cmd) => cmd.data.toJSON()))
      .then((list) => console.log(`✅ Registered ${list.size} slash commands`))
      .catch((e) => console.error('Command registration failed:', e.message));
  } else {
    console.error('❌ The bot is not in the server set in GUILD_ID');
  }

  startPanel(client);
});

// Welcome message + autorole
client.on(Events.GuildMemberAdd, async (member) => {
  if (config.autoroleId) {
    await member.roles.add(config.autoroleId).catch((e) => console.error('Autorole failed:', e.message));
  }
  if (!config.welcomeChannelId) return;
  const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(`Welcome to ${member.guild.name}! 🎉`)
    .setDescription(
      `Hey ${member}, glad to have you here!\n\n` +
        'Check out the rules, grab your roles and come play our Roblox games with us. 🎮',
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `You are member #${member.guild.memberCount}` })
    .setTimestamp();
  await channel.send({ content: `${member}`, embeds: [embed] }).catch(console.error);
});

// Slash commands + buttons
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) {
      await commandMap.get(i.commandName)?.execute(i);
    } else if (i.isButton()) {
      await buttons[i.customId]?.(i);
    }
  } catch (err) {
    console.error(err);
    const payload = { embeds: [errorEmbed('Something went wrong.')], ephemeral: true };
    if (i.replied || i.deferred) await i.followUp(payload).catch(() => {});
    else await i.reply(payload).catch(() => {});
  }
});

client.login(config.token);
