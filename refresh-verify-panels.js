// Posts/refreshes the verify panel in every saved verify channel.
// Uses REST only, so it does not open a second bot gateway session.
require('dotenv').config();

const { REST, Routes, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');
const guildConfig = require('./src/guildConfig');

const token = process.env.DISCORD_TOKEN;
const rest = new REST({ version: '10' }).setToken(token);

function panelFor(guildId) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.panel || '#5865F2')
    .setTitle(config.verify.title)
    .setDescription(config.verify.description);

  // One click grants the verified role — no OAuth / external site.
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel(config.verify.buttonLabel)
      .setEmoji(config.verify.buttonEmoji)
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed.toJSON()], components: [row.toJSON()] };
}

(async () => {
  const me = await rest.get(Routes.user('@me'));
  const botId = String(me.id);

  const all = guildConfig.load();
  const channels = Object.entries(all)
    .map(([guildId, cfg]) => ({ guildId, channelId: cfg.verifyChannelId }))
    .filter((c) => c.channelId);

  if (!channels.length) {
    console.log('No verify channels saved.');
    return;
  }

  console.log(`Refreshing ${channels.length} verify panel(s)...`);

  for (const { guildId, channelId } of channels) {
    const payload = panelFor(guildId);

    try {
      const messages = await rest.get(Routes.channelMessages(channelId), {
        query: new URLSearchParams({ limit: '50' }),
      });

      const existing = messages.find(
        (m) =>
          String(m.author?.id) === botId && m.embeds?.[0]?.title === config.verify.title
      );

      if (existing) {
        await rest.patch(Routes.channelMessage(channelId, existing.id), { body: payload });
        console.log(`✅ Updated ${channelId} (message ${existing.id})`);
      } else {
        await rest.post(Routes.channelMessages(channelId), { body: payload });
        console.log(`✅ Posted new panel in ${channelId}`);
      }
    } catch (err) {
      console.error(`❌ ${channelId}:`, err.rawError?.message || err.message);
    }
  }
})();
