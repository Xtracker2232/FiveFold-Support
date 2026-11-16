// Each module exports { commands, components }.
// components = handlers for buttons / select menus, keyed by customId.
const modules = [
  { commands: require('./moderation') },
  require('./community'),
  require('./tickets'),
  require('./info'),
];

const commands = modules.flatMap((m) => m.commands);
const components = Object.assign({}, ...modules.map((m) => m.components ?? {}));

module.exports = { commands, components };
