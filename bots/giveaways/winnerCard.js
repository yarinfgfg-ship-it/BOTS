const path = require('path');
const { createCanvas, GlobalFonts, loadImage } = require('@napi-rs/canvas');

const FONT = 'WinnerHebrew';
try {
  GlobalFonts.registerFromPath(path.join(__dirname, 'assets', 'NotoSansHebrew.ttf'), FONT);
} catch {
  /* fall back to a system font */
}

const W = 800;
const H = 450; // 16:9

function shorten(text, max) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// Forces a Latin name/prize to stay left-to-right inside Hebrew text.
function ltr(text) {
  return `\u2068${text}\u2069`;
}

async function buildWinnerCard({ avatarUrl, name, prize, reroll = false }) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111214';
  ctx.fillRect(0, 0, W, H);

  if (avatarUrl) {
    try {
      const res = await fetch(avatarUrl);
      if (res.ok) {
        const avatar = await loadImage(Buffer.from(await res.arrayBuffer()));
        const scale = Math.max(W / avatar.width, H / avatar.height);
        const aw = avatar.width * scale;
        const ah = avatar.height * scale;
        ctx.drawImage(avatar, (W - aw) / 2, (H - ah) / 2, aw, ah);
      }
    } catch {
      /* keep the plain background */
    }
  }

  const shade = ctx.createLinearGradient(0, 0, W, H);
  shade.addColorStop(0, 'rgba(8,8,10,0.86)');
  shade.addColorStop(1, 'rgba(8,8,10,0.55)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = '#FAA61A';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = `bold 44px ${FONT}`;
  ctx.fillStyle = '#FAA61A';
  ctx.fillText(reroll ? 'יש לנו זוכה חדש!' : 'יש לנו זוכה!', W / 2, 105);

  ctx.font = `bold 38px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`כל הכבוד @${ltr(shorten(name, 24))}`, W / 2, 210);

  ctx.font = `32px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`זכיתה ב ${ltr(shorten(prize, 46))}`, W / 2, 285);

  ctx.font = `24px ${FONT}`;
  ctx.fillStyle = '#c9ccd1';
  ctx.fillText('מזל טוב!', W / 2, 370);

  return canvas.toBuffer('image/png');
}

module.exports = { buildWinnerCard };
