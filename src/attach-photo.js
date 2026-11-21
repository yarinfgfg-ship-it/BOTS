require('dotenv').config();
const fs = require('fs');

const token = process.env.DISCORD_TOKEN;
const channelId = '1572351677686616078';
const guideId = '1572358913167327293';
const photoPath = 'C:/Users/yyyya/Downloads/744f071c-8b3d-4955-9ff5-a2ac02c10fa9.png';

(async () => {
  // Get the current guide message so we keep its embeds, components, and button.
  const get = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${guideId}`,
    { headers: { Authorization: `Bot ${token}` } }
  );
  const msg = await get.json();
  if (!msg.id) throw new Error('Could not fetch guide message: ' + JSON.stringify(msg));

  const embeds = msg.embeds.map((e) => ({
    title: e.title,
    description: e.description,
    color: e.color,
    fields: e.fields,
    footer: e.footer,
    timestamp: e.timestamp,
    image: e.image,
    thumbnail: e.thumbnail,
  }));

  embeds.push({
    title: '🎫 בוט טיקטים',
    description: 'התמונה של מערכת הטיקטים שלנו',
    color: 5793274,
    image: { url: 'attachment://ticket-photo.png' },
  });

  const form = new FormData();
  form.append('payload_json', JSON.stringify({
    embeds,
    components: msg.components,
    attachments: [{ id: 0, filename: 'ticket-photo.png' }],
  }));
  form.append(
    'files[0]',
    new Blob([fs.readFileSync(photoPath)], { type: 'image/png' }),
    'ticket-photo.png'
  );

  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${guideId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bot ${token}` },
      body: form,
    }
  );
  const json = await res.json().catch(() => ({}));
  console.log('PATCH guide with photo ->', res.status, json.id || JSON.stringify(json));
})().catch((e) => { console.error(e); process.exit(1); });
