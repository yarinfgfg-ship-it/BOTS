require('dotenv').config();
const fs = require('fs');

const token = process.env.DISCORD_TOKEN;
const channelId = '1572351677686616078';
const oldGuideId = '1572358913167327293';
const bannerPath = 'C:/Users/yyyya/discord-ticket-bot/assets/banner.png';
const photoPath = 'C:/Users/yyyya/Downloads/744f071c-8b3d-4955-9ff5-a2ac02c10fa9.png';

const guideEmbed = {
  title: '📘 מדריך הטיקטים — ברוכים הבאים!',
  description:
    'ברוכים הבאים! 👋 פותחים טיקט בלחיצה אחת, מקבלים ערוץ פרטי עם צוות התמיכה, וסוגרים כשצריך. הכל בעברית — בלי שם שרת.',
  color: 5793274,
  fields: [
    { name: '🎫 פותחים טיקט', value: 'לחצו על הכפתור למטה, בחרו **בדיקה** — ונוצר ערוץ `ticket-001`.', inline: false },
    { name: '👋 בתוך הטיקט', value: 'תקבלו הודעת ברוכים הבאים. כתבו כאן את הפנייה שלכם.', inline: false },
    { name: '🙋 צוות התמיכה', value: 'חבר צוות לוחץ על **תפוס טיקט** ומלווה אתכם עד לפתרון.', inline: false },
    { name: '🔒 סוגרים', value: '**סגור טיקט** → אישור → הערוץ נמחק והשיחה נשמרת כתמלול.', inline: false },
    { name: '⚠️ חשוב', value: 'ערוץ פרטי • טיקט אחד פתוח בכל פעם • בלי מידע רגיש.', inline: false },
  ],
  image: { url: 'attachment://banner.png' },
  footer: { text: '🎫 בוט טיקטים • בלי שם שרת' },
};

const photoEmbed = {
  color: 5793274,
  image: { url: 'attachment://ticket-photo.png' },
};

(async () => {
  const form = new FormData();
  form.append('payload_json', JSON.stringify({
    embeds: [guideEmbed, photoEmbed],
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 1,
        label: 'פתיחת טיקט',
        emoji: { name: '🎫' },
        custom_id: 'ticket_create',
      }],
    }],
    attachments: [
      { id: 0, filename: 'banner.png' },
      { id: 1, filename: 'ticket-photo.png' },
    ],
  }));
  form.append('files[0]', new Blob([fs.readFileSync(bannerPath)], { type: 'image/png' }), 'banner.png');
  form.append('files[1]', new Blob([fs.readFileSync(photoPath)], { type: 'image/png' }), 'ticket-photo.png');

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  console.log('POST combined message ->', res.status, json.id || JSON.stringify(json));

  if (json.id) {
    const del = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${oldGuideId}`,
      { method: 'DELETE', headers: { Authorization: `Bot ${token}` } }
    );
    console.log('DELETE old guide ->', del.status);
  }
})().catch((e) => { console.error(e); process.exit(1); });
