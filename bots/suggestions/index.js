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
} = require('discord.js');
const config = require('./config');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token || !clientId) {
  console.error('Set DISCORD_TOKEN and CLIENT_ID in .env');
  process.exit(1);
}

const file = path.join(__dirname, 'suggestions.json');
const empty = () => ({ settings: {}, suggestions: {}, polls: {} });
const load = () => {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      settings: data.settings || {},
      suggestions: data.suggestions || {},
      polls: data.polls || {},
    };
  } catch {
    return empty();
  }
};
const save = (data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
const setting = (guildId) => load().settings[guildId] || null;
const setSetting = (guildId, values) => {
  const data = load();
  data.settings[guildId] = { ...(data.settings[guildId] || {}), ...values };
  save(data);
  return data.settings[guildId];
};
const update = (kind, id, values) => {
  const data = load();
  data[kind][id] = { ...(data[kind][id] || {}), ...values };
  save(data);
  return data[kind][id];
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const POLL_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
const TIME_MINUTES = {
  '5': 5,
  '15': 15,
  '30': 30,
  '60': 60,
  '180': 180,
  '1440': 1440,
  '10080': 10080,
};
const TIME_CHOICES = [
  { name: '5 דקות', value: '5' },
  { name: '15 דקות', value: '15' },
  { name: '30 דקות', value: '30' },
  { name: 'שעה', value: '60' },
  { name: '3 שעות', value: '180' },
  { name: '24 שעות', value: '1440' },
  { name: '7 ימים', value: '10080' },
];

const commands = [
  new SlashCommandBuilder()
    .setName('suggestion-setup')
    .setDescription('הגדרת ערוץ ההצעות')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) => o.setName('channel').setDescription('הערוץ שבו יופיעו ההצעות'))
    .addStringOption((o) =>
      o
        .setName('auto')
        .setDescription('זמן עד להכרעה אוטומטית לפי רוב הקולות')
        .addChoices({ name: 'ללא — רק צוות מחליט', value: '0' }, ...TIME_CHOICES)
    )
    .addBooleanOption((o) => o.setName('clear').setDescription('ביטול הערוץ המוגדר'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('שליחת הצעה לצוות')
    .addStringOption((o) =>
      o.setName('text').setDescription('תוכן ההצעה').setRequired(true).setMaxLength(1000)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('יצירה וניהול של הצבעות')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('פתיחת הצבעה חדשה')
        .addStringOption((o) =>
          o.setName('question').setDescription('השאלה').setRequired(true).setMaxLength(200)
        )
        .addStringOption((o) =>
          o
            .setName('duration')
            .setDescription('משך ההצבעה — בוחרים מתפריט')
            .setRequired(true)
            .addChoices(...TIME_CHOICES)
        )
        .addStringOption((o) =>
          o.setName('option1').setDescription('אפשרות 1').setRequired(true).setMaxLength(100)
        )
        .addStringOption((o) => o.setName('option2').setDescription('אפשרות 2').setMaxLength(100))
        .addStringOption((o) => o.setName('option3').setDescription('אפשרות 3').setMaxLength(100))
        .addStringOption((o) => o.setName('option4').setDescription('אפשרות 4').setMaxLength(100))
    )
    .addSubcommand((s) =>
      s
        .setName('close')
        .setDescription('סגירת הצבעה מוקדם')
        .addStringOption((o) => o.setName('id').setDescription('מזהה הודעה').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('results')
        .setDescription('תוצאות ההצבעה')
        .addStringOption((o) => o.setName('id').setDescription('מזהה הודעה').setRequired(true))
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName('staff-hide')
    .setDescription('הסתרת פקודות צוות ממשתמשים רגילים')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((o) =>
      o.setName('role').setDescription('תפקיד הצוות שיראה את הפקודות').setRequired(true)
    )
    .toJSON(),
];

// דיסקורד לא מאפשר לבוטים לשנות הרשאות פקודות — מסתירים את פקודות הצוות
// כברירת מחדל ואוכפים בעלות בקוד. /suggest נשארת פתוחה לכולם.
for (const cmd of commands) {
  if (cmd.default_member_permissions && cmd.default_member_permissions !== '0') {
    cmd.default_member_permissions = '0';
  }
}
const STAFF_COMMANDS = commands
  .filter((c) => c.default_member_permissions === '0')
  .map((c) => c.name);
const OWNER_IDS = (process.env.BOT_OWNER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

function isOwnerUser(interaction) {
  return (
    OWNER_IDS.includes(interaction.user.id) ||
    interaction.guild?.ownerId === interaction.user.id ||
    interaction.user.id === interaction.client?.application?.owner?.id
  );
}

async function reply(interaction, payload) {
  const body = { ephemeral: true, ...payload };
  if (interaction.replied || interaction.deferred) return interaction.followUp(body);
  return interaction.reply(body);
}

function isStaff(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function voteBar(up, down, size = 12) {
  const total = up + down;
  const upPart = total ? Math.round((up / total) * size) : 0;
  return '🟩'.repeat(upPart) + '⬜'.repeat(size - upPart);
}

function suggestionEmbed(s) {
  const up = s.votes?.up || 0;
  const down = s.votes?.down || 0;
  const total = up + down;
  const upPct = total ? Math.round((up / total) * 100) : 0;
  const downPct = total ? 100 - upPct : 0;
  const status =
    s.status === 'approved'
      ? config.statusApproved
      : s.status === 'denied'
        ? config.statusDenied
        : config.statusOpen;
  const color =
    s.status === 'approved' ? '#57F287' : s.status === 'denied' ? '#ED4245' : config.color;
  const autoLine =
    s.endsAt && s.status === 'open'
      ? `\n${config.autoTime.replace('{time}', Math.floor(s.endsAt / 1000))}`
      : '';
  const votesText = config.votes
    .replace('{up}', up)
    .replace('{down}', down)
    .replace('{upPct}', upPct)
    .replace('{downPct}', downPct)
    .replace('{bar}', voteBar(up, down));

  return new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: config.suggestionTitle, iconURL: client.user?.displayAvatarURL() })
    .setDescription(`> ${s.text}`)
    .addFields(
      { name: config.suggestionStatusLabel, value: status + autoLine, inline: true },
      { name: config.suggestionVotesLabel, value: votesText, inline: true },
      {
        name: config.suggestionByLabel,
        value: config.suggestionBy.replace('{user}', `<@${s.authorId}>`),
        inline: false,
      }
    )
    .setFooter({ text: config.suggestionFooter.replace('{id}', s.id.slice(-6)) })
    .setTimestamp(new Date(s.createdAt || Date.now()));
}

function suggestionComponents(s) {
  const disabled = s.status !== 'open';
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`sug_up:${s.id}`)
        .setLabel('👍')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`sug_down:${s.id}`)
        .setLabel('👎')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`sug_approve:${s.id}`)
        .setLabel('✅ אישור')
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`sug_deny:${s.id}`)
        .setLabel('❌ דחייה')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    ),
  ];
}

function pollCounts(p) {
  const counts = p.options.map(() => 0);
  for (const choice of Object.values(p.voters || {})) {
    if (Number.isInteger(choice) && counts[choice] !== undefined) counts[choice] += 1;
  }
  return counts;
}

function pollEmbed(p) {
  const counts = pollCounts(p);
  const total = counts.reduce((a, b) => a + b, 0);
  const lines = p.options.map((option, i) => {
    const pct = total ? Math.round((counts[i] / total) * 100) : 0;
    const filled = Math.round(pct / 10);
    const bar = '🟦'.repeat(filled) + '⬜'.repeat(10 - filled);
    return `${POLL_EMOJIS[i]} **${option}**\n\`${bar}\` ${counts[i]} קולות · ${pct}%`;
  });
  const status = p.closed
    ? config.pollEnded
    : config.pollOpen.replace('{time}', Math.floor(p.endsAt / 1000));

  return new EmbedBuilder()
    .setColor(p.closed ? '#80848E' : config.pollColor)
    .setAuthor({
      name: p.closed ? config.pollHeaderClosed : config.pollHeaderOpen,
      iconURL: client.user?.displayAvatarURL(),
    })
    .setTitle(`❓ ${p.question}`)
    .setDescription(lines.join('\n\n'))
    .addFields(
      {
        name: '📊 סיכום',
        value: `${config.pollTotal.replace('{total}', total)}\n${status}`,
        inline: false,
      },
      {
        name: '👤 יוזם ההצבעה',
        value: config.pollBy.replace('{user}', `<@${p.authorId}>`),
        inline: false,
      }
    )
    .setFooter({ text: config.suggestionFooter.replace('{id}', p.id.slice(-6)) })
    .setTimestamp(new Date(p.createdAt || Date.now()));
}

function pollComponents(p) {
  if (p.closed) return [];
  return [
    new ActionRowBuilder().addComponents(
      ...p.options.map((option, i) =>
        new ButtonBuilder()
          .setCustomId(`poll_vote:${p.id}:${i}`)
          .setLabel(`${POLL_EMOJIS[i]} ${option.slice(0, 55)}`)
          .setStyle(ButtonStyle.Primary)
      )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_close:${p.id}`)
        .setLabel('⏹️ סגור הצבעה')
        .setStyle(ButtonStyle.Danger)
    ),
  ];
}

async function refreshSuggestion(s) {
  const channel = await client.channels.fetch(s.channelId).catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(s.messageId).catch(() => null);
  if (!message) return;
  try {
    await message.edit({ embeds: [suggestionEmbed(s)], components: suggestionComponents(s) });
  } catch {}
}

async function refreshPoll(p) {
  const channel = await client.channels.fetch(p.channelId).catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(p.messageId).catch(() => null);
  if (!message) return;
  try {
    await message.edit({ embeds: [pollEmbed(p)], components: pollComponents(p) });
  } catch {}
}

async function createSuggestion(interaction) {
  const text = interaction.options.getString('text', true).trim();
  const cfg = setting(interaction.guild.id);
  if (!cfg?.channelId) return reply(interaction, { content: config.noChannel });

  const channel = await client.channels.fetch(cfg.channelId).catch(() => null);
  if (!channel?.isTextBased()) return reply(interaction, { content: config.noChannel });

  const autoMinutes = Number(cfg.autoMinutes) || 0;
  const id = `s_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const s = {
    id,
    guildId: interaction.guild.id,
    channelId: channel.id,
    authorId: interaction.user.id,
    authorTag: interaction.user.tag,
    text,
    status: 'open',
    votes: { up: 0, down: 0 },
    voters: {},
    endsAt: autoMinutes ? Date.now() + autoMinutes * 60_000 : null,
    createdAt: Date.now(),
  };

  const data = load();
  data.suggestions[id] = s;
  save(data);

  let message;
  try {
    message = await channel.send({ embeds: [suggestionEmbed(s)], components: suggestionComponents(s) });
  } catch {
    const fresh = load();
    delete fresh.suggestions[id];
    save(fresh);
    return reply(interaction, { content: '❌ אין לי הרשאה לשלוח בערוץ הזה.' });
  }

  update('suggestions', id, { messageId: message.id });
  if (autoMinutes) setTimeout(() => autoDecideSuggestion(id), autoMinutes * 60_000);
  return reply(interaction, {
    content: autoMinutes
      ? `✅ ההצעה נשלחה ל־<#${channel.id}>. הכרעה אוטומטית <t:${Math.floor(s.endsAt / 1000)}:R>.`
      : `✅ ההצעה נשלחה ל־<#${channel.id}>.`,
  });
}

async function voteSuggestion(interaction, id, kind) {
  const data = load();
  const s = data.suggestions[id];
  if (!s || s.status !== 'open') {
    return interaction.reply({ content: '⚠️ ההצעה כבר לא פתוחה.', ephemeral: true }).catch(() => {});
  }
  const uid = interaction.user.id;
  const previous = s.voters[uid];
  if (previous === kind) {
    delete s.voters[uid];
    s.votes[previous] -= 1;
  } else {
    if (previous) s.votes[previous] -= 1;
    s.voters[uid] = kind;
    s.votes[kind] = (s.votes[kind] || 0) + 1;
  }
  save(data);
  await interaction.reply({ content: config.voted, ephemeral: true }).catch(() => {});
  await refreshSuggestion(s);
}

async function decideSuggestion(interaction, id, status) {
  if (!isStaff(interaction)) {
    return interaction.reply({ content: config.notStaff, ephemeral: true }).catch(() => {});
  }
  const s = load().suggestions[id];
  if (!s || s.status !== 'open') {
    return interaction.reply({ content: '⚠️ ההצעה כבר לא פתוחה.', ephemeral: true }).catch(() => {});
  }
  const updated = update('suggestions', id, {
    status,
    decidedBy: interaction.user.id,
    decidedAt: Date.now(),
  });
  await interaction
    .reply({
      content: status === 'approved' ? config.approved : config.denied,
      ephemeral: true,
    })
    .catch(() => {});
  await refreshSuggestion(updated);
}

async function autoDecideSuggestion(id) {
  const s = load().suggestions[id];
  if (!s || s.status !== 'open') return;
  const up = s.votes?.up || 0;
  const down = s.votes?.down || 0;
  const status = up > down ? 'approved' : 'denied';
  const decided = update('suggestions', id, {
    status,
    decidedBy: 'auto',
    decidedAt: Date.now(),
    endsAt: null,
  });
  await refreshSuggestion(decided);
  const channel = await client.channels.fetch(decided.channelId).catch(() => null);
  if (channel) {
    const text = (status === 'approved' ? config.autoApproved : config.autoDenied).replace(
      '{text}',
      decided.text
    );
    try {
      await channel.send({ content: text, allowedMentions: { parse: [] } });
    } catch {}
  }
}

async function createPoll(interaction) {
  const question = interaction.options.getString('question', true).trim();
  const options = ['option1', 'option2', 'option3', 'option4']
    .map((name) => (interaction.options.getString(name) || '').trim())
    .filter(Boolean);
  if (options.length < 2) return reply(interaction, { content: '⚠️ צריך לפחות שתי אפשרויות.' });

  const minutes = TIME_MINUTES[interaction.options.getString('duration', true)] || 10;
  const id = `p_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const p = {
    id,
    guildId: interaction.guild.id,
    channelId: interaction.channel.id,
    question,
    options,
    voters: {},
    closed: false,
    endsAt: Date.now() + minutes * 60_000,
    authorId: interaction.user.id,
    authorTag: interaction.user.tag,
    createdAt: Date.now(),
  };

  const data = load();
  data.polls[id] = p;
  save(data);

  let message;
  try {
    message = await interaction.channel.send({ embeds: [pollEmbed(p)], components: pollComponents(p) });
  } catch {
    const fresh = load();
    delete fresh.polls[id];
    save(fresh);
    return reply(interaction, { content: '❌ אין לי הרשאה לשלוח בערוץ הזה.' });
  }

  update('polls', id, { messageId: message.id });
  setTimeout(() => closePoll(id), minutes * 60_000);
  return reply(interaction, { content: `✅ ההצבעה נוצרה. מזהה: \`${message.id}\`` });
}

async function votePoll(interaction, id, index) {
  const data = load();
  const p = data.polls[id];
  if (!p || p.closed || p.options[index] === undefined) {
    return interaction.reply({ content: '⚠️ ההצבעה כבר סגורה.', ephemeral: true }).catch(() => {});
  }
  const uid = interaction.user.id;
  if (p.voters[uid] === index) delete p.voters[uid];
  else p.voters[uid] = index;
  save(data);
  await interaction.reply({ content: config.pollVoted, ephemeral: true }).catch(() => {});
  await refreshPoll(p);
}

function pollResultText(p) {
  const counts = pollCounts(p);
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return config.pollNoVotes;
  const max = Math.max(...counts);
  const winners = counts.map((count, i) => (count === max ? p.options[i] : null)).filter(Boolean);
  if (winners.length > 1) return config.pollTie.replace('{options}', winners.join(' / '));
  const index = counts.indexOf(max);
  return config.pollWinner.replace('{option}', p.options[index]).replace('{votes}', max);
}

async function closePoll(id) {
  const data = load();
  const p = data.polls[id];
  if (!p || p.closed) return;
  const closed = update('polls', id, { closed: true, closedAt: Date.now() });
  await refreshPoll(closed);
  const channel = await client.channels.fetch(closed.channelId).catch(() => null);
  if (channel) {
    try {
      await channel.send({ content: pollResultText(closed), allowedMentions: { parse: [] } });
    } catch {}
  }
}

function findPollByMessage(interaction) {
  const messageId = interaction.options.getString('id', true).trim();
  return Object.values(load().polls).find(
    (p) => p.messageId === messageId && p.guildId === interaction.guild.id
  );
}

async function restore() {
  const data = load();
  for (const s of Object.values(data.suggestions)) {
    if (s.status !== 'open' || !s.endsAt) continue;
    const ms = Number(s.endsAt) - Date.now();
    if (ms <= 0) await autoDecideSuggestion(s.id);
    else setTimeout(() => autoDecideSuggestion(s.id), ms);
  }
  for (const p of Object.values(data.polls)) {
    if (p.closed) continue;
    const ms = Number(p.endsAt) - Date.now();
    if (ms <= 0) await closePoll(p.id);
    else setTimeout(() => closePoll(p.id), ms);
  }
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
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id.startsWith('sug_up:')) return await voteSuggestion(interaction, id.slice(7), 'up');
      if (id.startsWith('sug_down:')) return await voteSuggestion(interaction, id.slice(9), 'down');
      if (id.startsWith('sug_approve:'))
        return await decideSuggestion(interaction, id.slice(12), 'approved');
      if (id.startsWith('sug_deny:')) return await decideSuggestion(interaction, id.slice(9), 'denied');
      if (id.startsWith('poll_vote:')) {
        const [, pollId, index] = id.split(':');
        return await votePoll(interaction, pollId, Number(index));
      }
      if (id.startsWith('poll_close:')) {
        if (!isStaff(interaction)) {
          return interaction.reply({ content: config.notStaff, ephemeral: true }).catch(() => {});
        }
        await closePoll(id.slice(11));
        return interaction.reply({ content: config.pollClosed, ephemeral: true }).catch(() => {});
      }
    }

    if (!interaction.isChatInputCommand()) return;

    if (STAFF_COMMANDS.includes(interaction.commandName) && !isOwnerUser(interaction)) {
      return reply(interaction, { content: config.notStaff });
    }

    if (interaction.commandName === 'suggestion-setup') {
      const current = setting(interaction.guild.id) || {};
      if (interaction.options.getBoolean('clear')) {
        setSetting(interaction.guild.id, { channelId: null, autoMinutes: 0 });
        return reply(interaction, { content: '✅ ערוץ ההצעות בוטל.' });
      }
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      if (!channel?.isTextBased()) return reply(interaction, { content: '⚠️ צריך ערוץ טקסט.' });
      const autoValue = interaction.options.getString('auto');
      const autoMinutes =
        autoValue === null || autoValue === undefined
          ? Number(current.autoMinutes) || 0
          : TIME_MINUTES[autoValue] || 0;
      setSetting(interaction.guild.id, { channelId: channel.id, autoMinutes });
      return reply(interaction, {
        content: autoMinutes
          ? `✅ ערוץ ההצעות: <#${channel.id}>. הכרעה אוטומטית אחרי ${autoMinutes} דקות.`
          : `✅ ערוץ ההצעות נקבע ל־<#${channel.id}>.`,
      });
    }

    if (interaction.commandName === 'staff-hide') {
      return reply(interaction, { content: config.hiddenDone });
    }

    if (interaction.commandName === 'suggest') return await createSuggestion(interaction);

    if (interaction.commandName === 'poll') {
      const sub = interaction.options.getSubcommand();
      if (sub === 'create') return await createPoll(interaction);
      if (sub === 'close') {
        const p = findPollByMessage(interaction);
        if (!p) return reply(interaction, { content: '⚠️ לא נמצאה הצבעה.' });
        await closePoll(p.id);
        return reply(interaction, { content: config.pollClosed });
      }
      if (sub === 'results') {
        const p = findPollByMessage(interaction);
        if (!p) return reply(interaction, { content: '⚠️ לא נמצאה הצבעה.' });
        return reply(interaction, { content: pollResultText(p) });
      }
    }
  } catch (err) {
    console.error('[community]', err.message);
  }
});

process.on('unhandledRejection', (err) => console.error('[unhandled]', err?.message || err));
client.login(token);
