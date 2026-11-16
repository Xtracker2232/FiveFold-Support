// Registers the slash commands on your server. Run once, and again after changing commands:
//   npm run deploy
const { REST, Routes } = require('discord.js');
const config = require('./config');
const { commands } = require('./commands');

const rest = new REST().setToken(config.token);
const body = commands.map((c) => c.data.toJSON());

rest
  .put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body })
  .then(() => console.log(`✅ Registered ${body.length} commands.`))
  .catch(console.error);
