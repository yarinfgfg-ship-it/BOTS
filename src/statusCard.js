const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const { joinLink, statusAccessText } = require('./serverStatus');

const FONT = 'StatusCardHebrew';
try {
  GlobalFonts.registerFromPath(
    path.join(__dirname, 'assets', 'NotoSansHebrew.ttf'),
    FONT
  );
} catch {
  /* fall back to a system font */
}

const W = 1200;
const H = 675;

function clean(text) {
  return String(text ?? '')
    .replace(/\^[\dA-Fa-f]/g, '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function shorten(text, max) {
  const value = clean(text);
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function rgba(hex, alpha) {
  const raw = String(hex || '#C3AE68').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function gradient(ctx, from, to) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawCover(ctx, img, x, y, w, h) {
  const iw = img.width;
  const ih = img.height;
  if (!iw || !ih) return;
  const target = w / h;
  const source = iw / ih;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;
  if (source > target) {
    sw = ih * target;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / target;
    sy = (ih - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

async function loadRemoteImage(url, timeoutMs = 6000) {
  if (!/^https?:\/\//i.test(String(url || ''))) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function compactUptime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days} יום`;
  if (hours) return `${hours} שע'`;
  if (minutes) return `${minutes} דק'`;
  return `${total} שנ'`;
}

function shortRelative(ms) {
  if (!ms || !Number.isFinite(Number(ms))) return '—';
  const diff = Math.max(0, Date.now() - Number(ms));
  if (diff < 60_000) return 'עכשיו';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `לפני ${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  return `לפני ${Math.floor(hours / 24)} יום`;
}

// Deterministic grain keeps the card photographic without flickering on refresh.
function drawGrain(ctx, accent) {
  let seed = 20261126;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.save();
  for (let i = 0; i < 1600; i += 1) {
    const x = next() * W;
    const y = next() * H;
    ctx.fillStyle = next() > 0.62 ? rgba(accent, 0.10) : 'rgba(255,255,255,0.035)';
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

function drawBackdrop(ctx, accent) {
  gradient(ctx, '#0B0B08', '#2A2216');

  ctx.save();
  ctx.translate(760, 330);
  ctx.rotate(-0.32);
  const streak = ctx.createLinearGradient(-520, 0, 520, 0);
  streak.addColorStop(0, rgba(accent, 0));
  streak.addColorStop(0.5, rgba(accent, 0.18));
  streak.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = streak;
  ctx.fillRect(-620, -520, 1240, 1040);
  ctx.restore();

  const glow = ctx.createRadialGradient(180, 520, 20, 180, 520, 520);
  glow.addColorStop(0, rgba(accent, 0.20));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  drawGrain(ctx, accent);
}

function drawVignette(ctx) {
  const v = ctx.createRadialGradient(W / 2, H / 2, 170, W / 2, H / 2, 760);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.52)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  drawGrain(ctx, '#ffffff');
}

function drawPlayerBar(ctx, right, y, players, maxPlayers, accent) {
  const segments = 10;
  const segW = 20;
  const gap = 6;
  const filled = maxPlayers
    ? Math.max(0, Math.min(segments, Math.round((players / maxPlayers) * segments)))
    : 0;
  for (let i = 0; i < segments; i += 1) {
    const sx = right - (segments - i) * (segW + gap) + gap;
    roundRect(ctx, sx, y, segW, 10, 5);
    ctx.fillStyle = i < filled ? accent : 'rgba(255,255,255,0.13)';
    ctx.fill();
  }
}

/**
 * Render a compact, photo-led FiveM status card as a PNG.
 * `/status-banner` supplies the hero photo; otherwise the Cfx icon is used,
 * and if that fails a canvas-only cinematic backdrop is drawn.
 */
async function buildStatusCard({ status, bannerUrl = '' }) {
  const accent = status.online ? '#C3AE68' : '#D86A5A';
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const customBanner = /^https?:\/\/\S+$/i.test(String(bannerUrl || '').trim());
  const iconUrl = `https://frontend.cfx-services.net/api/servers/icon/${encodeURIComponent(
    status.code
  )}/0.png`;
  const photo = await loadRemoteImage(
    customBanner ? String(bannerUrl).trim() : iconUrl
  );

  if (photo) {
    drawCover(ctx, photo, 0, 0, W, H);
    const shade = ctx.createLinearGradient(0, 0, W, H);
    shade.addColorStop(0, 'rgba(8,7,4,0.94)');
    shade.addColorStop(0.48, 'rgba(8,7,4,0.74)');
    shade.addColorStop(1, 'rgba(8,7,4,0.48)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
  } else {
    drawBackdrop(ctx, accent);
  }
  drawVignette(ctx);

  // Thin rail + restrained frame.
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 10, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, W - 36, H - 36);

  ctx.textBaseline = 'middle';

  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.font = `bold 19px ${FONT}`;
  ctx.fillStyle = rgba(accent, 0.95);
  ctx.fillText('N E W   L I F E   R P', 66, 74);

  const state = status.online ? 'אונליין' : 'אופליין';
  ctx.font = `bold 26px ${FONT}`;
  const pillW = Math.max(158, ctx.measureText(state).width + 78);
  roundRect(ctx, W - 66 - pillW, 48, pillW, 54, 27);
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.55);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W - 66 - pillW + 30, 75, 8, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(state, W - 86, 76);

  ctx.font = `bold 58px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(shorten(status.name || 'New Life RP', 28), W - 66, 186);

  const visibleLink = `cfx.re/join/${status.code}`;
  ctx.direction = 'ltr';
  ctx.textAlign = 'right';
  ctx.font = `bold 27px ${FONT}`;
  const linkW = Math.max(330, ctx.measureText(visibleLink).width + 52);
  roundRect(ctx, W - 66 - linkW, 232, linkW, 56, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.5);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f4e4b8';
  ctx.fillText(visibleLink, W - 92, 260);

  // Three cells only — short labels, no map/mode clutter.
  roundRect(ctx, 66, 328, W - 132, 232, 26);
  ctx.fillStyle = 'rgba(6,10,18,0.70)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const divider = (x) => {
    ctx.beginPath();
    ctx.moveTo(x, 354);
    ctx.lineTo(x, 534);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
  };
  divider(740);
  divider(400);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';

  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = '#b7a98a';
  ctx.fillText('שחקנים', 1090, 378);
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(status.online ? `${status.players} / ${status.maxPlayers || '—'}` : '—', 1090, 432);
  drawPlayerBar(ctx, 1090, 478, status.players || 0, status.maxPlayers || 0, accent);

  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = '#b7a98a';
  ctx.fillText('גישה', 700, 378);
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(statusAccessText(status), 700, 434);

  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = '#b7a98a';
  ctx.fillText('זמן פעילות', 360, 378);
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(status.online ? compactUptime(status.uptimeMs) : '—', 360, 434);

  ctx.font = `20px ${FONT}`;
  ctx.fillStyle = '#9c8e70';
  ctx.fillText(`נראה לאחרונה · ${shortRelative(status.lastSeenMs)}`, W - 66, 610);

  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.font = `bold 18px ${FONT}`;
  ctx.fillStyle = rgba(accent, 0.85);
  ctx.fillText(`• ${status.code}`, 66, 610);

  return canvas.toBuffer('image/png');
}

module.exports = { buildStatusCard, W, H };
