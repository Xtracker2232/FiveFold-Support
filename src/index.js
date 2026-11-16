const { Client, GatewayIntentBits, Events, EmbedBuilder, ActivityType } = require('discord.js');
const config = require('./config');
const { commands, components } = require('./commands');
const { errorEmbed, getTextChannel } = require('./utils');
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

// Register slash commands on the configured server
async function registerCommands(guild) {
  try {
    const list = await guild.commands.set(commands.map((c) => c.data.toJSON()));
    console.log(`✅ Registered ${list.size} slash commands on "${guild.name}"`);
  } catch (e) {
    console.error('❌ Command registration failed:', e.message);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 Logged in as ${c.user.tag}`);
  c.user.setActivity('Fivefold Studio games', { type: ActivityType.Playing });

  const guild = c.guilds.cache.get(config.guildId);
  if (guild) await registerCommands(guild);
  else console.error('❌ The bot is not in the server set in GUILD_ID (invite it, commands will register automatically)');

  startPanel(client);
});

// Bot invited after it started: register right away, no restart needed
client.on(Events.GuildCreate, (guild) => {
  if (guild.id === config.guildId) registerCommands(guild);
});

// Welcome message + autorole
client.on(Events.GuildMemberAdd, async (member) => {
  if (config.autoroleId) {
    await member.roles.add(config.autoroleId).catch((e) => console.error('Autorole failed:', e.message));
  }
  const channel = await getTextChannel(member.guild, config.welcomeChannelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setAuthor({ name: member.guild.name, iconURL: member.guild.iconURL() ?? undefined })
    .setTitle(`Welcome, ${member.user.displayName}! 🎉`)
    .setDescription(
      `Hey ${member}, welcome to **${member.guild.name}**!\n\n` +
        '📜 Read the rules\n🎭 Grab your roles\n🎮 Come play our Roblox games with us\n\n' +
        'Need help? Open a ticket anytime.',
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();
  await channel.send({ content: `${member}`, embeds: [embed] }).catch(console.error);
});

// Slash commands, buttons and select menus
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isChatInputCommand()) {
      await commandMap.get(i.commandName)?.execute(i);
    } else if (i.isButton() || i.isStringSelectMenu()) {
      await components[i.customId]?.(i);
    }
  } catch (err) {
    console.error(err);
    const payload = { embeds: [errorEmbed(`Something went wrong: \`${String(err.message).slice(0, 300)}\``)], ephemeral: true };
    if (i.replied || i.deferred) await i.followUp(payload).catch(() => {});
    else await i.reply(payload).catch(() => {});
  }
});

client.login(config.token);
