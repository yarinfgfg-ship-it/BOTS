const fs = require('fs');
const { storePath } = require('./store');

const file = storePath('profiles.json');

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

function key(guildId, userId) {
  return `${guildId}:${userId}`;
}

function set(guildId, userId, data) {
  const all = load();
  const k = key(guildId, userId);
  all[k] = { ...(all[k] || {}), ...data };
  save(all);
  return all[k];
}

function get(guildId, userId) {
  return load()[key(guildId, userId)] || null;
}

function list(guildId) {
  return Object.entries(load())
    .filter(([k]) => k.startsWith(`${guildId}:`))
    .map(([k, v]) => ({ userId: k.split(':')[1], ...v }));
}

module.exports = { load, save, set, get, list };
