// "Accept the rules" button, posted from the web panel.
// Its customId is "rules_accept:<roleId>", so each rules message knows which role to give.
const { errorEmbed, successEmbed } = require('../utils');

const components = {
  async rules_accept(i) {
    const roleId = i.customId.split(':')[1];
    const role = i.guild.roles.cache.get(roleId);
    if (!role) return i.reply({ embeds: [errorEmbed('This role no longer exists. Please contact the staff.')], ephemeral: true });

    if (i.member.roles.cache.has(role.id)) {
      return i.reply({ embeds: [successEmbed('You already accepted the rules. Have fun! 🎮')], ephemeral: true });
    }

    try {
      await i.member.roles.add(role, 'Accepted the rules');
    } catch (err) {
      console.error('Rules role failed:', err.message);
      return i.reply({
        embeds: [errorEmbed("I couldn't give you the role. Please contact the staff.")],
        ephemeral: true,
      });
    }
    await i.reply({
      embeds: [successEmbed(`Thanks for accepting the rules! You now have the ${role} role. Welcome! 🎉`)],
      ephemeral: true,
    });
  },
};

module.exports = { commands: [], components };
