require('dotenv').config();

const env = process.env;

module.exports = {
  token: env.DISCORD_TOKEN,
  clientId: env.CLIENT_ID,
  guildId: env.GUILD_ID,
  welcomeChannelId: env.WELCOME_CHANNEL_ID,
  autoroleId: env.AUTOROLE_ID,
  modLogChannelId: env.MOD_LOG_CHANNEL_ID,
  staffRoleId: env.STAFF_ROLE_ID,
  ticketCategoryId: env.TICKET_CATEGORY_ID,
  announceChannelId: env.ANNOUNCE_CHANNEL_ID,
  suggestionChannelId: env.SUGGESTION_CHANNEL_ID,
  // Railway (and most hosts) set PORT and need the server to listen on 0.0.0.0
  panel: {
    host: env.PANEL_HOST || (env.PORT ? '0.0.0.0' : '127.0.0.1'),
    port: Number(env.PORT || env.PANEL_PORT) || 3000,
    password: env.PANEL_PASSWORD,
  },
  // Where warnings are saved. On Railway, point this to a mounted Volume (e.g. /data)
  dataDir: env.DATA_DIR || require('node:path').join(__dirname, '..', 'data'),
  color: 0x7c5cff, // Fivefold Studio brand color
};
