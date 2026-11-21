const fs = require('fs');
const { storePath } = require('./store');

const file = storePath('guilds.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function get(guildId, fallback = {}) {
  const all = load();
  return { ...fallback, ...(all[guildId] || {}) };
}

function set(guildId, values) {
  const all = load();
  all[guildId] = { ...(all[guildId] || {}), ...values };
  save(all);
  return all[guildId];
}

module.exports = { load, save, get, set };
