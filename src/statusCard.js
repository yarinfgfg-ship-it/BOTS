const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');
const { formatUptime, joinLink, statusAccessText } = require('./serverStatus');

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
  const raw = String(hex || '#2ECC71').replace('#', '');
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

function relativeTime(ms) {
  if (!ms || !Number.isFinite(Number(ms))) return '—';
  const diff = Math.max(0, Date.now() - Number(ms));
  if (diff < 60_000) return 'עכשיו';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `לפני ${minutes} ${minutes === 1 ? 'דקה' : 'דקות'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} ${hours === 1 ? 'שעה' : 'שעות'}`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ${days === 1 ? 'יום' : 'ימים'}`;
}

function drawBackdrop(ctx, accent) {
  gradient(ctx, '#0c1020', '#1b1330');

  const glow = ctx.createRadialGradient(W - 170, 110, 20, W - 170, 110, 520);
  glow.addColorStop(0, rgba(accent, 0.34));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(255,255,255,0.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawPlayerBar(ctx, x, y, players, maxPlayers, accent) {
  const segments = 10;
  const segW = 22;
  const gap = 6;
  const filled = maxPlayers
    ? Math.max(0, Math.min(segments, Math.round((players / maxPlayers) * segments)))
    : 0;
  for (let i = 0; i < segments; i += 1) {
    const sx = x + i * (segW + gap);
    roundRect(ctx, sx, y, segW, 12, 6);
    ctx.fillStyle = i < filled ? accent : 'rgba(255,255,255,0.14)';
    ctx.fill();
  }
}

/**
 * Render the public FiveM status card as a PNG "photo" card.
 * The supplied banner becomes the full background photo; without one the
 * server icon is used, and if that fails a canvas-only backdrop is drawn.
 */
async function buildStatusCard({ status, bannerUrl = '' }) {
  const accent = status.online ? '#2ECC71' : '#E74C3C';
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
    shade.addColorStop(0, 'rgba(7,10,18,0.93)');
    shade.addColorStop(0.55, 'rgba(7,10,18,0.78)');
    shade.addColorStop(1, 'rgba(7,10,18,0.58)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
  } else {
    drawBackdrop(ctx, accent);
  }

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 14);
  ctx.strokeStyle = rgba(accent, 0.9);
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  // Top strip: English tag on the left, Hebrew state on the right.
  ctx.textBaseline = 'middle';
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillStyle = rgba(accent, 0.95);
  ctx.fillText('FIVEM STATUS', 70, 82);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.font = `bold 52px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(status.online ? 'השרת אונליין' : 'השרת אופליין', W - 70, 112);

  ctx.font = `bold 44px ${FONT}`;
  ctx.fillStyle = '#f4f6ff';
  ctx.fillText(shorten(status.name || 'New Life RP', 44), W - 70, 192);

  const link = joinLink(status.code);
  const visibleLink = `cfx.re/join/${status.code}`;
  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.font = `bold 29px ${FONT}`;
  const linkW = Math.max(360, ctx.measureText(visibleLink).width + 48);
  roundRect(ctx, 70, 228, linkW, 58, 18);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fill();
  ctx.strokeStyle = rgba(accent, 0.55);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#d9e6ff';
  ctx.fillText(visibleLink, 94, 258);

  // Four stat columns, laid out right-to-left for Hebrew readers.
  roundRect(ctx, 70, 318, W - 140, 232, 24);
  ctx.fillStyle = 'rgba(8,12,22,0.74)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const columns = [
    {
      x: 905,
      label: 'שחקנים',
      value: status.online
        ? `${status.players} / ${status.maxPlayers || '—'}`
        : '—',
      big: true,
    },
    {
      x: 660,
      label: 'גישה',
      value: statusAccessText(status),
      big: false,
    },
    {
      x: 415,
      label: 'זמן פעילות',
      value: status.online ? formatUptime(status.uptimeMs) : '—',
      big: false,
    },
    {
      x: 170,
      label: 'נראה לאחרונה',
      value: relativeTime(status.lastSeenMs),
      big: false,
    },
  ];

  for (const col of columns) {
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.font = `24px ${FONT}`;
    ctx.fillStyle = '#9aa6c4';
    ctx.fillText(col.label, col.x, 368);
    ctx.font = `${col.big ? 'bold 40px' : 'bold 29px'} ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(shorten(col.value, col.big ? 22 : 24), col.x, 425);
  }

  drawPlayerBar(
    ctx,
    905 - 10 * 28 + 6,
    480,
    status.players || 0,
    status.maxPlayers || 0,
    accent
  );

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = '#91a0c0';
  ctx.fillText(`בדיקת סטטוס • ${status.code}`, W - 70, 614);

  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillStyle = rgba(accent, 0.9);
  ctx.fillText('LIVE • NEW LIFE RP', 70, 614);

  return canvas.toBuffer('image/png');
}

module.exports = { buildStatusCard, W, H };
