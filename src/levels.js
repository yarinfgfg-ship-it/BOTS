const fs = require('fs');
const { storePath } = require('./store');

const file = storePath('levels.json');

const COOLDOWN_MS = 45_000;
const XP_PER_MESSAGE = 15;
const COINS_PER_MESSAGE = 5;
const XP_PER_LEVEL = 750;

const empty = () => ({ guilds: {} });

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { guilds: data.guilds || {} };
  } catch {
    return empty();
  }
}

function save(data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function levelFromXp(xp) {
  return Math.floor((Number(xp) || 0) / XP_PER_LEVEL) + 1;
}

function progress(xp) {
  const current = (Number(xp) || 0) % XP_PER_LEVEL;
  return { current, need: XP_PER_LEVEL, pct: Math.round((current / XP_PER_LEVEL) * 100) };
}

function get(guildId, userId) {
  return load().guilds[guildId]?.[userId] || null;
}

function addMessage(guildId, userId) {
  const data = load();
  const guild = (data.guilds[guildId] ||= {});
  const entry = (guild[userId] ||= { xp: 0, coins: 0, messages: 0, lastXpAt: 0 });
  const now = Date.now();

  if (now - (entry.lastXpAt || 0) < COOLDOWN_MS) return null;

  const before = levelFromXp(entry.xp);
  entry.xp += XP_PER_MESSAGE;
  entry.coins += COINS_PER_MESSAGE;
  entry.messages += 1;
  entry.lastXpAt = now;
  const level = levelFromXp(entry.xp);

  save(data);
  return { entry: { ...entry }, level, leveledUp: level > before };
}

function top(guildId, limit = 10) {
  const guild = load().guilds[guildId] || {};
  return Object.entries(guild)
    .map(([userId, entry]) => ({ userId, ...entry, level: levelFromXp(entry.xp) }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

module.exports = {
  load,
  save,
  get,
  addMessage,
  top,
  levelFromXp,
  progress,
  XP_PER_LEVEL,
};
