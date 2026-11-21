const fs = require('fs');
const { storePath } = require('./store');

const file = storePath('giveaways.json');

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

function all() {
  return load();
}

function get(id) {
  return load()[id] || null;
}

function set(id, values) {
  const data = load();
  data[id] = { ...(data[id] || {}), ...values };
  save(data);
  return data[id];
}

function remove(id) {
  const data = load();
  delete data[id];
  save(data);
}

module.exports = { load, save, all, get, set, remove };
