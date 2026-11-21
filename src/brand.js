require('dotenv').config();
const fs = require('fs');

const token = process.env.DISCORD_TOKEN;
const channelId = '1572351677686616078';
const bannerPath = 'C:/Users/yyyya/discord-ticket-bot/assets/banner.png';
const headers = { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };

async function api(path, options = {}) {
  const res = await fetch(`https://discord.com/api/v10${path}`, { ...options, headers });
  const json = await res.json().catch(() => ({}));
  console.log(`${options.method || 'GET'} ${path} -> ${res.status}`, json.id || json.username || '');
  return json;
}

(async () => {
  const base64 = fs.readFileSync(bannerPath).toString('base64');

  // Set bot avatar
  await api('/users/@me', {
    method: 'PATCH',
    body: JSON.stringify({ avatar: `data:image/png;base64,${base64}` }),
  });

  // Post banner + nice embed in #general
  const embed = {
    title: '🎫 בוט טיקטים — מערכת התמיכה שלכם',
    description:
      'ברוכים הבאים למערכת הטיקטים החדשה 👋\n\n' +
      'לחצו על **פתיחת טיקט** בהודעת הפאנל, בחרו **בדיקה**, ותקבלו ערוץ פרטי עם הודעת פתיחה מסודרת. כשאתם מסיימים — **סגור טיקט** מוחק את הערוץ ושומר תמלול.\n\n' +
      'הכל בעברית. בלי שם שרת. פשוט עובד.',
    color: 5793274,
    image: { url: 'attachment://banner.png' },
    footer: { text: 'בוט טיקטים' },
  };

  const form = new FormData();
  form.append('payload_json', JSON.stringify({
    embeds: [embed],
    attachments: [{ id: 0, filename: 'banner.png' }],
  }));
  form.append('files[0]', new Blob([fs.readFileSync(bannerPath)], { type: 'image/png' }), 'banner.png');

  const upload = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}` },
    body: form,
  });
  const json = await upload.json().catch(() => ({}));
  console.log('POST banner message ->', upload.status, json.id || JSON.stringify(json));
})().catch((e) => { console.error(e); process.exit(1); });
