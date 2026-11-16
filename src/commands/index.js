const moderation = require('./moderation');
const community = require('./community');
const tickets = require('./tickets');

const commands = [...moderation, ...community, ...tickets.commands];
const buttons = { ...tickets.buttons };

module.exports = { commands, buttons };
