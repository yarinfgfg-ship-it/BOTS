const fs = require('fs');
const { storePath } = require('./store');

const file = storePath('suggestions.json');

const empty = () => ({ settings: {}, suggestions: {}, polls: {} });

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      settings: data.settings || {},
      suggestions: data.suggestions || {},
      polls: data.polls || {},
    };
  } catch {
    return empty();
  }
}

function save(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function get(id) {
  const data = load();
  return {
    suggestion: data.suggestions[id] || null,
    poll: data.polls[id] || null,
  };
}

function update(kind, id, values) {
  const data = load();
  const bucket = data[kind];
  if (!bucket) return null;
  bucket[id] = { ...(bucket[id] || {}), ...values };
  save(data);
  return bucket[id];
}

function setting(guildId) {
  return load().settings[guildId] || null;
}

function setSetting(guildId, values) {
  const data = load();
  data.settings[guildId] = { ...(data.settings[guildId] || {}), ...values };
  save(data);
  return data.settings[guildId];
}

module.exports = { load, save, get, update, setting, setSetting, file };
