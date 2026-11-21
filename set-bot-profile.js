// Sets the bot's username, global display name and avatar.
require('dotenv').config();

const fs = require('fs');
const { REST, Routes } = require('discord.js');

const imagePath =
  'C:\\Users\\yyyya\\AppData\\Local\\Temp\\opencode\\uploads\\0fae617b-54ee-4350-8588-1e6687368ce2\\image.png';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  const bytes = fs.readFileSync(imagePath);
  const avatar = `data:image/png;base64,${bytes.toString('base64')}`;

  const bodies = [
    { username: 'gamezone.bot', display_name: 'gamezone bot', avatar },
    { username: 'gamezone.bot', avatar },
    { username: 'gamezone.bot' },
  ];

  for (const body of bodies) {
    try {
      const user = await rest.patch(Routes.user('@me'), { body });
      console.log('✅ Bot profile updated');
      console.log('   username   :', user.username);
      console.log('   displayName:', user.global_name || user.display_name || '(none)');
      console.log('   avatar     :', user.avatar ? 'set' : 'not set');
      return;
    } catch (err) {
      console.log('⚠️ attempt failed:', err.rawError?.message || err.message);
    }
  }

  console.error('❌ Could not update bot profile');
  process.exit(1);
})();
