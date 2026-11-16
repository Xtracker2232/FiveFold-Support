const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config');

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();

function checkPassword(given) {
  return crypto.timingSafeEqual(hash(given ?? ''), hash(config.panel.password));
}

module.exports = function startPanel(client) {
  const { host, port, password } = config.panel;
  if (!password || password.startsWith('change-me')) {
    console.warn('⚠️  Web panel disabled: set a real PANEL_PASSWORD in .env');
    return;
  }

  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  // Every /api route needs the password
  app.use('/api', (req, res, next) => {
    if (!checkPassword(req.get('x-panel-password'))) return res.status(401).json({ error: 'Wrong password' });
    next();
  });

  const getGuild = () => client.guilds.cache.get(config.guildId);

  app.get('/api/channels', async (req, res) => {
    const guild = getGuild();
    if (!guild) return res.status(500).json({ error: 'Bot is not in the configured server (GUILD_ID)' });
    const me = guild.members.me;
    const channels = guild.channels.cache
      .filter(
        (c) =>
          (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) &&
          c.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
      )
      .sort((a, b) => (a.parent?.rawPosition ?? -1) - (b.parent?.rawPosition ?? -1) || a.rawPosition - b.rawPosition)
      .map((c) => ({ id: c.id, name: c.name, category: c.parent?.name ?? 'No category' }));
    res.json({
      guild: { name: guild.name, icon: guild.iconURL() },
      bot: { name: client.user.username, avatar: client.user.displayAvatarURL() },
      channels,
    });
  });

  app.post('/api/send', async (req, res) => {
    const { channelId, content, embed } = req.body ?? {};
    const guild = getGuild();
    const channel = guild?.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return res.status(400).json({ error: 'Invalid channel' });

    const payload = { allowedMentions: { parse: ['users', 'roles', 'everyone'] } };
    if (content?.trim()) payload.content = content.slice(0, 2000);

    if (embed && (embed.title?.trim() || embed.description?.trim())) {
      const e = new EmbedBuilder().setColor(parseInt(String(embed.color || '#7c5cff').replace('#', ''), 16) || config.color);
      if (embed.title?.trim()) e.setTitle(embed.title.slice(0, 256));
      if (embed.description?.trim()) e.setDescription(embed.description.slice(0, 4096));
      if (embed.image?.startsWith('http')) e.setImage(embed.image);
      if (embed.footer?.trim()) e.setFooter({ text: embed.footer.slice(0, 2048) });
      if (embed.timestamp) e.setTimestamp();
      payload.embeds = [e];
    }

    if (!payload.content && !payload.embeds) return res.status(400).json({ error: 'Message is empty' });

    try {
      const msg = await channel.send(payload);
      console.log(`📨 Panel message sent in #${channel.name}`);
      res.json({ ok: true, url: msg.url });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, host, () => console.log(`🌐 Web panel: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
};
