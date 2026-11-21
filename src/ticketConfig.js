const fs = require('fs');
const { storePath } = require('./store');

const file = storePath('tickets.json');

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

function get(channelId) {
  return load()[channelId] || {};
}

function set(channelId, values) {
  const all = load();
  all[channelId] = { ...(all[channelId] || {}), ...values };
  save(all);
  return all[channelId];
}

function remove(channelId) {
  const all = load();
  if (all[channelId]) {
    delete all[channelId];
    save(all);
  }
}

module.exports = { load, save, get, set, remove };
