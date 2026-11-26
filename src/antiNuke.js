const fs = require('fs');
const { AuditLogEvent, ChannelType, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { storePath } = require('./store');

const STATE_FILE = storePath('anti-nuke.json');
const DEFAULT_THRESHOLD = 5;
const DEFAULT_WINDOW_MS = 30_000;
const ALERT_COOLDOWN_MS = 10 * 60 * 1000;
const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const RISKY_EVENTS = new Set([
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.WebhookCreate,
  AuditLogEvent.WebhookDelete,
  AuditLogEvent.ChannelOverwriteDelete,
  AuditLogEvent.EmojiDelete,
  AuditLogEvent.StickerDelete,
]);

function load() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

function save(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[anti-nuke] save failed:', err.message);
  }
}

function get(guildId) {
  const all = load();
  return {
    enabled: true,
    threshold: DEFAULT_THRESHOLD,
    windowMs: DEFAULT_WINDOW_MS,
    logChannelId: null,
    lastAuditId: null,
    lastAlertAt: 0,
    snapshot: null,
    ...(all[guildId] || {}),
  };
}

function set(guildId, patch) {
  const all = load();
  all[guildId] = { ...get(guildId), ...patch };
  save(all);
  return all[guildId];
}

function roleData(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    mentionable: role.mentionable,
    position: role.position,
    permissions: role.permissions.bitfield.toString(),
    unicodeEmoji: role.unicodeEmoji || null,
    managed: role.managed,
  };
}

function channelData(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId || null,
    position: channel.position ?? 0,
    topic: channel.topic || null,
    nsfw: Boolean(channel.nsfw),
    bitrate: channel.bitrate || null,
    userLimit: channel.userLimit || null,
    permissionOverwrites: [...channel.permissionOverwrites.cache.values()].map((o) => ({
      id: o.id,
      type: o.type,
      allow: o.allow.bitfield.toString(),
      deny: o.deny.bitfield.toString(),
    })),
  };
}

function snapshot(guild) {
  const roles = [...guild.roles.cache.values()]
    .filter((r) => r.id !== guild.id && !r.managed)
    .map(roleData);
  const channels = [...guild.channels.cache.values()]
    .filter((ch) =>
      [
        ChannelType.GuildText,
        ChannelType.GuildNews,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
        ChannelType.GuildCategory,
        ChannelType.GuildForum,
      ].includes(ch.type)
    )
    .map(channelData);
  return { roles, channels, takenAt: new Date().toISOString() };
}

function ensureSnapshot(guild) {
  const cfg = get(guild.id);
  const age = cfg.snapshot?.takenAt ? Date.now() - Date.parse(cfg.snapshot.takenAt) : Infinity;
  if (Number.isFinite(age) && age <= SNAPSHOT_MAX_AGE_MS) return false;
  set(guild.id, { snapshot: snapshot(guild) });
  return true;
}

function mapId(id, roleMap) {
  return roleMap.get(id) || id;
}

async function restore(guild, saved) {
  if (!saved) return { roles: 0, channels: 0, fixedPermissions: 0 };
  const result = { roles: 0, channels: 0, fixedPermissions: 0 };
  const roleMap = new Map();

  // Recreate deleted roles first, then reuse their new IDs for overwrites.
  for (const r of saved.roles || []) {
    if (guild.roles.cache.has(r.id) || guild.roles.cache.some((x) => x.name === r.name)) continue;
    try {
      const created = await guild.roles.create({
        name: r.name,
        color: r.color,
        hoist: Boolean(r.hoist),
        mentionable: Boolean(r.mentionable),
        position: r.position || 0,
        permissions: r.permissions || PermissionFlagsBits.ViewChannel.toString(),
        unicodeEmoji: r.unicodeEmoji || null,
        reason: 'Anti-nuke automatic restore',
      });
      roleMap.set(r.id, created.id);
      result.roles++;
    } catch (err) {
      console.error(`[anti-nuke] role restore ${r.name}:`, err.message);
    }
  }

  // Repair permission changes on roles that still exist.
  for (const r of saved.roles || []) {
    const role = guild.roles.cache.get(roleMap.get(r.id) || r.id);
    if (!role || role.id === guild.id) continue;
    if (role.permissions.bitfield.toString() !== String(r.permissions)) {
      try {
        await role.edit({
          permissions: r.permissions,
          reason: 'Anti-nuke permission restore',
        });
        result.fixedPermissions++;
      } catch {
        /* missing permission or hierarchy */
      }
    }
  }

  // Categories first so child channels can be parented correctly.
  const savedChannels = [...(saved.channels || [])].sort(
    (a, b) => (b.type === ChannelType.GuildCategory) - (a.type === ChannelType.GuildCategory)
  );
  const channelMap = new Map();

  for (const ch of savedChannels) {
    if (guild.channels.cache.has(ch.id)) continue;
    const parent = ch.parentId ? mapId(ch.parentId, channelMap) : undefined;
    const overwrites = (ch.permissionOverwrites || [])
      .map((o) => ({
        id: mapId(o.id, roleMap),
        type: o.type,
        allow: o.allow,
        deny: o.deny,
      }))
      .filter((o) => o.id && (o.type === 0 || o.type === 1));
    try {
      const created = await guild.channels.create({
        name: ch.name,
        type: ch.type,
        parent,
        topic: ch.topic || undefined,
        nsfw: Boolean(ch.nsfw),
        bitrate: ch.bitrate || undefined,
        userLimit: ch.userLimit || undefined,
        permissionOverwrites: overwrites,
        reason: 'Anti-nuke automatic restore',
      });
      channelMap.set(ch.id, created.id);
      result.channels++;
      try {
        if (ch.position) await created.setPosition(ch.position);
      } catch {
        /* position is cosmetic */
      }
    } catch (err) {
      console.error(`[anti-nuke] channel restore ${ch.name}:`, err.message);
    }
  }

  return result;
}

function isRiskyEntry(entry) {
  if (RISKY_EVENTS.has(entry.action)) return true;
  if (entry.action === AuditLogEvent.RoleUpdate || entry.action === AuditLogEvent.ChannelUpdate) {
    return (entry.changes || []).some(
      (change) => change.key === 'permissions' || change.key === 'permission_overwrites'
    );
  }
  return false;
}

function alertEmbed(guild, attacker, counts, restored) {
  const summary = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => `${name}: ${count}`)
    .join('\n');

  return new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('🛡️ זוהתה מתקפת nuke — השרת שוחזר')
    .setDescription(
      `**תוקף:** ${attacker ? `<@${attacker.id}> (\`${attacker.tag || attacker.id}\`)` : 'לא ידוע'}\n` +
        `**פעולות חשודות:** ${Object.values(counts).reduce((a, b) => a + b, 0)}\n` +
        `**שוחזרו:** ${restored.roles} תפקידים, ${restored.channels} ערוצים, ${restored.fixedPermissions} הרשאות`
    )
    .addFields({ name: 'פירוט', value: summary || '—' })
    .setFooter({ text: `Anti-nuke • ${guild.name}` })
    .setTimestamp();
}

async function tick(client, ignoreUserIds = []) {
  const ignored = new Set(ignoreUserIds);
  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = get(guild.id);
      if (!cfg.enabled) continue;

      const logs = await guild.fetchAuditLogs({ limit: 50 }).catch(() => null);
      const entries = logs?.entries ? [...logs.entries.values()] : [];
      if (!entries.length) continue;

      const idx = cfg.lastAuditId ? entries.findIndex((e) => e.id === cfg.lastAuditId) : -1;
      const fresh = idx === -1
        ? entries.filter((e) => Date.now() - e.createdTimestamp <= cfg.windowMs)
        : entries.slice(0, idx);

      const counts = new Map();
      const now = Date.now();
      for (const entry of fresh) {
        const executor = entry.executor;
        if (!executor || ignored.has(executor.id)) continue;
        if (now - entry.createdTimestamp > cfg.windowMs) continue;
        if (!isRiskyEntry(entry)) continue;
        const key = `${entry.action}:${executor.id}`;
        const cur = counts.get(key) || { executor, action: entry.action, count: 0 };
        cur.count++;
        counts.set(key, cur);
      }

      set(guild.id, { lastAuditId: entries[0].id });

      const attack = [...counts.values()]
        .filter((x) => x.count >= cfg.threshold)
        .sort((a, b) => b.count - a.count)[0];
      if (!attack) continue;
      if (now - (cfg.lastAlertAt || 0) < ALERT_COOLDOWN_MS) continue;

      set(guild.id, { lastAlertAt: now });
      const restored = await restore(guild, cfg.snapshot);
      const names = {
        [AuditLogEvent.ChannelDelete]: 'מחיקת ערוצים',
        [AuditLogEvent.RoleDelete]: 'מחיקת תפקידים',
        [AuditLogEvent.MemberBanAdd]: 'הרחקות',
        [AuditLogEvent.WebhookCreate]: 'יצירת וובהוקים',
        [AuditLogEvent.WebhookDelete]: 'מחיקת וובהוקים',
        [AuditLogEvent.RoleUpdate]: 'שינוי הרשאות',
        [AuditLogEvent.ChannelUpdate]: 'שינוי ערוצים',
        [AuditLogEvent.ChannelOverwriteDelete]: 'מחיקת הרשאות ערוץ',
        [AuditLogEvent.EmojiDelete]: 'מחיקת אימוג׳ים',
        [AuditLogEvent.StickerDelete]: 'מחיקת סטיקרים',
      };
      const byAction = {};
      for (const item of counts.values()) {
        const label = names[item.action] || `פעולה ${item.action}`;
        byAction[label] = (byAction[label] || 0) + item.count;
      }

      const embed = alertEmbed(guild, attack.executor, byAction, restored);
      const channel =
        (cfg.logChannelId && (await guild.channels.fetch(cfg.logChannelId).catch(() => null))) ||
        guild.systemChannel;
      if (channel?.isTextBased()) await channel.send({ embeds: [embed] }).catch(() => {});
      console.log(
        `[anti-nuke] ${guild.id}: ${attack.count} risky actions by ${attack.executor.id}; restored ${JSON.stringify(restored)}`
      );
    } catch (err) {
      console.error(`[anti-nuke] ${guild.id}:`, err.message);
    }
  }
}

module.exports = {
  DEFAULT_THRESHOLD,
  DEFAULT_WINDOW_MS,
  get,
  set,
  snapshot,
  ensureSnapshot,
  restore,
  tick,
};
