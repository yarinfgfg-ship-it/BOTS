const config = require('../config');
const guildConfig = require('./guildConfig');

// Discord itself is the only durable storage on a free host. The verify role
// ID is written into the verify channel topic, so it survives full redeploys
// that wipe the container filesystem.
const MARKER_PREFIX = 'discord-ticket-bot verifyRole=';
const MARKER_RE = /discord-ticket-bot\s+verifyRole=(\d{17,20})/i;
const BANNER_PREFIX = 'discord-ticket-bot statusBanner=';
const BANNER_RE = /discord-ticket-bot\s+statusBanner=(\S+)/i;

function uniqueNonEmpty(values) {
  return [...new Set(values.filter((v) => typeof v === 'string' && v.trim()))];
}

function topicWithMarker(topic, roleId) {
  const kept = String(topic || '')
    .replace(MARKER_RE, '')
    .trim();
  return [kept, `${MARKER_PREFIX}${roleId}`].filter(Boolean).join('\n');
}

async function saved(guildId) {
  return guildConfig.get(guildId);
}

async function fetchRole(guild, roleId) {
  if (!roleId || !guild?.roles) return null;
  return (
    guild.roles.cache?.get(roleId) ||
    (await guild.roles.fetch(roleId).catch(() => null))
  );
}

async function allRoles(guild) {
  if (!guild?.roles) return [];
  const cached = guild.roles.cache ? [...guild.roles.cache.values()] : [];
  if (cached.length) return cached;
  const fetched = await guild.roles.fetch().catch(() => null);
  return fetched ? [...fetched.values()] : cached;
}

async function allChannels(guild) {
  if (!guild?.channels) return [];
  const cached = [...(guild.channels.cache?.values() || [])];
  if (cached.length) return cached;
  const fetched = await guild.channels.fetch().catch(() => null);
  return fetched ? [...fetched.values()] : cached;
}

async function findMarkedRole(guild) {
  for (const channel of await allChannels(guild)) {
    const match = MARKER_RE.exec(channel.topic || '');
    if (!match) continue;
    const role = await fetchRole(guild, match[1]);
    if (role) return { role, channel };
  }
  return null;
}

async function findNamedRole(guild, names) {
  const wanted = uniqueNonEmpty(names);
  if (!wanted.length) return null;
  const roles = await allRoles(guild);
  for (const name of wanted) {
    const role = roles.find((r) => r.name === name);
    if (role) return role;
  }
  return null;
}

// Save the chosen role in both places: fast local JSON + Discord channel topic.
async function rememberVerifyRole(guild, role, preferredChannel) {
  if (!guild?.id || !role?.id) return saved(guild?.id || '');

  guildConfig.set(guild.id, {
    verifyRoleId: role.id,
    verifyRoleName: role.name,
  });

  const channels = await allChannels(guild);
  const marked = channels.find((ch) => MARKER_RE.test(ch.topic || ''));
  const byName =
    preferredChannel ||
    channels.find((ch) => /verify|אימות/i.test(ch.name || '') && ch.isTextBased?.());
  const target = marked || byName;

  if (target?.edit) {
    const nextTopic = topicWithMarker(target.topic, role.id);
    if (nextTopic !== (target.topic || '')) {
      await target
        .edit({ topic: nextTopic }, 'Persist verification role')
        .catch((err) => console.error('[verify-role] topic marker:', err.message));
    }
  }

  return saved(guild.id);
}

// Resolve the verification role from durable Discord state first. This repairs
// the "no verify role configured" error after a container filesystem wipe.
async function ensureVerifyRole(guild) {
  if (!guild?.id || !guild.roles) return saved(guild?.id || '');

  const marked = await findMarkedRole(guild);
  if (marked) return rememberVerifyRole(guild, marked.role, marked.channel);

  const current = await saved(guild.id);
  const byId = await fetchRole(guild, current.verifyRoleId);
  if (byId) return rememberVerifyRole(guild, byId, null);

  const byName = await findNamedRole(guild, [
    current.verifyRoleName,
    config.verify.roleName,
  ]);
  if (byName) return rememberVerifyRole(guild, byName, null);

  // Only create a role when this guild was actually set up for verification.
  if (!current.verifyRoleId && !current.verifyChannelId) return current;

  try {
    const created = await guild.roles.create({
      name: config.verify.roleName,
      color: config.verify.roleColor,
      reason: 'Verification role restore',
    });
    return rememberVerifyRole(guild, created, null);
  } catch (err) {
    console.error(`[verify-role] ${guild.id}: role restore failed: ${err.message}`);
    return saved(guild.id);
  }
}

// The status banner is stored in the same durable channel topic so a full
// redeploy cannot lose it either.
async function findStatusBanner(guild) {
  if (!guild?.id) return null;
  for (const channel of await allChannels(guild)) {
    const match = BANNER_RE.exec(channel.topic || '');
    if (match) return match[1];
  }
  return null;
}

async function rememberStatusBanner(guild, url, preferredChannel) {
  if (!guild?.id) return;
  guildConfig.set(guild.id, { statusBannerUrl: url || null });

  const channels = await allChannels(guild);
  const marked = channels.find(
    (ch) => MARKER_RE.test(ch.topic || '') || BANNER_RE.test(ch.topic || '')
  );
  const target =
    marked ||
    preferredChannel ||
    channels.find(
      (ch) => /status|סטטוס|verify|אימות/i.test(ch.name || '') && ch.isTextBased?.()
    );
  if (!target?.edit) return;

  const kept = String(target.topic || '')
    .replace(BANNER_RE, '')
    .trim();
  const next = url
    ? [kept, `${BANNER_PREFIX}${url}`].filter(Boolean).join('\n')
    : kept;
  if (next !== (target.topic || '')) {
    await target
      .edit({ topic: next }, 'Persist status banner')
      .catch((err) => console.error('[status-banner] topic marker:', err.message));
  }
}

module.exports = {
  MARKER_PREFIX,
  BANNER_PREFIX,
  ensureVerifyRole,
  rememberVerifyRole,
  rememberStatusBanner,
  findStatusBanner,
  topicWithMarker,
};
