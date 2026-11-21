require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const channelId = '1572351677686616078';
const guideId = '1572358913167327293';

(async () => {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${guideId}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: 'פתיחת טיקט',
                emoji: { name: '🎫' },
                custom_id: 'ticket_create',
              },
            ],
          },
        ],
      }),
    }
  );

  const json = await res.json().catch(() => ({}));
  console.log('PATCH guide message ->', res.status, json.id || JSON.stringify(json));
})().catch((e) => { console.error(e); process.exit(1); });
