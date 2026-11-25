require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Events,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const config = require('./config');
const { buildWinnerCard } = require('./winnerCard');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token || !clientId) {
  console.error('Set DISCORD_TOKEN and CLIENT_ID in .env');
  process.exit(1);
}

const storeFile = path.join(__dirname, 'giveaways.json');
const load = () => {
  try {
    return JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  } catch {
    return {};
  }
};
const save = (data) => fs.writeFileSync(storeFile, JSON.stringify(data, null, 2));
const get = (id) => load()[id] || null;
const set = (id, values) => {
  const all = load();
  all[id] = { ...(all[id] || {}), ...values };
  save(all);
  return all[id];
};
const remove = (id) => {
  const all = load();
  delete all[id];
  save(all);
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('ניהול הגרלות בשרת')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('start')
        .setDescription('פתיחת הגרלה חדשה')
        .addStringOption((o) =>
          o.setName('prize').setDescription('מה הפרס').setRequired(true).setMaxLength(200)
        )
        .addIntegerOption((o) =>
          o
            .setName('duration')
            .setDescription('משך ההגרלה בדקות')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10080)
        )
        .addIntegerOption((o) =>
          o.setName('winners').setDescription('כמה זוכים (1-10)').setMinValue(1).setMaxValue(10)
        )
        .addChannelOption((o) => o.setName('channel').setDescription('ערוץ להגרלה'))
        .addRoleOption((o) => o.setName('role').setDescription('תפקיד נדרש'))
    )
    .addSubcommand((s) =>
      s
        .setName('end')
        .setDescription('סגירת הגרלה מוקדם')
        .addStringOption((o) => o.setName('id').setDescription('מזהה הודעה').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('reroll')
        .setDescription('הגרלה מחדש')
        .addStringOption((o) => o.setName('id').setDescription('מזהה הודעה').setRequired(true))
    )
    .addSubcommand((s) => s.setName('list').setDescription('רשימת הגרלות פתוחות'))
    .toJSON(),
];

function brand(embed) {
  if (client.user?.displayAvatarURL) {
    embed.setThumbnail(client.user.displayAvatarURL({ size: 128 }));
  }
  return embed;
}

function embedFor(g) {
  const count = (g.entrants || []).length;
  const roleLine = g.roleId ? `\n🎭 דרישה: <@&${g.roleId}>` : '';
  const winnerCount = Array.isArray(g.winners) ? g.winners.length : Number(g.winners) || 1;
  const winnersText = Array.isArray(g.winners) && g.winners.length
    ? g.winners.map((id) => `<@${id}>`).join(', ')
    : String(winnerCount);

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(g.ended ? `🎉 ${g.prize} — הסתיים` : `🎉 ${g.prize}`)
    .setDescription(
      g.ended
        ? `👥 משתתפים: **${count}**\n🏆 זוכים: **${winnersText}**`
        : `לחצו על הכפתור כדי להיכנס!\n\n👥 משתתפים: **${count}**\n🏆 זוכים: **${winnerCount}**\n⏰ מסתיים: <t:${Math.floor(g.endsAt / 1000)}:R>${roleLine}`
    )
    .setFooter({ text: `מארח: ${g.hostTag || 'יוצר השרת'} · ${config.footer}` })
    .setTimestamp();

  return brand(embed);
}

function componentsFor(g) {
  if (g.ended) return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_enter:${g.id}`)
        .setLabel(config.button)
        .setStyle(ButtonStyle.Success)
    ),
  ];
}

function pickWinners(entrants, count, excluded = []) {
  const pool = [...new Set(entrants)].filter((id) => !excluded.includes(id));
  const picked = [];
  while (picked.length < count && pool.length) {
    const [id] = pool.splice(crypto.randomInt(pool.length), 1);
    picked.push(id);
  }
  return picked;
}

async function announceWinners(channel, g, winnerIds, reroll = false) {
  for (const id of winnerIds) {
    const user = await client.users.fetch(id).catch(() => null);
    const name = user ? user.globalName || user.username : 'משתמש';

    const buffer = await buildWinnerCard({
      avatarUrl: user?.displayAvatarURL({ size: 512, extension: 'png' }),
      name,
      prize: g.prize,
      reroll,
    }).catch((err) => {
      console.error('[giveaway] card:', err.message);
      return null;
    });

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(reroll ? config.rerollTitle : config.winnerTitle);

    const payload = { content: `<@${id}>`, allowedMentions: { parse: ['users'] } };

    if (buffer) {
      embed.setImage('attachment://winner.png');
      payload.files = [new AttachmentBuilder(buffer, { name: 'winner.png' })];
    } else {
      embed.setDescription(
        config.winnerText
          .replace('{winner}', `<@${id}>`)
          .replace('{prize}', `**${g.prize}**`)
      );
    }

    payload.embeds = [embed];
    await channel.send(payload).catch(() => {});
  }
}

async function refresh(g) {
  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(g.messageId).catch(() => null);
  if (!message) return;
  try {
    await message.edit({ embeds: [embedFor(g)], components: componentsFor(g) });
  } catch {}
}

async function endGiveaway(id) {
  const g = get(id);
  if (!g || g.ended) return;

  const winners = pickWinners(g.entrants || [], g.winners || 1);
  set(id, { ended: true, endedAt: Date.now(), winners });

  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(g.messageId).catch(() => null);
  if (message) {
    try {
      await message.edit({ embeds: [embedFor({ ...g, ended: true, winners })], components: [] });
    } catch {}
  }

  if (!winners.length) {
    try {
      await channel.send({ content: config.noEntries });
    } catch {}
    return;
  }

  await announceWinners(channel, g, winners);
}

async function restore() {
  for (const g of Object.values(load())) {
    if (g.ended) continue;
    const ms = Number(g.endsAt) - Date.now();
    if (ms <= 0) await endGiveaway(g.id);
    else setTimeout(() => endGiveaway(g.id), ms);
  }
}

async function reply(interaction, payload) {
  const body = { ephemeral: true, ...payload };
  if (interaction.replied || interaction.deferred) return interaction.followUp(body);
  return interaction.reply(body);
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`Deployed ${commands.length} command(s).`);
  } catch (err) {
    console.error('[deploy]', err.rawError?.message || err.message);
  }
  await restore();
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() && interaction.customId.startsWith('giveaway_enter:')) {
      const id = interaction.customId.slice('giveaway_enter:'.length);
      const g = get(id);
      if (!g || g.ended) {
        return interaction.reply({ content: '⚠️ ההגרלה כבר הסתיימה.', ephemeral: true }).catch(() => {});
      }
      if (g.roleId && !interaction.member?.roles?.cache?.has(g.roleId)) {
        return interaction.reply({ content: config.roleRequired, ephemeral: true }).catch(() => {});
      }
      const entrants = new Set(g.entrants || []);
      if (entrants.has(interaction.user.id)) {
        return interaction.reply({ content: config.already, ephemeral: true }).catch(() => {});
      }
      entrants.add(interaction.user.id);
      set(id, { entrants: [...entrants] });
      await interaction.reply({ content: config.entered, ephemeral: true }).catch(() => {});
      await refresh({ ...g, entrants: [...entrants] });
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const prize = interaction.options.getString('prize', true).trim();
      const minutes = interaction.options.getInteger('duration', true);
      const winners = interaction.options.getInteger('winners') || 1;
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const role = interaction.options.getRole('role');
      if (!channel?.isTextBased()) return reply(interaction, { content: '⚠️ צריך ערוץ טקסט.' });

      const id = `gw_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const g = {
        id,
        guildId: interaction.guild.id,
        channelId: channel.id,
        prize,
        winners,
        endsAt: Date.now() + minutes * 60_000,
        roleId: role?.id || null,
        entrants: [],
        ended: false,
        hostTag: interaction.user.tag,
      };
      set(id, g);

      let message;
      try {
        message = await channel.send({ embeds: [embedFor(g)], components: componentsFor(g) });
      } catch (err) {
        remove(id);
        console.error('[giveaway] send:', err.message);
        return reply(interaction, { content: '❌ אין לי הרשאה לשלוח בערוץ הזה.' });
      }

      set(id, { messageId: message.id });
      setTimeout(() => endGiveaway(id), minutes * 60_000);
      return reply(interaction, { content: `✅ ההגרלה נוצרה. מזהה: \`${message.id}\`` });
    }

    if (sub === 'end') {
      const messageId = interaction.options.getString('id', true).trim();
      const g = Object.values(load()).find(
        (x) => x.messageId === messageId && x.guildId === interaction.guild.id
      );
      if (!g) return reply(interaction, { content: '⚠️ לא נמצאה הגרלה.' });
      await endGiveaway(g.id);
      return reply(interaction, { content: '✅ ההגרלה נסגרה.' });
    }

    if (sub === 'reroll') {
      const messageId = interaction.options.getString('id', true).trim();
      const g = Object.values(load()).find(
        (x) => x.messageId === messageId && x.guildId === interaction.guild.id
      );
      if (!g) return reply(interaction, { content: '⚠️ לא נמצאה הגרלה.' });
      const excluded = g.rerollWinners || [];
      const [winnerId] = pickWinners(g.entrants || [], 1, excluded);
      if (!winnerId) return reply(interaction, { content: config.noReroll });
      set(g.id, { rerollWinners: [...excluded, winnerId] });
      const channel = await client.channels.fetch(g.channelId).catch(() => null);
      if (channel) await announceWinners(channel, g, [winnerId], true);
      return reply(interaction, { content: '✅ נשלחה הודעת זוכה חדשה.' });
    }

    if (sub === 'list') {
      const open = Object.values(load()).filter(
        (g) => g.guildId === interaction.guild.id && !g.ended
      );
      const lines = open.map(
        (g) =>
          `• **${g.prize}** — <#${g.channelId}> — \`${g.messageId}\` — <t:${Math.floor(g.endsAt / 1000)}:R>`
      );
      return reply(interaction, {
        content: lines.length ? `**הגרלות פתוחות:**\n${lines.join('\n')}` : 'אין הגרלות פתוחות.',
      });
    }
  } catch (err) {
    console.error('[giveaway]', err.message);
  }
});

process.on('unhandledRejection', (err) => console.error('[unhandled]', err?.message || err));

client.login(token);
