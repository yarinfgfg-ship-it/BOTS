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

async function buildWelcomeCard({ avatarUrl, name, guildName, memberCount }) {
  const W = 900;
  const H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  gradient(ctx, W, H, '#161327', '#3b2a63');
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.arc(90 + i * 110, 430, 90, 0, Math.PI * 2);
    ctx.fill();
  }

  const avatar = await loadAvatar(avatarUrl);
  circleAvatar(ctx, avatar, W / 2 - 85, 35, 170, '#7c5cff');

  centered(ctx, 'ברוך הבא!', 258, `bold 52px ${FONT}`, '#ffffff', W);
  centered(ctx, `@${ltr(shorten(name, 26))}`, 325, `bold 34px ${FONT}`, '#c9b8ff', W);
  centered(
    ctx,
    `חבר מספר ${ltr(shorten(String(memberCount), 8))}`,
    380,
    `28px ${FONT}`,
    '#e8e4ff',
    W
  );
  centered(ctx, `ב־${ltr(shorten(guildName || 'השרת', 40))}`, 435, `24px ${FONT}`, '#b9b2cc', W);

  ctx.strokeStyle = '#7c5cff';
  ctx.lineWidth = 5;
  ctx.strokeRect(3, 3, W - 6, H - 6);

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

async function buildTicketPanelCard({ title, categories = [] }) {
  // Clean editorial card. Text stays plain Hebrew and short on purpose —
  // no English eyebrow, no long truncated description, no neon glow.
  const W = 1200;
  const H = 675;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#eef1f7';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.shadowColor = 'rgba(17,24,39,0.10)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  rounded(ctx, 54, 48, 1092, 579, 28);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  rounded(ctx, 1122, 48, 24, 579, 12);
  ctx.fillStyle = '#4f6bed';
  ctx.fill();

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = '#4f6bed';
  ctx.fillText('מערכת התמיכה', 1080, 112);

  ctx.font = `bold 50px ${FONT}`;
  ctx.fillStyle = '#111827';
  ctx.fillText(shorten(plain(title || 'צריכים עזרה? פתחו טיקט'), 34), 1080, 184);

  ctx.font = `28px ${FONT}`;
  ctx.fillStyle = '#596273';
  ctx.fillText('בחרו סוג פנייה — ערוץ פרטי ייפתח מיד.', 1080, 246);

  ctx.beginPath();
  ctx.moveTo(96, 300);
  ctx.lineTo(1080, 300);
  ctx.strokeStyle = '#e5e9f2';
  ctx.lineWidth = 2;
  ctx.stroke();

  const labels = categories
    .slice(0, 4)
    .map((category) =>
      shorten(plain(typeof category === 'string' ? category : category.label || ''), 24)
    )
    .filter(Boolean);
  const chips = labels.length
    ? labels
    : ['שאלה כללית', 'רכישה בשרת', 'מועמדות לצוות', 'ערעור על עונש'];

  const chipW = 470;
  const chipH = 78;
  chips.slice(0, 4).forEach((label, index) => {
    const x = index % 2 === 0 ? 610 : 110;
    const y = 338 + Math.floor(index / 2) * (chipH + 22);
    rounded(ctx, x, y, chipW, chipH, 16);
    ctx.fillStyle = '#f4f6ff';
    ctx.fill();
    ctx.strokeStyle = '#dde4ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    rounded(ctx, x + chipW - 58, y + 21, 14, 36, 7);
    ctx.fillStyle = '#4f6bed';
    ctx.fill();
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.font = `bold 25px ${FONT}`;
    ctx.fillStyle = '#1f2a44';
    ctx.fillText(label, x + chipW - 84, y + 39);
  });

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.font = `22px ${FONT}`;
  ctx.fillStyle = '#7a8293';
  ctx.fillText('הצוות כאן כדי לעזור.', 1080, 590);

  return canvas.toBuffer('image/png');
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
