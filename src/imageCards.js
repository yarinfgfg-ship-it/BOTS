const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const FONT = 'CommunityCardHebrew';
try {
  GlobalFonts.registerFromPath(
    path.join(__dirname, 'assets', 'NotoSansHebrew.ttf'),
    FONT
  );
} catch {
  /* fall back to a system font */
}

function ltr(text) {
  return `\u2068${String(text ?? '')}\u2069`;
}

function rtl(text) {
  return `\u2067${String(text ?? '')}\u2069`;
}

// Isolate mixed text with the right base direction. Hebrew server names must
// not be wrapped in an LTR isolate — that renders them backwards.
function auto(text) {
  const s = String(text ?? '');
  return /[\u0590-\u05FF]/.test(s) ? rtl(s) : ltr(s);
}

function shorten(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

async function loadAvatar(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

// Cover-fit an image into a box without stretching it.
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

// Accepts a Buffer, a local file path or an http(s) URL.
async function loadSource(src) {
  if (!src) return null;
  try {
    if (Buffer.isBuffer(src)) return await loadImage(src);
    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return null;
      return await loadImage(Buffer.from(await res.arrayBuffer()));
    }
    return await loadImage(src);
  } catch {
    return null;
  }
}

function gradient(ctx, w, h, from, to) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function circleAvatar(ctx, img, x, y, size, ring) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  if (img) ctx.drawImage(img, x, y, size, size);
  else {
    ctx.fillStyle = '#2b2d38';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();
  if (ring) {
    ctx.lineWidth = 6;
    ctx.strokeStyle = ring;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function centered(ctx, text, y, font, color, w) {
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, y);
}

// Reference-style welcome card. The member's photo sits small on the left of
// the text; the wide banner uses the image chosen with /welcome-card banner.
async function buildWelcomeCard({
  avatarUrl,
  name,
  guildName,
  memberCount,
  guildIconUrl,
  cardText = {},
  bannerUrl,
  bannerBuffer,
}) {
  const W = 860;
  const H = 611;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const text = (key, fallback) => plain(cardText[key] ?? fallback);

  ctx.fillStyle = '#1A1A1E';
  ctx.fillRect(0, 0, W, H);

  const cardX = 64;
  const cardY = 21;
  const cardW = 732;
  const cardH = 569;
  const left = cardX + 18;
  const right = cardX + cardW - 18;

  rounded(ctx, cardX, cardY, cardW, cardH, 6);
  ctx.fillStyle = '#242429';
  ctx.fill();

  rounded(ctx, cardX, cardY + 1, 6, cardH - 2, 3);
  ctx.fillStyle = '#0099FF';
  ctx.fill();

  ctx.textBaseline = 'middle';

  // Small member photo, to the left of the greeting.
  const avatarSize = 64;
  const avatarX = left;
  const avatarY = 38;
  const memberPhoto = await loadSource(avatarUrl);
  rounded(ctx, avatarX, avatarY, avatarSize, avatarSize, 10);
  ctx.save();
  ctx.clip();
  if (memberPhoto) {
    drawCover(ctx, memberPhoto, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = '#2b2d38';
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  rounded(ctx, avatarX, avatarY, avatarSize, avatarSize, 10);
  ctx.stroke();

  const textX = avatarX + avatarSize + 16;
  ctx.direction = 'rtl';
  ctx.textAlign = 'left';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillStyle = '#FBFBFB';
  ctx.fillText(shorten(text('greeting', 'ברוך הבא!'), 28), textX, 58);
  ctx.font = `18px ${FONT}`;
  ctx.fillStyle = '#ABACB2';
  ctx.fillText(auto(shorten(guildName || 'השרת', 34)), textX, 92);

  // Server icon (falls back to the first letter on a Discord-pink tile).
  const iconSize = 96;
  const iconX = right - iconSize;
  const iconY = 38;
  const guildIcon = await loadSource(guildIconUrl);
  rounded(ctx, iconX, iconY, iconSize, iconSize, 10);
  ctx.save();
  ctx.clip();
  if (guildIcon) {
    drawCover(ctx, guildIcon, iconX, iconY, iconSize, iconSize);
  } else {
    ctx.fillStyle = '#EB459F';
    ctx.fillRect(iconX, iconY, iconSize, iconSize);
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.font = `bold 44px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(
      auto(String(guildName || 'S').trim().charAt(0).toUpperCase()),
      iconX + iconSize / 2,
      iconY + iconSize / 2 + 2
    );
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  rounded(ctx, iconX, iconY, iconSize, iconSize, 10);
  ctx.stroke();

  ctx.fillStyle = '#3B3B41';
  ctx.fillRect(left, 142, right - left, 1);

  const hello = text('hello', 'שלום');
  ctx.direction = 'rtl';
  ctx.textAlign = 'left';
  ctx.font = `19px ${FONT}`;
  ctx.fillStyle = '#FBFBFB';
  ctx.fillText(shorten(hello, 18), left, 172);

  const mention = `@${shorten(name || 'member', 24)}`;
  ctx.direction = 'ltr';
  ctx.font = `bold 18px ${FONT}`;
  const helloWidth = ctx.measureText(hello).width;
  const pillW = Math.max(150, ctx.measureText(mention).width + 36);
  const pillX = left + Math.max(44, Math.ceil(helloWidth) + 16);
  const pillY = 156;
  const pillH = 30;
  rounded(ctx, pillX, pillY, pillW, pillH, 7);
  ctx.fillStyle = '#303359';
  ctx.fill();
  ctx.fillStyle = '#A9BBFF';
  ctx.fillText(ltr(mention), pillX + 18, pillY + pillH / 2 + 1);

  ctx.direction = 'rtl';
  ctx.textAlign = 'left';
  ctx.font = `19px ${FONT}`;
  ctx.fillStyle = '#EFEFF1';
  ctx.fillText(shorten(text('line1', 'שמחים שהצטרפת לשרת'), 60), left, 216);
  ctx.fillText(shorten(text('line2', `אתה החבר מספר ${memberCount || 0} בקהילה`), 60), left, 250);

  ctx.fillStyle = '#3B3B41';
  ctx.fillRect(left, 282, right - left, 1);

  // Chosen banner; falls back to the member's photo until one is set.
  const photoX = left;
  const photoY = 296;
  const photoW = right - left;
  const photoH = 244;
  const banner = await loadSource(bannerBuffer || bannerUrl || avatarUrl);
  rounded(ctx, photoX, photoY, photoW, photoH, 6);
  ctx.save();
  ctx.clip();
  if (banner) {
    drawCover(ctx, banner, photoX, photoY, photoW, photoH);
  } else {
    ctx.fillStyle = '#2b2d38';
    ctx.fillRect(photoX, photoY, photoW, photoH);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  rounded(ctx, photoX, photoY, photoW, photoH, 6);
  ctx.stroke();

  ctx.direction = 'rtl';
  ctx.textAlign = 'left';
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = '#ABACB2';
  ctx.fillText(auto(shorten(text('footer', guildName || 'השרת'), 70)), left, 580);

  return canvas.toBuffer('image/png');
}

async function buildProfileCard({
  avatarUrl,
  name,
  level,
  xp,
  coins,
  messages,
  joinedAt,
}) {
  const W = 900;
  const H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  gradient(ctx, W, H, '#101322', '#232b4d');
  ctx.strokeStyle = '#5865F2';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  const avatar = await loadAvatar(avatarUrl);
  circleAvatar(ctx, avatar, 60, 95, 230, '#5865F2');

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillStyle = '#8fa4ff';
  ctx.fillText('כרטיס שחקן', 830, 62);

  ctx.font = `bold 46px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(shorten(name, 22), 830, 135);

  ctx.font = `30px ${FONT}`;
  ctx.fillStyle = '#c9ccd1';
  ctx.fillText(`רמה ${ltr(level)}  ·  ${shorten(messages, 8)} הודעות`, 830, 200);

  const pct = Math.min(100, Math.max(0, Math.round((xp % 750) / 7.5)));
  ctx.fillStyle = '#2a2f45';
  ctx.fillRect(60, 370, 780, 26);
  ctx.fillStyle = '#57F287';
  ctx.fillRect(60, 370, Math.round((780 * pct) / 100), 26);
  ctx.font = `20px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${pct}% עד רמה ${ltr(Number(level) + 1)}`, 830, 357);

  const boxes = [
    { label: 'ניסיון', value: xp, color: '#5865F2' },
    { label: 'מטבעות', value: coins, color: '#FAA61A' },
    { label: 'הצטרף', value: joinedAt || '—', color: '#57F287' },
  ];
  const bw = 246;
  boxes.forEach((box, i) => {
    const x = 60 + i * (bw + 21);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, 415, bw, 58);
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.font = `20px ${FONT}`;
    ctx.fillStyle = '#a9adbb';
    ctx.fillText(box.label, x + bw / 2, 432);
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillStyle = box.color;
    ctx.fillText(ltr(shorten(String(box.value), 18)), x + bw / 2, 460);
  });

  return canvas.toBuffer('image/png');
}

async function buildLevelUpCard({ avatarUrl, name, level }) {
  const W = 800;
  const H = 450;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  gradient(ctx, W, H, '#1b1030', '#4b2d7a');
  const colors = ['#FAA61A', '#57F287', '#5865F2', '#ED4245', '#ffffff'];
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = colors[i % colors.length];
    const x = (i * 137) % W;
    const y = (i * 83) % H;
    ctx.fillRect(x, y, 8, 8);
  }

  const avatar = await loadAvatar(avatarUrl);
  circleAvatar(ctx, avatar, W / 2 - 65, 30, 130, '#FAA61A');

  centered(ctx, 'עלית רמה!', 205, `bold 50px ${FONT}`, '#FAA61A', W);
  centered(ctx, `@${ltr(shorten(name, 24))}`, 265, `bold 32px ${FONT}`, '#ffffff', W);
  centered(ctx, `רמה ${ltr(level)}`, 340, `bold 40px ${FONT}`, '#57F287', W);
  centered(ctx, 'כל הכבוד, תמשיך ככה!', 400, `24px ${FONT}`, '#c9b8ff', W);

  ctx.strokeStyle = '#FAA61A';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  return canvas.toBuffer('image/png');
}

async function buildLeaderboardCard({ guildName, entries }) {
  const W = 900;
  const H = 640;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  gradient(ctx, W, H, '#0f1220', '#263056');
  ctx.strokeStyle = '#FAA61A';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  centered(ctx, 'טבלת האלופים', 62, `bold 44px ${FONT}`, '#FAA61A', W);
  ctx.fillStyle = '#FAA61A';
  ctx.fillRect(W / 2 - 130, 92, 260, 3);
  centered(ctx, ltr(shorten(guildName || 'השרת', 40)), 112, `24px ${FONT}`, '#b9b2cc', W);

  const order = [1, 0, 2]; // second, first, third
  const positions = [
    { x: 60, y: 330, size: 150, place: 2, color: '#c0c7d4' },
    { x: 330, y: 250, size: 200, place: 1, color: '#FAA61A' },
    { x: 600, y: 365, size: 130, place: 3, color: '#cd7f32' },
  ];

  for (let i = 0; i < order.length; i += 1) {
    const idx = order[i];
    const entry = entries[idx];
    const p = positions[i];
    if (!entry) continue;
    const avatar = await loadAvatar(entry.avatarUrl);
    circleAvatar(ctx, avatar, p.x + (p.size ? (200 - p.size) / 2 : 0), p.y, p.size || 150, p.color);
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.font = `bold 28px ${FONT}`;
    ctx.fillStyle = p.color;
    ctx.fillText(`מקום ${ltr(p.place)} · ${ltr(shorten(entry.name, 16))}`, p.x + 100, p.y + (p.size || 150) + 35);
    ctx.font = `22px ${FONT}`;
    ctx.fillStyle = '#e8e4ff';
    ctx.fillText(`רמה ${ltr(entry.level)} · ${ltr(entry.xp)} XP`, p.x + 100, p.y + (p.size || 150) + 70);
  }

  if (!entries.length) centered(ctx, 'אין עדיין נתונים', 320, `30px ${FONT}`, '#c9ccd1', W);

  return canvas.toBuffer('image/png');
}

// ---------------------------------------------------------------------------
// Matching panel cards — same layout for tickets and verification.
// ---------------------------------------------------------------------------

// Canvas fonts have no emoji glyphs, so keep panel text emoji-free.
function plain(text) {
  return String(text ?? '')
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/[\u2600-\u27BF]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function rgba(hex, alpha) {
  const raw = String(hex || '#5865F2').replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16) || 0;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPanelIcon(ctx, kind, cx, cy, accent) {
  ctx.save();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 7;
  if (kind === 'ticket') {
    rounded(ctx, cx - 52, cy - 34, 104, 68, 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 34);
    ctx.lineTo(cx - 12, cy + 34);
    ctx.moveTo(cx + 12, cy - 34);
    ctx.lineTo(cx + 12, cy + 34);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + 2);
    ctx.lineTo(cx - 5, cy + 18);
    ctx.lineTo(cx + 22, cy - 18);
    ctx.stroke();
  }
  ctx.restore();
}

async function buildPanelCard({ kind, title, description, items = [], accent, eyebrow, caption }) {
  const W = 1200;
  const H = 675;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  gradient(ctx, W, H, '#0f1224', '#241a3d');

  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let i = 0; i < 6; i += 1) {
    ctx.beginPath();
    ctx.arc(80 + i * 230, 640, 150, 0, Math.PI * 2);
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(W - 150, 140, 10, W - 150, 140, 430);
  glow.addColorStop(0, rgba(accent, 0.26));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 14);
  ctx.strokeStyle = rgba(accent, 0.85);
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  drawPanelIcon(ctx, kind, W - 150, 150, accent);

  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = rgba(accent, 0.95);
  ctx.fillText(eyebrow, 70, 76);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.font = `bold 58px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(shorten(plain(title), 58), W - 70, 250);

  ctx.font = `29px ${FONT}`;
  ctx.fillStyle = '#cbd0e8';
  ctx.fillText(shorten(plain(description), 110), W - 70, 322);

  let x = W - 70;
  let y = 420;
  ctx.lineWidth = 2;
  for (const raw of items.slice(0, 4)) {
    const label = shorten(plain(raw), 26);
    if (!label) continue;
    ctx.font = `bold 25px ${FONT}`;
    const width = Math.max(170, ctx.measureText(label).width + 60);
    if (x - width < 60) {
      x = W - 70;
      y += 88;
    }
    rounded(ctx, x - width, y, width, 60, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.strokeStyle = rgba(accent, 0.5);
    ctx.stroke();
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4f5ff';
    ctx.fillText(label, x - width / 2, y + 30);
    x -= width + 16;
  }

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.font = `23px ${FONT}`;
  ctx.fillStyle = '#9aa3c7';
  ctx.fillText(caption, W - 70, H - 58);

  return canvas.toBuffer('image/png');
}

async function buildTicketPanelCard({ title, description, categories = [] }) {
  return buildPanelCard({
    kind: 'ticket',
    title,
    description,
    items: categories.slice(0, 4),
    accent: '#7c8cff',
    eyebrow: 'TICKET SYSTEM',
    caption: 'בחרו סוג פנייה מהרשימה למטה כדי לפתוח טיקט',
  });
}

async function buildVerifyPanelCard({ title, description }) {
  return buildPanelCard({
    kind: 'verify',
    title,
    description,
    items: ['לחצו על הכפתור הירוק', 'תפקיד מאומת יימסר לכם', 'התפקיד הלא מאומת יוסר'],
    accent: '#57F287',
    eyebrow: 'ONE-CLICK VERIFY',
    caption: 'אימות מהיר ולחיצה אחת — בלי אתר ובלי קישור',
  });
}

module.exports = {
  buildWelcomeCard,
  buildProfileCard,
  buildLevelUpCard,
  buildLeaderboardCard,
  buildTicketPanelCard,
  buildVerifyPanelCard,
};
