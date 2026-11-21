require('dotenv').config();

const http = require('http');
const fs = require('fs');
const profiles = require('./profiles');
const oauth = require('./oauth');
const { storePath } = require('./store');

// Local IP verification records (used instead of Supabase in the simple setup).
const verificationFile = storePath('verifications.json');

function recordVerification(userId, guildId, ip) {
  let all = {};
  try {
    all = JSON.parse(fs.readFileSync(verificationFile, 'utf8'));
  } catch {
    all = {};
  }
  all[`${userId}:${guildId || 'global'}`] = {
    userId,
    guildId: guildId || 'global',
    ip,
    verifiedAt: new Date().toISOString(),
  };
  fs.writeFileSync(verificationFile, JSON.stringify(all, null, 2));
}

const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';
// Render injects PORT and routes traffic there; locally we fall back to 3000.
const PORT = Number(process.env.PORT || process.env.OAUTH_PORT || 3000);

// Everything only works once the secret + redirect URI are configured.
function enabled() {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

// The button/link sends the user here. `state` carries the guild so the
// callback can save the profile and (re)assign the verified role there.
function authorizeUrl(guildId, userId) {
  const state = `${guildId || ''}:${userId || ''}`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.join',
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function tokenRequest(params) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    ...params,
  });
  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OAuth token request failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

const exchangeCode = (code) =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });

const refreshToken = (token) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: token });

function saveOAuthProfile(guildId, u) {
  if (!guildId) return;
  profiles.set(guildId, u.id, {
    username: u.username,
    globalName: u.global_name || null,
    avatar: u.avatar
      ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}?size=256`
      : null,
    banner: u.banner
      ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner}?size=512`
      : null,
    accentColor: u.accent_color || null,
    verifiedAt: new Date().toISOString(),
  });
}

function htmlPage(title, message, ok) {
  const color = ok ? '#57F287' : '#ED4245';
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>${title}</title><style>
body{font-family:Arial,sans-serif;background:#313338;color:#f2f3f5;display:flex;
align-items:center;justify-content:center;height:100vh;margin:0}
.card{background:#2b2d31;padding:32px;border-radius:12px;max-width:480px;text-align:center;
border-top:5px solid ${color}} h1{margin:0 0 12px;font-size:22px}
p{line-height:1.6;color:#b5bac1}</style></head><body><div class="card">
<h1>${title}</h1><p>${message}</p>
<p style="font-size:13px">אפשר לסגור את החלון ולחזור לדיסקורד.</p>
</div></body></html>`;
}

// onAuthorized(user, guildId, userId) lets index.js use the live Discord client
// (e.g. re-apply the verified role) without this module needing a bot token.
function start(onAuthorized) {
  // The HTTP server also serves /health for hosting, so it must run even when
  // OAuth is not configured. Only the /callback route needs the secret.
  if (!enabled()) {
    console.warn('[oauth] CLIENT_SECRET not set — OAuth callback disabled, health check still active.');
  }

  const server = http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      res.writeHead(400);
      return res.end('Bad request');
    }

    // Health check for hosting / uptime monitors.
    if (url.pathname === '/health' || url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('ok');
    }

    // Build marker — lets us confirm which version the host is running.
    if (url.pathname === '/version') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('cards-v4-2026-11-22');
    }

    if (url.pathname !== '/callback') {
      res.writeHead(404);
      return res.end('Not found');
    }

    if (!enabled()) {
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(htmlPage('אימות לא מוגדר', 'CLIENT_SECRET לא הוגדר בשרת.', false));
    }

    const code = url.searchParams.get('code');
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(htmlPage('שגיאה', 'לא התקבל קוד אימות. נסו שוב מהפאנל.', false));
    }

    const state = url.searchParams.get('state') || '';
    const [guildId, userId] = state.split(':');

    try {
      const tokens = await exchangeCode(code);

      // Identify lets us read the profile even when the user is outside the guild.
      const meRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const me = await meRes.json();

      oauth.set(me.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        expiresAt: Date.now() + (tokens.expires_in || 604800) * 1000,
        scope: tokens.scope || '',
        username: me.username,
        globalName: me.global_name || null,
        guildId: guildId || null,
        authorizedAt: new Date().toISOString(),
      });

      const forwarded = String(req.headers['x-forwarded-for'] || '');
      const ip = forwarded.split(',')[0].trim() || String(req.socket?.remoteAddress || '');
      recordVerification(me.id, guildId || 'global', ip);

      saveOAuthProfile(guildId, me);
      if (onAuthorized) await onAuthorized(me, guildId, userId);

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        htmlPage(
          'האימות הושלם ✅',
          'ההרשאה נשמרה. מעכשיו אפשר להוסיף אותך לשרתים בעזרת הפקודה.',
          true
        )
      );
    } catch (err) {
      console.error('[oauth]', err.message);
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        htmlPage(
          'שגיאה',
          'האימות נכשל. ודאו שה־redirect URI רשום בפורטל המפתחים וש־CLIENT_SECRET נכון.',
          false
        )
      );
    }
  });

  server.listen(PORT, () => {
    console.log(`[oauth] Callback server ready at ${REDIRECT_URI}`);
  });
  server.on('error', (err) => console.error('[oauth] server:', err.message));
  return server;
}

module.exports = {
  enabled,
  authorizeUrl,
  exchangeCode,
  refreshToken,
  start,
  REDIRECT_URI,
};
