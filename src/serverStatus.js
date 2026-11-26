const fs = require('fs');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { storePath } = require('./store');

// The FiveM join code the bot reports by default.
const DEFAULT_STATUS_CODE = 'a4xxqgk';
const STATE_FILE = storePath('server-status.json');
const CFX_API = 'https://frontend.cfx-services.net/api/servers/single/';
// The browser API can lag when nobody is browsing the server. A direct
// dynamic.json probe is the real online check; this is only a fallback.
const CFX_FRESH_MS = 2 * 60 * 1000;

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[status] could not save uptime state:', err.message);
  }
}

function isTrue(value) {
  return String(value ?? '').toLowerCase() === 'true';
}

function unit(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function formatUptime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts = [];
  if (days) parts.push(unit(days, 'יום', 'ימים'));
  if (hours) parts.push(unit(hours, 'שעה', 'שעות'));
  if (minutes) parts.push(unit(minutes, 'דקה', 'דקות'));
  if (!days && !hours) parts.push(unit(seconds, 'שנייה', 'שניות'));
  return parts.join(' ') || 'פחות משנייה';
}

function cleanCode(input) {
  const raw = String(input || '')
    .trim()
    .replace(/^https?:\/\/(?:www\.)?cfx\.re\/join\//i, '')
    .replace(/^\/+|\/+$/g, '');
  return raw.slice(0, 64) || DEFAULT_STATUS_CODE;
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'DiscordBot/NewLifeRP-Status',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function dynamicUrl(endpoint) {
  const ep = String(endpoint || '').trim();
  // Only host:port from the Cfx metadata — never an arbitrary URL.
  if (!/^[A-Za-z0-9.-]+:\d{2,5}$/.test(ep)) return null;
  return `http://${ep}/dynamic.json`;
}

/**
 * Fetch the public FiveM metadata plus a direct dynamic.json probe.
 * Sensitive fields from the response (for example sv_licenseKeyToken) are
 * deliberately never copied into the returned object or the Discord embed.
 */
async function getServerStatus(input = DEFAULT_STATUS_CODE) {
  const code = cleanCode(input);

  let cfx = null;
  try {
    const json = await fetchJson(`${CFX_API}${encodeURIComponent(code)}`);
    cfx = json?.Data || null;
    if (!cfx) throw new Error('missing Data');
  } catch {
    cfx = null;
  }

  const lastSeenMs = cfx?.lastSeen ? Date.parse(cfx.lastSeen) : NaN;
  const cfxFresh = Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs <= CFX_FRESH_MS;

  // Direct probe is authoritative: the browser API can be stale when the
  // server has zero players and nobody has opened the server list recently.
  let direct = null;
  const endpoints = Array.isArray(cfx?.connectEndPoints) ? cfx.connectEndPoints : [];
  for (const endpoint of endpoints.slice(0, 3)) {
    const url = dynamicUrl(endpoint);
    if (!url) continue;
    try {
      const probe = await fetchJson(url, 5000);
      if (probe && Number.isFinite(Number(probe.clients))) {
        direct = probe;
        break;
      }
    } catch {
      direct = null;
    }
  }

  const directOk = Boolean(direct);
  const online = directOk || cfxFresh;
  const playersRaw = Number(
    directOk ? direct.clients : cfx?.clients ?? cfx?.selfReportedClients
  );
  const maxRaw = Number(
    directOk ? direct.sv_maxclients : cfx?.sv_maxclients ?? cfx?.vars?.sv_maxClients
  );

  const cfxName = String(cfx?.hostname || cfx?.vars?.sv_projectName || '').trim();
  const directName = String(direct?.hostname || '').trim();
  const name =
    (cfxName && cfxName.toLowerCase() !== 'default fxserver') ||
    (!directName && cfxName)
      ? cfxName
      : directName || cfxName || 'New Life RP';

  const adminOnly = cfx
    ? isTrue(cfx.vars?.sv_appearAllowlisted) ||
      isTrue(cfx.vars?.sv_adminsOnly) ||
      isTrue(cfx.private)
    : null;

  const state = readState();
  const now = Date.now();
  let uptimeMs = null;
  if (online) {
    const prev = state[code];
    if (!prev || prev.online === false || !Number.isFinite(prev.firstSeen)) {
      state[code] = { online: true, firstSeen: now, lastCheck: now };
    } else {
      prev.online = true;
      prev.lastCheck = now;
    }
    uptimeMs = now - state[code].firstSeen;
  } else {
    state[code] = {
      online: false,
      firstSeen: state[code]?.firstSeen ?? null,
      lastCheck: now,
    };
  }
  writeState(state);

  return {
    code,
    online,
    name,
    players: online && Number.isFinite(playersRaw) ? Math.max(0, playersRaw) : 0,
    maxPlayers: Number.isFinite(maxRaw) ? Math.max(0, maxRaw) : 0,
    map: String((directOk ? direct?.mapname : cfx?.mapname) || '').trim(),
    mode: String((directOk ? direct?.gametype : cfx?.gametype) || '').trim(),
    adminOnly,
    uptimeMs,
    lastSeenMs: Number.isFinite(lastSeenMs) ? lastSeenMs : null,
  };
}

function joinLink(code) {
  return `https://cfx.re/join/${encodeURIComponent(code)}`;
}

function playerBar(players, maxPlayers) {
  if (!maxPlayers) return '';
  const total = 10;
  const filled = Math.max(0, Math.min(total, Math.round((players / maxPlayers) * total)));
  return `\n\`[${'█'.repeat(filled)}${'░'.repeat(total - filled)}]\``;
}

function statusAccessText(status) {
  if (!status.online) return '—';
  if (status.adminOnly === null) return 'לא ידוע';
  return status.adminOnly ? 'רק מורשים / אדמין' : 'לא — פתוח לכולם';
}

// Live text card — no canvas photo, no banner attachment. The status is a
// real Discord embed, so player counts, uptime, links and buttons stay live.
function buildStatusEmbed(status) {
  const dash = '—';
  const join = joinLink(status.code);
  const access = statusAccessText(status);
  const players = status.online
    ? `${status.players} / ${status.maxPlayers || dash}` +
      playerBar(status.players, status.maxPlayers)
    : dash;

  const embed = new EmbedBuilder()
    .setColor(status.online ? '#2ECC71' : '#E74C3C')
    .setTitle(status.name || `FiveM • ${status.code}`)
    .setURL(join)
    .setDescription(
      [
        `${status.online ? '🟢' : '🔴'} **${status.online ? 'השרת פעיל' : 'השרת לא פעיל'}**`,
        `🎮 קוד הצטרפות: \`${status.code}\``,
        `🔗 [cfx.re/join/${status.code}](${join})`,
        status.online ? '' : '⚠️ השרת לא זוהה כרגע בשרתוני FiveM.',
      ]
        .filter(Boolean)
        .join('\n')
    )
    .addFields(
      { name: '👥 שחקנים', value: players, inline: false },
      { name: '🔐 גישה', value: access, inline: true },
      {
        name: '⏱️ זמן פעילות',
        value: status.online ? formatUptime(status.uptimeMs) : dash,
        inline: true,
      },
      {
        name: '🕒 נראה לאחרונה',
        value: status.lastSeenMs
          ? `<t:${Math.floor(status.lastSeenMs / 1000)}:R>`
          : dash,
        inline: true,
      }
    )
    .setFooter({ text: `New Life RP • ${status.code}` })
    .setTimestamp();

  return embed;
}

function buildStatusComponents(code) {
  const join = joinLink(code);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('status_copy_link')
      .setLabel('📋 העתק קישור')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setLabel('🚀 הצטרפות לשרת')
      .setStyle(ButtonStyle.Link)
      .setURL(join)
  );
}

module.exports = {
  DEFAULT_STATUS_CODE,
  cleanCode,
  formatUptime,
  getServerStatus,
  buildStatusEmbed,
  buildStatusComponents,
  statusAccessText,
  joinLink,
};
