const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('./config');

async function getTextChannel(guild, id) {
  if (!id) return null;
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return Boolean(config.staffRoleId && member.roles.cache.has(config.staffRoleId));
}

// --- Mod log ---------------------------------------------------------------
async function modLog(guild, { action, target, moderator, reason, color = 0xff5c5c }) {
  const channel = await getTextChannel(guild, config.modLogChannelId);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔨 ${action}`)
    .addFields(
      { name: 'User', value: `${target} (\`${target.id}\`)`, inline: true },
      { name: 'Moderator', value: `${moderator}`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided' },
    )
    .setTimestamp();
  await channel.send({ embeds: [embed] }).catch(console.error);
}

// --- Tiny JSON store (warnings) ---------------------------------------------
const warnsFile = path.join(config.dataDir, 'warns.json');

function readWarns() {
  try {
    return JSON.parse(fs.readFileSync(warnsFile, 'utf8'));
  } catch {
    return {};
  }
}

function addWarn(userId, warn) {
  const data = readWarns();
  (data[userId] ??= []).push(warn);
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(warnsFile, JSON.stringify(data, null, 2));
  return data[userId].length;
}

function getWarns(userId) {
  return readWarns()[userId] ?? [];
}

const errorEmbed = (text) => new EmbedBuilder().setColor(0xff5c5c).setDescription(`❌ ${text}`);
const successEmbed = (text) => new EmbedBuilder().setColor(0x4ade80).setDescription(`✅ ${text}`);

module.exports = { getTextChannel, isStaff, modLog, addWarn, getWarns, errorEmbed, successEmbed };
