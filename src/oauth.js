const fs = require('fs');
const { storePath } = require('./store');

// OAuth2 tokens are per-user (global), not per-server, so this store is
// keyed by Discord user id — unlike profiles.json which is guild-scoped.
const file = storePath('oauth.json');

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

function get(userId) {
  return load()[String(userId)] || null;
}

function set(userId, data) {
  const all = load();
  const k = String(userId);
  all[k] = { ...(all[k] || {}), ...data };
  save(all);
  return all[k];
}

function list() {
  return Object.entries(load()).map(([userId, value]) => ({ userId, ...value }));
}

function remove(userId) {
  const all = load();
  delete all[String(userId)];
  save(all);
}

module.exports = { load, save, get, set, list, remove };
