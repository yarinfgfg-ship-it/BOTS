const fs = require('fs');
const { storePath } = require('./store');

// One lifecycle log message per ticket, keyed by guild + padded ticket number.
// The record survives restarts so a rating sent hours later updates the same
// log message instead of creating a second, incomplete one.
const file = storePath('ticket-logs.json');

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

function key(guildId, number) {
  return `${guildId}:${number}`;
}

function get(guildId, number) {
  return load()[key(guildId, number)] || null;
}

function set(guildId, number, values) {
  const all = load();
  const k = key(guildId, number);
  all[k] = { ...(all[k] || {}), ...values };
  save(all);
  return all[k];
}

function remove(guildId, number) {
  const all = load();
  const k = key(guildId, number);
  if (all[k]) {
    delete all[k];
    save(all);
  }
}

module.exports = { load, save, get, set, remove, key };
