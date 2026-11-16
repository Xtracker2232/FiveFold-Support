// Each module exports { commands, components }.
// components = handlers for buttons / select menus, keyed by customId
// (the part before ":" — e.g. "rules_accept:123" is handled by "rules_accept").
const modules = [
  { commands: require('./moderation') },
  require('./community'),
  require('./tickets'),
  require('./info'),
  require('./rules'),
];

const commands = modules.flatMap((m) => m.commands);
const components = Object.assign({}, ...modules.map((m) => m.components ?? {}));

module.exports = { commands, components };
