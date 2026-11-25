require('dotenv').config();

const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
  ChannelType,
  SlashCommandBuilder,
  REST,
  Routes,
  Events,
  AttachmentBuilder,
} = require('discord.js');
const config = require('./config');
const { buildTicketPanelCard } = require('./panelCard');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
if (!token || !clientId) {
  console.error('Set DISCORD_TOKEN and CLIENT_ID in .env');
  process.exit(1);
}

const storeFile = path.join(__dirname, 'guilds.json');
const store = fs.existsSync(storeFile) ? JSON.parse(fs.readFileSync(storeFile, 'utf8')) : {};
const saveStore = () => fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));
const cfg = (id) => store[id] || (store[id] = {});

const defaultCategories = [
  { label: '📌 נושא אחר', value: 'other', description: 'כל נושא כללי שאינו מופיע באפשרויות האחרות' },
  { label: '❓ שאלה כללית', value: 'question', description: 'דברים שאתם רוצים לדעת על השרת, הכללים והפעילות' },
  { label: '🛒 רכישה בשרת', value: 'purchase', description: 'תרומות, כלי רכב, עסקים והטבות' },
  { label: '📝 מועמדות לצוות', value: 'staff-apply', description: 'הגשת פרטים ומבחן קבלה לצוות' },
  { label: '⚖️ ערעור על עונש', value: 'ban-appeal', description: 'בקשה לבחון הרחקה או עונש שהוטל' },
  { label: '🚨 דיווח על צוות', value: 'staff-report', description: 'סיפור על התנהלות של איש צוות שדורשת בדיקה' },
  { label: '👮 דיווח על שחקן', value: 'player-report', description: 'מעשה שחרג מכללי ה-RP' },
  { label: '🚫 דיווח על צ\'יטים', value: 'cheat-report', description: 'התראה דחופה על שימוש בהאקים או בצ\'יטים' },
  { label: '🎭 דמות שנייה', value: 'second-character', description: 'בקשה להפעיל דמות נוספת בעולם ה-RP' },
  { label: '🎥 אישור שידור', value: 'stream-approval', description: 'רול סטרימר/יוטיובר והיתר לייב' },
];
function categoriesFor(guildId) {
  const saved = cfg(guildId).categories;
  return Array.isArray(saved) && saved.length ? saved : defaultCategories;
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Message, Partials.Channel],
});

const commands = [
  new SlashCommandBuilder()
    .setName('ticket-setup')
    .setDescription('הקמת פאנל טיקטים בערוץ הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('ticket-category')
    .setDescription('ניהול הקטגוריות בתפריט פתיחת הטיקט')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('הוספת קטגוריה לתפריט')
        .addStringOption((o) =>
          o.setName('name').setDescription('שם הקטגוריה').setRequired(true).setMaxLength(80)
        )
        .addStringOption((o) =>
          o.setName('description').setDescription('תיאור קצר').setMaxLength(100)
        )
        .addChannelOption((o) =>
          o.setName('category').setDescription('קטגוריית דיסקורד קיימת')
        )
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('הסרת קטגוריה מהתפריט')
        .addStringOption((o) =>
          o.setName('value').setDescription('מספר, שם או ערך הקטגוריה').setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('list').setDescription('רשימת הקטגוריות'))
    .toJSON(),
];

async function deploy() {
  const rest = new REST({ version: '10' }).setToken(token);
  const guildIds = (process.env.GUILD_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (guildIds.length) {
    for (const id of guildIds) {
      await rest.put(Routes.applicationGuildCommands(clientId, id), { body: commands });
    }
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
  }
  console.log(`Deployed ${commands.length} command(s).`);
}

async function reply(interaction, content, extra = {}) {
  const payload = { content, ephemeral: true, ...extra };
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}

function fill(text, vars) {
  let out = String(text ?? '');
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v ?? ''));
  return out;
}

function brand(embed) {
  if (client.user?.displayAvatarURL) {
    embed.setThumbnail(client.user.displayAvatarURL({ size: 128 }));
  }
  return embed.setFooter({ text: config.footer });
}

function ticketCategorySelect(guildId) {
  const categories = categoriesFor(guildId);
  const options = categories.slice(0, 25).map((c) =>
    new StringSelectMenuOptionBuilder()
      .setLabel(c.label)
      .setValue(c.value)
      .setDescription(c.description || 'פתיחת טיקט')
  );
  if (!options.length) {
    options.push(
      new StringSelectMenuOptionBuilder()
        .setLabel('תמיכה')
        .setValue('support')
        .setDescription('עזרה ותמיכה כללית')
    );
  }
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket_create_select')
      .setPlaceholder(config.selectPlaceholder || 'בחרו סוג פנייה כדי לפתוח טיקט')
      .addOptions(options)
  );
}

async function panel(guildId) {
  const categories = categoriesFor(guildId);
  const embed = new EmbedBuilder()
    .setColor(config.colors.panel)
    .setTitle(config.panelTitle)
    .setDescription(config.panelDescription);
  if (categories.length > 1) {
    embed.addFields({
      name: '🧭 סוג הפנייה',
      value: categories.map((c) => `• ${c.label}`).join('\n'),
    });
  }

  let files = [];
  if (cfg(guildId).imageUrl) {
    embed.setImage(cfg(guildId).imageUrl);
  } else {
    const name = 'ticket-panel.png';
    const buffer = await buildTicketPanelCard({
      title: config.panelTitle,
      description: config.panelDescription,
      categories,
    });
    embed.setImage(`attachment://${name}`);
    files = [new AttachmentBuilder(buffer, { name })];
  }

  return {
    embeds: [brand(embed)],
    components: [ticketCategorySelect(guildId)],
    files,
  };
}

function ticketButtons(claimed = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel(config.claimLabel)
      .setEmoji(config.claimEmoji)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(claimed),
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel(config.closeLabel)
      .setEmoji(config.closeEmoji)
      .setStyle(ButtonStyle.Danger)
  );
}

function categoryListText(guildId) {
  const categories = categoriesFor(guildId);
  return categories.length
    ? `**קטגוריות בתפריט (${categories.length}):**\n` +
        categories
          .map((c, i) => `${i + 1}. ${c.label} — \`${c.value}\``)
          .join('\n') +
        '\n\nאפשר להסיר לפי מספר, שם או ערך.'
    : 'אין קטגוריות. הוסיפו עם `/ticket-category add`.';
}

async function openTicket(interaction, chosen) {
  const { guild, user } = interaction;

  const existing = guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildText && (ch.topic || '').includes(`creator:${user.id}`)
  );
  if (existing) return reply(interaction, fill(config.duplicate, { channel: `<#${existing.id}>` }));

  let category = null;
  const configuredId = chosen?.categoryId || '';
  if (configuredId) category = guild.channels.cache.get(configuredId) || null;
  if (!category || category.type !== ChannelType.GuildCategory) {
    category =
      guild.channels.cache.find(
        (ch) => ch.type === ChannelType.GuildCategory && ch.name === (chosen?.label || 'TICKETS')
      ) || guild.channels.cache.find((ch) => ch.type === ChannelType.GuildCategory && ch.name === 'TICKETS') || null;
  }
  if (!category) {
    category = await guild.channels
      .create({ name: 'TICKETS', type: ChannelType.GuildCategory })
      .catch(() => null);
  }
  if (!category) return reply(interaction, config.noCategory);

  const numbers = guild.channels.cache
    .map((ch) => /^ticket-(\d+)/.exec(ch.name || ''))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  const number = String(numbers.length ? Math.max(...numbers) + 1 : 1).padStart(3, '0');

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];
  for (const id of (process.env.SUPPORT_ROLE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    if (guild.roles.cache.has(id)) {
      overwrites.push({
        id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
        ],
      });
    }
  }

  const channel = await guild.channels.create({
    name: `ticket-${number}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `creator:${user.id}|status:open|category:${chosen?.value || 'default'}`,
    permissionOverwrites: overwrites,
  });

  const embed = brand(
    new EmbedBuilder()
      .setColor(config.colors.open)
      .setTitle(fill(config.ticketTitle, { number }))
      .setDescription(
        fill(config.ticketDescription, {
          user: `<@${user.id}>`,
          number,
          category: chosen?.label || 'Ticket',
        })
      )
  );

  await channel.send({
    content: `<@${user.id}>`,
    embeds: [embed],
    components: [ticketButtons(false)],
  });
  return reply(interaction, fill(config.created, { channel: `<#${channel.id}>` }));
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await deploy().catch((err) => console.error('[deploy]', err.message));
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'ticket-category') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          return reply(interaction, config.needPerm);
        }

        const gid = interaction.guild.id;
        const categories = [...categoriesFor(gid)];
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
          const name = interaction.options.getString('name');
          const description = interaction.options.getString('description') || '';
          const channel = interaction.options.getChannel('category');
          let value =
            name
              .toLowerCase()
              .replace(/[^\p{L}\p{N}]+/gu, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 30) || 'category';
          if (categories.some((c) => c.value === value)) {
            value = `${value}-${Date.now().toString().slice(-4)}`;
          }
          categories.push({
            label: name,
            value,
            description: description || name,
            categoryId:
              channel && channel.type === ChannelType.GuildCategory ? channel.id : '',
          });
          cfg(gid).categories = categories;
          saveStore();
          return reply(
            interaction,
            `✅ הקטגוריה **${name}** נוספה (\`${value}\`).`
          );
        }

        if (sub === 'remove') {
          const raw = (interaction.options.getString('value') || '').trim();
          const byNumber = Number(raw) > 0 ? categories[Number(raw) - 1] : null;
          const match =
            byNumber ||
            categories.find(
              (c) => c.value === raw || c.label.toLowerCase() === raw.toLowerCase()
            );
          if (!match) {
            return reply(
              interaction,
              `⚠️ קטגוריה \`${raw}\` לא נמצאה.\n\n${categoryListText(gid)}`
            );
          }
          cfg(gid).categories = categories.filter((c) => c.value !== match.value);
          saveStore();
          return reply(
            interaction,
            `✅ **${match.label}** הוסרה מהתפריט. נותרו ${cfg(gid).categories.length}.`
          );
        }

        return reply(interaction, categoryListText(gid));
      }

      if (interaction.commandName === 'ticket-setup') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
          return reply(interaction, config.needPerm);
        }
        await interaction.channel.send(await panel(interaction.guild.id));
        return reply(interaction, config.setupDone);
      }
      return;
    }

    if (
      interaction.isStringSelectMenu() &&
      (interaction.customId === 'ticket_create_select' ||
        interaction.customId === 'ticket_category_select')
    ) {
      const chosen = categoriesFor(interaction.guild.id).find(
        (c) => c.value === interaction.values[0]
      );
      if (!chosen) return reply(interaction, '⚠️ קטגוריה לא תקינה.');
      // Keep the panel intact — only the ephemeral reply shows the result.
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      return await openTicket(interaction, chosen);
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'ticket_open') {
      // Old button panels are upgraded in place to the dropdown layout.
      try {
        await interaction.update({
          components: [ticketCategorySelect(interaction.guild.id)],
        });
      } catch {
        return reply(interaction, '⚠️ נסו שוב.');
      }
      return;
    }

    if (interaction.customId === 'ticket_claim') {
      await interaction.deferReply({ ephemeral: true });
      const topic = `creator:${/creator:(\d+)/.exec(interaction.channel.topic || '')?.[1] || ''}|status:claimed|staff:${interaction.user.id}`;
      await interaction.channel.setTopic(topic).catch(() => {});
      await interaction.message.edit({ components: [ticketButtons(true)] }).catch(() => {});
      const msg = await interaction.channel.messages.fetch(interaction.message.id).catch(() => null);
      if (msg) {
        const embed = EmbedBuilder.from(msg.embeds[0] || {});
        brand(embed)
          .setColor(config.colors.claimed)
          .setTitle(config.claimedTitle)
          .setDescription(fill(config.claimedDescription, { staff: `<@${interaction.user.id}>` }));
        await msg.edit({ embeds: [embed] }).catch(() => {});
      }
      return interaction.editReply({ content: fill(config.claimedReply, { staff: interaction.user.id }) });
    }

    if (interaction.customId === 'ticket_close') {
      await interaction.channel.delete().catch(() => {});
    }
  } catch (err) {
    console.error('[interaction]', err.message);
  }
});

client.login(token);
