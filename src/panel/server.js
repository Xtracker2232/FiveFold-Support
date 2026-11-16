const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../config');

const hash = (s) => crypto.createHash('sha256').update(String(s)).digest();
const checkPassword = (given) => crypto.timingSafeEqual(hash(given ?? ''), hash(config.panel.password));
const isUrl = (s) => typeof s === 'string' && /^https?:\/\/\S+$/i.test(s.trim());
const str = (s, max) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

function buildEmbed(e) {
  if (!e) return null;
  const embed = new EmbedBuilder();
  let hasContent = false;

  const author = str(e.author, 256);
  if (author) {
    embed.setAuthor({ name: author, iconURL: isUrl(e.authorIcon) ? e.authorIcon.trim() : undefined });
    hasContent = true;
  }
  const title = str(e.title, 256);
  if (title) {
    embed.setTitle(title);
    if (isUrl(e.url)) embed.setURL(e.url.trim());
    hasContent = true;
  }
  const description = str(e.description, 4096);
  if (description) {
    embed.setDescription(description);
    hasContent = true;
  }
  const fields = (Array.isArray(e.fields) ? e.fields : [])
    .slice(0, 25)
    .map((f) => ({ name: str(f.name, 256), value: str(f.value, 1024), inline: Boolean(f.inline) }))
    .filter((f) => f.name && f.value);
  if (fields.length) {
    embed.addFields(fields);
    hasContent = true;
  }
  if (isUrl(e.image)) {
    embed.setImage(e.image.trim());
    hasContent = true;
  }
  if (isUrl(e.thumbnail)) embed.setThumbnail(e.thumbnail.trim());
  const footer = str(e.footer, 2048);
  if (footer) embed.setFooter({ text: footer });
  if (e.timestamp) embed.setTimestamp();
  if (!hasContent) return null;

  const color = parseInt(String(e.color || '').replace('#', ''), 16);
  embed.setColor(Number.isNaN(color) ? config.color : color);
  return embed;
}

function buildButtons(list, extra) {
  const buttons = (Array.isArray(list) ? list : [])
    .filter((b) => str(b.label, 80) && isUrl(b.url))
    .map((b) => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(str(b.label, 80)).setURL(b.url.trim()));
  if (extra) buttons.unshift(extra);
  return buttons.length ? [new ActionRowBuilder().addComponents(buttons.slice(0, 5))] : [];
}

// "Accept the rules" button: gives the chosen role when clicked
function buildVerifyButton(guild, verify) {
  if (!verify?.enabled) return { button: null };
  const role = guild.roles.cache.get(String(verify.roleId));
  if (!role || role.managed || role.id === guild.id) return { error: 'Pick a valid role for the "Accept the rules" button' };
  if (role.position >= guild.members.me.roles.highest.position) {
    return { error: `Move the bot's role above "${role.name}" in Server Settings → Roles, or it can't give it` };
  }
  const button = new ButtonBuilder()
    .setCustomId(`rules_accept:${role.id}`)
    .setStyle(ButtonStyle.Success)
    .setLabel(str(verify.label, 80) || '✅ Accept the rules');
  return { button };
}

module.exports = function startPanel(client) {
  const { host, port, password } = config.panel;
  if (!password || password.startsWith('change-me')) {
    console.warn('⚠️  Web panel disabled: set a real PANEL_PASSWORD');
    return;
  }

  const history = []; // last messages sent from the panel (memory only)
  const app = express();
  app.use(express.json({ limit: '200kb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api', (req, res, next) => {
    if (!checkPassword(req.get('x-panel-password'))) return res.status(401).json({ error: 'Wrong password' });
    next();
  });

  const getGuild = () => client.guilds.cache.get(config.guildId);

  app.get('/api/info', (req, res) => {
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
      .map((c) => ({
        id: c.id,
        name: c.name,
        category: c.parent?.name ?? 'No category',
        announcement: c.type === ChannelType.GuildAnnouncement,
      }));

    const roles = guild.roles.cache
      .filter((r) => r.id !== guild.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));

    res.json({
      guild: { name: guild.name, icon: guild.iconURL(), members: guild.memberCount },
      bot: { name: client.user.username, avatar: client.user.displayAvatarURL(), ping: client.ws.ping },
      channels,
      roles,
      history,
    });
  });

  app.post('/api/send', async (req, res) => {
    const { channelId, content, embed, buttons, verify } = req.body ?? {};
    const guild = getGuild();
    const channel = guild?.channels.cache.get(channelId);
    if (!channel?.isTextBased()) return res.status(400).json({ error: 'Pick a valid channel' });
    const { button: verifyButton, error: verifyError } = buildVerifyButton(guild, verify);
    if (verifyError) return res.status(400).json({ error: verifyError });

    const payload = { allowedMentions: { parse: ['users', 'roles', 'everyone'] } };
    const text = str(content, 2000);
    if (text) payload.content = text;
    const builtEmbed = buildEmbed(embed);
    if (builtEmbed) payload.embeds = [builtEmbed];
    payload.components = buildButtons(buttons, verifyButton);

    if (!payload.content && !payload.embeds) return res.status(400).json({ error: 'The message is empty' });

    try {
      const msg = await channel.send(payload);
      history.unshift({
        channel: channel.name,
        preview: (text || builtEmbed?.data.title || builtEmbed?.data.description || 'Embed').slice(0, 90),
        url: msg.url,
        at: Date.now(),
      });
      history.length = Math.min(history.length, 20);
      console.log(`📨 Panel message sent in #${channel.name}`);
      res.json({ ok: true, url: msg.url, history });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, host, () => console.log(`🌐 Web panel: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`));
};
