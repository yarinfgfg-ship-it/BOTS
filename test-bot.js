// A single, legitimate test bot account.
// Put its token in .env.test as TEST_BOT_TOKEN=..., then run: node test-bot.js
require('dotenv').config({ path: '.env.test' });

const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, REST } = require('discord.js');

const token = process.env.TEST_BOT_TOKEN;
if (!token) {
  console.error('❌ Add TEST_BOT_TOKEN to .env.test first.');
  process.exit(1);
}

const NAMES = [
  'Alex Rivera',
  'Jordan Lee',
  'Sam Carter',
  'Taylor Brooks',
  'Morgan Davis',
  'Casey Wilson',
];
const name = process.env.TEST_BOT_NAME || NAMES[Math.floor(Math.random() * NAMES.length)];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ Test bot online: ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.patch('/users/@me', { body: { username: name } });
    console.log('   name:', name);

    const avatarPath = path.join(__dirname, 'test-bot-avatar.png');
    if (fs.existsSync(avatarPath)) {
      const data = `data:image/png;base64,${fs.readFileSync(avatarPath).toString('base64')}`;
      await rest.patch('/users/@me', { body: { avatar: data } });
      console.log('   avatar: set');
    }

    const app = await rest.get('/applications/@me');
    const invite = new URL('https://discord.com/oauth2/authorize');
    invite.searchParams.set('client_id', app.id);
    invite.searchParams.set('permissions', '0');
    invite.searchParams.set('scope', 'bot');
    console.log('\nInvite this test bot to a server:');
    console.log(invite.toString());
  } catch (err) {
    console.error('   profile/invite error:', err.rawError?.message || err.message);
  }
});

client.login(token);
