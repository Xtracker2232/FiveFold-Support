const fs = require('node:fs');
const path = require('node:path');
const { EmbedBuilder } = require('discord.js');
const config = require('./config');

// --- Mod log ---------------------------------------------------------------
async function modLog(guild, { action, target, moderator, reason, color = 0xff5c5c }) {
  if (!config.modLogChannelId) return;
  const channel = await guild.channels.fetch(config.modLogChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
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
const dataDir = config.dataDir;
const warnsFile = path.join(dataDir, 'warns.json');

function readWarns() {
  try {
    return JSON.parse(fs.readFileSync(warnsFile, 'utf8'));
  } catch {
    return {};
  }
}

function writeWarns(data) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(warnsFile, JSON.stringify(data, null, 2));
}

function addWarn(userId, warn) {
  const data = readWarns();
  (data[userId] ??= []).push(warn);
  writeWarns(data);
  return data[userId].length;
}

function getWarns(userId) {
  return readWarns()[userId] ?? [];
}

function errorEmbed(text) {
  return new EmbedBuilder().setColor(0xff5c5c).setDescription(`❌ ${text}`);
}

function successEmbed(text) {
  return new EmbedBuilder().setColor(0x4ade80).setDescription(`✅ ${text}`);
}

module.exports = { modLog, addWarn, getWarns, errorEmbed, successEmbed };
