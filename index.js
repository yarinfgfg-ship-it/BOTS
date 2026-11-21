require('dotenv').config();

const crypto = require('crypto');

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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
  Events,
  AttachmentBuilder,
} = require('discord.js');

const config = require('./config');
const guildConfig = require('./src/guildConfig');
const ticketConfig = require('./src/ticketConfig');
const profiles = require('./src/profiles');
const oauth = require('./src/oauth');
const oauthServer = require('./src/oauthServer');
const giveaways = require('./src/giveaways');

// GuildMembers is required for the automatic welcome message on join.
// It must also be enabled in Developer Portal → Bot → Privileged Gateway Intents.
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (process.env.ENABLE_MEMBERS_INTENT === 'true') {
  intents.push(GatewayIntentBits.GuildMembers);
}

const client = new Client({
  intents,
  partials: [Partials.Message, Partials.Channel],
});

const TICKET_PREFIX = 'ticket-';

// Only these user IDs may use /dm and /alert (no role checks).
const OWNER_IDS = (process.env.BOT_OWNER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

function configFor(guildId) {
  return guildConfig.get(guildId, {
    supportRoles: config.ids.supportRoles,
    logChannel: config.ids.logChannel,
    categories: config.ticketCategories,
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function fill(text, vars) {
  if (text === undefined || text === null) return '';
  let out = String(text);
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(String(value ?? ''));
  }
  return out;
}

function dateVars(date = new Date()) {
  const d = String(date.getDate());
  const m = String(date.getMonth() + 1);
  const y = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return {
    date: `${d}.${m}.${y}`,
    time: `${hh}:${mm}`,
    timestamp: `${d}.${m}.${y} - ${hh}:${mm}`,
  };
}

function makeEmbed({ title, description, color, footerText, showTimestamp, vars }) {
  const embed = new EmbedBuilder().setColor(color || '#5865F2');

  if (title) embed.setTitle(fill(title, vars));
  if (description) embed.setDescription(fill(description, vars));

  let footer = footerText ? fill(footerText, vars) : '';
  if (showTimestamp) {
    const stamp = dateVars().timestamp;
    footer = footer ? `${footer} - ${stamp}` : stamp;
  }
  if (footer) embed.setFooter({ text: footer });

  return embed;
}

// Shared by the real join event and /test so the preview matches exactly.
function buildWelcomeEmbed(user, guild) {
  return new EmbedBuilder()
    .setColor(config.colors.welcome)
    .setTitle(fill(config.memberWelcome.title, { guild: guild.name }))
    .setDescription(
      fill(config.memberWelcome.text, {
        user: `<@${user.id}>`,
        guild: guild.name,
        count: guild.memberCount,
      })
    )
    .setImage(user.displayAvatarURL({ size: 4096, extension: 'png' }));
}

// Turns plain text into a normal Discord message — like a person typed it.
// No embed, no banner title, no divider, no bot footer. Bold only for real
// headings, simple bullets, original wording kept intact.
const BEAUTIFY_EMOJIS = [
  [/(ברוכים|welcome|היי|שלום|hello)/i, '🎉'],
  [/(אזהרה|חשוב|שים לב|warning|alert|critical)/i, '⚠️'],
  [/(עזרה|תמיכה|help|support)/i, '🆘'],
  [/(טיקט|ticket)/i, '🎫'],
  [/(אימות|verify| verified)/i, '✅'],
  [/(כללים|חוקים|rules)/i, '📜'],
  [/(מידע|info|information|הודעה)/i, 'ℹ️'],
  [/(פרס|הטבה|reward|giveaway|מבצע)/i, '🎁'],
  [/(פגישה|ישיבה|meeting|אירוע|event)/i, '📅'],
  [/(הערה|note|טיפ|tip)/i, '📌'],
  [/(שאלה|question|בעיה|problem|באג|bug)/i, '❓'],
  [/(כסף|מחיר|price|תשלום|payment)/i, '💰'],
  [/(קישור|link|כאן|לחצו)/i, '🔗'],
  [/(צהריים|ערב|בוקר|לילה)/i, '🌙'],
];

function beautifyEmoji(text) {
  if (/\p{Extended_Pictographic}/u.test(text)) return '';
  for (const [pattern, emoji] of BEAUTIFY_EMOJIS) {
    if (pattern.test(text)) return emoji;
  }
  return '';
}

function buildBeautifiedText(rawText, customTitle) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const isHeading = (line) => {
    if (/^([-*•]|\d+[.)])\s+/.test(line)) return false;
    if (/^#{1,6}\s+/.test(line)) return true;
    if (line.endsWith(':') && line.length <= 60) return true;
    if (line.length <= 45 && /[A-Z]/.test(line) && line === line.toUpperCase()) return true;
    return false;
  };
  const cleanHeading = (line) => line.replace(/^#{1,6}\s+/, '').replace(/:$/, '').trim();

  let firstHeading = '';
  const body = [];

  for (const line of lines) {
    if (isHeading(line)) {
      const heading = cleanHeading(line);
      if (!firstHeading) firstHeading = heading;
      body.push(`**${heading}**`);
      continue;
    }

    const bullet = /^([-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (bullet) {
      body.push(`• ${bullet[2]}`);
    } else {
      body.push(line);
    }
  }

  const out = [];
  const title = (customTitle || firstHeading).trim();
  if (title) {
    const emoji = beautifyEmoji(title);
    out.push(`**${emoji ? `${emoji} ` : ''}${title}**`);
    // Don't repeat the same heading twice when it was used as the title.
    if (firstHeading && title === firstHeading && body[0] === `**${firstHeading}**`) {
      body.shift();
    }
  }

  out.push(...body);
  return out.join('\n').slice(0, 1900);
}

/**
 * Build the main ticket embed for a channel using the LATEST saved settings.
 * Used both when a ticket is created and when settings are edited live.
 */
function ticketMainEmbed(channel, guildCfg) {
  const meta = getMeta(channel);
  const number = ticketNumber(channel);
  const vars = {
    ...dateVars(),
    number,
    user: meta.creator ? `<@${meta.creator}>` : '',
    count: 1,
  };

  // Per-ticket overrides (set with /ticket-edit) win over server defaults.
  const override = ticketConfig.get(channel.id);

  let embed;
  if (meta.status === 'claimed') {
    // Keep the "claimed" look when refreshing an already-claimed ticket.
    embed = makeEmbed({
      title: override.title || config.claimed.title,
      description: override.description || config.claimed.description,
      color: config.colors.claimed,
      footerText: config.claimed.footerText,
      showTimestamp: config.ticket.showTimestamp,
      vars: { ...vars, staff: meta.staff ? `<@${meta.staff}>` : '' },
    });
  } else {
    embed = makeEmbed({
      title: override.title || guildCfg.ticketTitle || config.ticket.title,
      description:
        override.description || guildCfg.ticketDescription || config.ticket.description,
      color: config.colors.open,
      footerText: config.ticket.footerText,
      showTimestamp: config.ticket.showTimestamp,
      vars,
    });
  }

  if (guildCfg.imageUrl) embed.setImage(guildCfg.imageUrl);
  return embed;
}

/**
 * Rebuild the main embed in every open ticket channel of a guild.
 */
async function refreshOneTicket(channel, guildCfg) {
  const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (!messages) return false;

  const main = messages.find(
    (m) =>
      m.author.id === client.user.id &&
      m.components.some((row) => row.components.some((c) => c.customId === 'ticket_close'))
  );
  if (!main) return false;

  await main.edit({ embeds: [ticketMainEmbed(channel, guildCfg)] });
  return true;
}

async function refreshTicketEmbeds(guild, guildCfg) {
  const channels = [...guild.channels.cache.values()].filter(
    (ch) => ch.type === ChannelType.GuildText && /^ticket-\d+/.test(ch.name || '')
  );

  let updated = 0;
  for (const channel of channels) {
    try {
      if (await refreshOneTicket(channel, guildCfg)) updated++;
    } catch (err) {
      console.error(`[sync] ticket ${channel.id}: ${err.message}`);
    }
  }
  return updated;
}

/**
 * Apply saved panel title/description/image to every bot panel message in a guild.
 */
async function refreshPanelEmbeds(guild, guildCfg) {
  const channels = [...guild.channels.cache.values()].filter(
    (ch) => ch.type === ChannelType.GuildText
  );

  let updated = 0;
  for (const channel of channels) {
    try {
      const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
      if (!messages) continue;

      const panels = messages.filter(
        (m) =>
          m.author.id === client.user.id &&
          m.components.some((row) =>
            row.components.some((c) => c.customId === 'ticket_create')
          )
      );

      for (const panel of panels.values()) {
        if (!panel.embeds[0]) continue;
        const embed = EmbedBuilder.from(panel.embeds[0]);
        if (guildCfg.panelTitle) embed.setTitle(fill(guildCfg.panelTitle, dateVars()));
        if (guildCfg.panelDescription) {
          embed.setDescription(fill(guildCfg.panelDescription, dateVars()));
        }
        if (guildCfg.imageUrl) embed.setImage(guildCfg.imageUrl);
        else embed.setImage(null);
        await panel.edit({ embeds: [embed] });
        updated++;
      }
    } catch (err) {
      // Ignore channels the bot cannot read.
    }
  }
  return updated;
}

async function updatePanelText(interaction, gid) {
  const title = interaction.options.getString('title');
  const description = interaction.options.getString('description');
  if (!title && !description) {
    return reply(interaction, { content: '⚠️ יש לציין כותרת או תיאור.' });
  }

  const values = {};
  if (title) values.panelTitle = title;
  if (description) values.panelDescription = description;
  guildConfig.set(gid, values);

  const updated = await refreshPanelEmbeds(interaction.guild, configFor(gid));
  return reply(interaction, {
    content:
      `✅ הודעת הפאנל (המקום שפותח טיקט) עודכנה. ` +
      (updated ? `השינוי הוחל מיידית על ${updated} פאנלים.` : 'לא נמצאו פאנלים לעדכון.'),
  });
}

function ticketButtons({ claimed = false } = {}) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel(config.ticket.claimButton)
      .setEmoji(config.ticket.claimEmoji)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(claimed),
    new ButtonBuilder()
      .setCustomId('ticket_rename')
      .setLabel(config.ticket.renameButton)
      .setEmoji(config.ticket.renameEmoji)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel(config.ticket.closeButton)
      .setEmoji(config.ticket.closeEmoji)
      .setStyle(ButtonStyle.Danger)
  );
  return row;
}

function verifyPanel(guildId) {
  const embed = makeEmbed({
    title: config.verify.title,
    description: config.verify.description,
    color: config.colors.panel,
    footerText: '',
    showTimestamp: false,
    vars: {},
  });

  // One click: grant the verified role and remove the unverified role.
  // No OAuth / external site involved.
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel(config.verify.buttonLabel)
      .setEmoji(config.verify.buttonEmoji)
      .setStyle(ButtonStyle.Success)
  );

  return { embed, row };
}

function withAuthorizeNote(guildId, userId, text) {
  if (!oauthServer.enabled()) return text;
  const link = oauthServer.authorizeUrl(guildId, userId);
  return `${text}\n\n${fill(config.verify.authorizeNote, { link })}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Return a usable access token, refreshing it first when needed.
async function validAccessToken(entry) {
  const freshEnough = entry.expiresAt && entry.expiresAt > Date.now() + 60 * 1000;
  if (freshEnough && entry.accessToken) return entry.accessToken;
  if (!entry.refreshToken) return null;

  try {
    const fresh = await oauthServer.refreshToken(entry.refreshToken);
    oauth.set(entry.userId, {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token || entry.refreshToken,
      expiresAt: Date.now() + (fresh.expires_in || 604800) * 1000,
    });
    return fresh.access_token;
  } catch (err) {
    console.error('[oauth] refresh:', err.message);
    return null;
  }
}

// Add every authorized user to one guild. Shared by /verify-add and /auth-add-all.
async function addAuthorizedToGuild(guild) {
  const authorized = oauth.list();
  const stats = { added: 0, existing: 0, failed: 0, skipped: 0 };
  if (!authorized.length) return stats;

  const roleId = configFor(guild.id).verifyRoleId;

  for (const entry of authorized) {
    const token = await validAccessToken(entry);
    if (!token) {
      stats.skipped++;
      continue;
    }

    let status = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `https://discord.com/api/v10/guilds/${guild.id}/members/${entry.userId}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ access_token: token }),
          }
        );
        status = res.status;
        if (status === 429) {
          const body = await res.json().catch(() => ({}));
          await sleep(Math.ceil((body.retry_after || 1) * 1000));
          continue;
        }
        break;
      } catch (err) {
        console.error('[verify-add] add:', err.message);
        break;
      }
    }

    if (status === 201) {
      stats.added++;
    } else if (status === 204 || status === 200) {
      stats.existing++;
    } else {
      stats.failed++;
      continue;
    }

    if (roleId) {
      await fetch(
        `https://discord.com/api/v10/guilds/${guild.id}/members/${entry.userId}/roles/${roleId}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
            'Content-Type': 'application/json',
            'X-Audit-Log-Reason': 'Verify add',
          },
          body: '{}',
        }
      ).catch(() => {});
    }

    await sleep(250);
  }

  return stats;
}

async function saveProfile(guildId, user) {
  const u = await client.users.fetch(user.id).catch(() => null);
  if (!u) return;

  const banner =
    typeof u.bannerURL === 'function'
      ? u.bannerURL({ size: 512 })
      : u.banner
        ? `https://cdn.discordapp.com/banners/${u.id}/${u.banner}?size=512`
        : null;

  profiles.set(guildId, u.id, {
    username: u.username,
    globalName: u.globalName || null,
    avatar: typeof u.displayAvatarURL === 'function' ? u.displayAvatarURL({ size: 256 }) : null,
    banner,
    accentColor: u.accentColor || null,
    verifiedAt: new Date().toISOString(),
  });
}

function getMeta(channel) {
  const topic = channel.topic || '';
  return {
    creator: (/creator:(\d+)/.exec(topic) || [])[1],
    staff: (/staff:(\d+)/.exec(topic) || [])[1],
    status: (/status:(\w+)/.exec(topic) || [])[1] || 'open',
  };
}

async function setMeta(channel, meta) {
  const parts = [`creator:${meta.creator || ''}`, `status:${meta.status || 'open'}`];
  if (meta.staff) parts.push(`staff:${meta.staff}`);
  await channel.setTopic(parts.join('|'), { reason: 'Ticket status updated' });
}

function ticketNumber(channel) {
  const match = /^ticket-(\d+)/.exec(channel.name || '');
  return match ? match[1] : '????';
}

function isTicketChannel(channel) {
  return channel && channel.type === ChannelType.GuildText && /^ticket-\d+/.test(channel.name || '');
}

function isSupport(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  return configFor(member.guild.id).supportRoles.some((id) => member.roles.cache.has(id));
}

async function reply(interaction, options) {
  const payload = { ephemeral: true, ...options };
  if (interaction.replied || interaction.deferred) {
    return interaction.followUp(payload);
  }
  return interaction.reply(payload);
}

/**
 * Send a single DM to a specific user by ID/mention.
 * Used by /dm and /alert — only the embed style/text differs.
 */
async function dmSpecificUser(interaction, settings) {
  if (!OWNER_IDS.includes(interaction.user.id)) {
    return reply(interaction, { content: settings.notAllowed });
  }

  const rawUser = interaction.options.getString('user', true).trim();
  const text = interaction.options.getString('message', true);
  const userId = rawUser.replace(/^<@!?(\d+)>$/, '$1');

  if (!/^\d{17,20}$/.test(userId)) {
    return reply(interaction, { content: settings.invalidUser });
  }
  if (userId === interaction.user.id) {
    return reply(interaction, { content: settings.self });
  }

  await interaction.deferReply({ ephemeral: true });

  let target;
  try {
    target = await client.users.fetch(userId);
  } catch {
    return interaction.editReply({ content: settings.notFound });
  }

  const embed = makeEmbed({
    title: settings.title,
    description: text,
    color: settings.color || config.colors.panel,
    footerText: settings.footer,
    showTimestamp: false,
    vars: {},
  });

  try {
    await target.send({ embeds: [embed] });
    return interaction.editReply({
      content: fill(settings.done, { user: `<@${target.id}>` }),
    });
  } catch (error) {
    console.error('[user-message] Failed to send:', error.message);
    return interaction.editReply({
      content: fill(settings.failed, { user: `<@${target.id}>` }),
    });
  }
}

/* ------------------------------------------------------------------ */
/* Ticket creation                                                     */
/* ------------------------------------------------------------------ */

async function createTicket(interaction, ticketCategory) {
  const { guild, user } = interaction;

  let category = null;
  const configuredCategoryId = ticketCategory?.categoryId || (!ticketCategory ? config.ids.category : '');
  if (configuredCategoryId) {
    category = await guild.channels.fetch(configuredCategoryId).catch(() => null);
  }

  // On a new server the configured ID won't exist — find or create the category by name.
  if (!category || category.type !== ChannelType.GuildCategory) {
    const wantedName = ticketCategory?.label || 'TICKETS';
    category =
      guild.channels.cache.find(
        (ch) => ch.type === ChannelType.GuildCategory && ch.name === wantedName
      ) || null;

    if (!category) {
      category = await guild.channels
        .create({ name: wantedName, type: ChannelType.GuildCategory, reason: 'Ticket category' })
        .catch(() => null);
    }
  }

  if (!category) {
    return reply(interaction, { content: '⚠️ לא ניתן ליצור את קטגוריית הטיקטים.' });
  }

  const existing = guild.channels.cache.find(
    (ch) =>
      ch.type === ChannelType.GuildText &&
      ch.name.startsWith(TICKET_PREFIX) &&
      (ch.topic || '').includes(`creator:${user.id}`)
  );

  if (existing) {
    return reply(interaction, {
      content: fill(config.ticket.duplicateReply, { channel: existing.id, user: `<@${user.id}>` }),
    });
  }

  const numbers = guild.channels.cache
    .map((ch) => /^ticket-(\d+)/.exec(ch.name || ''))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  const number = String(next).padStart(config.numberPadding, '0');

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.AddReactions,
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
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  const guildCfg = configFor(guild.id);

  for (const roleId of guildCfg.supportRoles) {
    if (guild.roles.cache.has(roleId)) {
      overwrites.push({
        id: roleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.AddReactions,
        ],
      });
    }
  }

  const channel = await guild.channels.create({
    name: fill(config.channelName, {
      number,
      username: user.username
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 20),
    }),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `creator:${user.id}|status:open|category:${ticketCategory?.value || 'default'}`,
    permissionOverwrites: overwrites,
    reason: `Ticket #${number} opened by ${user.tag}`,
  });

  const vars = {
    ...dateVars(),
    number,
    user: `<@${user.id}>`,
    username: user.username,
    count: 1,
  };

  const embed = ticketMainEmbed(channel, guildCfg);

  const mentionRoles = guildCfg.supportRoles
    .filter((id) => guild.roles.cache.has(id))
    .map((id) => `<@&${id}>`)
    .join(' ');

  await channel.send({
    content: `<@${user.id}>${mentionRoles ? ` ${mentionRoles}` : ''}`,
    embeds: [embed],
    components: [ticketButtons()],
  });

  // הודעת ברכה נפרדת (רק אם הוגדרה בשרת הזה)
  if (guildCfg.welcomeText) {
    const welcomeEmbed = makeEmbed({
      title: 'ברוכים הבאים לטיקט! 👋',
      description: guildCfg.welcomeText,
      color: config.colors.welcome,
      footerText: '',
      showTimestamp: false,
      vars,
    });
    await channel.send({ embeds: [welcomeEmbed] });
  }

  await reply(interaction, {
    content: fill(config.ticket.successReply, {
      channel: channel.id,
      user: `<@${user.id}>`,
      number,
    }),
  });

  console.log(`[ticket] Created #${number} (${channel.id}) for ${user.tag}`);
}

/* ------------------------------------------------------------------ */
/* Claim                                                               */
/* ------------------------------------------------------------------ */

async function claimTicket(interaction) {
  await interaction.deferReply({ ephemeral: true }).catch(() => {});
  if (!isSupport(interaction.member)) {
    return reply(interaction, { content: config.claimed.notStaff });
  }

  const channel = interaction.channel;
  const meta = getMeta(channel);
  const number = ticketNumber(channel);

  if (meta.status === 'claimed') {
    return reply(interaction, {
      content: fill(config.claimed.alreadyClaimed, {
        staff: meta.staff ? `<@${meta.staff}>` : 'someone',
      }),
    });
  }

  await setMeta(channel, { ...meta, status: 'claimed', staff: interaction.user.id });

  const embed = ticketMainEmbed(channel, configFor(interaction.guild.id));

  await interaction.message.edit({
    embeds: [embed],
    components: [ticketButtons({ claimed: true })],
  });

  await reply(interaction, {
    content: fill(config.claimed.reply, { number }),
  });
}

/* ------------------------------------------------------------------ */
/* Rename (MOD only)                                                    */
/* ------------------------------------------------------------------ */

async function openRenameModal(interaction) {
  if (!isSupport(interaction.member)) {
    return reply(interaction, { content: config.rename.notMod });
  }

  const modal = new ModalBuilder()
    .setCustomId('ticket_rename_modal')
    .setTitle(config.rename.modalTitle)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('ticket_new_name')
          .setLabel(config.rename.inputLabel)
          .setPlaceholder(config.rename.inputPlaceholder)
          .setStyle(TextInputStyle.Short)
          .setMinLength(1)
          .setMaxLength(40)
          .setRequired(true)
      )
    );

  await interaction.showModal(modal);
}

async function applyRename(interaction) {
  const raw = interaction.fields.getTextInputValue('ticket_new_name') || '';
  const number = ticketNumber(interaction.channel);
  const clean = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'ticket';

  await interaction.channel.setName(`ticket-${number}-${clean}`, {
    reason: `Renamed by ${interaction.user.tag}`,
  });

  await reply(interaction, { content: fill(config.rename.reply, { name: clean }) });
}

/* ------------------------------------------------------------------ */
/* Close                                                               */
/* ------------------------------------------------------------------ */

async function askCloseConfirmation(interaction) {
  const channel = interaction.channel;

  if (!isTicketChannel(channel)) {
    return reply(interaction, { content: '⚠️ אפשר להשתמש בפקודה הזו רק בתוך ערוץ טיקט.' });
  }

  const meta = getMeta(channel);
  const allowed =
    isSupport(interaction.member) ||
    (config.close.creatorCanClose && meta.creator === interaction.user.id);
  if (!allowed) {
    return reply(interaction, { content: config.close.notAllowed });
  }

  const number = ticketNumber(channel);
  const vars = { ...dateVars(), number, user: `<@${interaction.user.id}>` };

  const embed = new EmbedBuilder()
    .setColor(config.colors.closed)
    .setTitle(fill(config.close.confirmTitle, vars))
    .setDescription(fill(config.close.confirmDescription, vars))
    .setFooter({ text: dateVars().timestamp });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close_confirm')
      .setLabel(config.close.confirmButton)
      .setEmoji('✅')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_close_cancel')
      .setLabel(config.close.cancelButton)
      .setStyle(ButtonStyle.Secondary)
  );

  await reply(interaction, { embeds: [embed], components: [row] });
}

async function closeTicket(interaction) {
  const channel = interaction.channel;
  if (!isTicketChannel(channel)) {
    return reply(interaction, { content: '⚠️ זה אינו ערוץ טיקט.' });
  }

  const meta = getMeta(channel);
  const number = ticketNumber(channel);
  const staffVars = { ...dateVars(), number, staff: `<@${interaction.user.id}>` };

  await interaction.update({
    content: fill(config.close.closingMessage, staffVars),
    embeds: [],
    components: [],
  });

  // Build transcript
  const messages = [];
  let before;
  while (messages.length < config.transcriptLimit) {
    const batch = await channel.messages.fetch({
      limit: Math.min(100, config.transcriptLimit - messages.length),
      ...(before ? { before } : {}),
    });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }

  const transcript = messages
    .reverse()
    .map((m) => {
      const ts = m.createdAt.toISOString().replace('T', ' ').slice(0, 19);
      let content = m.content || '';
      if (m.embeds.length) {
        const titles = m.embeds.map((e) => e.title || 'Embed').join(', ');
        content += `${content ? '\n' : ''}[embed: ${titles}]`;
      }
      if (m.attachments.size) {
        const names = [...m.attachments.values()].map((a) => a.name).join(', ');
        content += `${content ? '\n' : ''}[attachments: ${names}]`;
      }
      return `[${ts}] ${m.author.tag}: ${content}`;
    })
    .join('\n');

  const vars = {
    ...dateVars(),
    number,
    user: meta.creator ? `<@${meta.creator}>` : 'unknown',
    username: meta.creator ? (await client.users.fetch(meta.creator).catch(() => null))?.username || 'unknown' : 'unknown',
    staff: `<@${interaction.user.id}>`,
  };

  // Log transcript
  const logChannelId = configFor(interaction.guild.id).logChannel;
  if (logChannelId) {
    const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      const logEmbed = makeEmbed({
        title: config.log.title,
        description: config.log.description,
        color: config.colors.log,
        footerText: config.log.footer,
        showTimestamp: true,
        vars,
      });
      const file = new AttachmentBuilder(Buffer.from(transcript || '(no messages)', 'utf8'), {
        name: fill(config.log.fileName, vars),
      });
      await logChannel.send({ embeds: [logEmbed], files: [file] }).catch((err) =>
        console.error('[ticket] Failed to send transcript log:', err.message)
      );
    }
  }

  // DM creator — no server name included
  if (meta.creator) {
    const creator = await client.users.fetch(meta.creator).catch(() => null);
    if (creator) {
      const dmEmbed = makeEmbed({
        title: config.dm.title,
        description: config.dm.description,
        color: config.colors.closed,
        footerText: config.dm.footer,
        showTimestamp: config.ticket.showTimestamp,
        vars,
      });
      await creator.send({ embeds: [dmEmbed] }).catch(() => {
        channel.send(config.dm.failureNote).catch(() => {});
      });
    }
  }

  await channel.delete(`Ticket #${number} closed by ${interaction.user.tag}`).catch((err) =>
    console.error('[ticket] Failed to delete channel:', err.message)
  );
  ticketConfig.remove(channel.id);

  console.log(`[ticket] Closed #${number} by ${interaction.user.tag}`);
}

/* ------------------------------------------------------------------ */
/* Giveaways                                                           */
/* ------------------------------------------------------------------ */

function giveawayEmbed(g) {
  const count = (g.entrants || []).length;
  const roleLine = g.roleId ? `\n🎭 דרישה: <@&${g.roleId}>` : '';
  return new EmbedBuilder()
    .setColor(config.giveaway.color)
    .setTitle(g.ended ? `🎉 ${g.prize} — הסתיים` : `🎉 ${g.prize}`)
    .setDescription(
      g.ended
        ? `👥 משתתפים: **${count}**\n🏆 זוכים: **${g.winners}**`
        : `לחצו על הכפתור כדי להיכנס!\n\n👥 משתתפים: **${count}**\n🏆 זוכים: **${g.winners}**\n⏰ מסתיים: <t:${Math.floor(g.endsAt / 1000)}:R>${roleLine}`
    )
    .setFooter({ text: `מארח: ${g.hostTag || 'יוצר השרת'}` })
    .setTimestamp();
}

function giveawayComponents(g) {
  if (g.ended) return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_enter:${g.id}`)
        .setLabel(config.giveaway.button)
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

async function refreshGiveawayMessage(g) {
  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(g.messageId).catch(() => null);
  if (!message) return;
  try {
    await message.edit({ embeds: [giveawayEmbed(g)], components: giveawayComponents(g) });
  } catch {
    /* message may be gone */
  }
}

async function endGiveaway(id) {
  const g = giveaways.get(id);
  if (!g || g.ended) return;

  const winners = pickWinners(g.entrants || [], g.winners || 1);
  giveaways.set(id, { ended: true, endedAt: Date.now(), winners });

  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(g.messageId).catch(() => null);
  const ended = { ...g, ended: true, winners };
  if (message) {
    try {
      await message.edit({ embeds: [giveawayEmbed(ended)], components: [] });
    } catch {
      /* message may be gone */
    }
  }

  const text = winners.length
    ? config.giveaway.winners.replace('{winners}', winners.map((w) => `<@${w}>`).join(', '))
    : config.giveaway.noEntries;

  try {
    await channel.send({ content: text, allowedMentions: { parse: [] } });
  } catch {
    /* no permission */
  }
}

async function restoreGiveaways() {
  for (const g of Object.values(giveaways.all())) {
    if (g.ended) continue;
    const ms = Number(g.endsAt) - Date.now();
    if (ms <= 0) {
      await endGiveaway(g.id);
    } else {
      setTimeout(() => endGiveaway(g.id), ms);
    }
  }
}

async function createGiveaway(interaction) {
  const prize = interaction.options.getString('prize', true).trim();
  const minutes = interaction.options.getInteger('duration', true);
  const winners = interaction.options.getInteger('winners') || 1;
  const channel = interaction.options.getChannel('channel') || interaction.channel;
  const role = interaction.options.getRole('role');

  if (!channel?.isTextBased()) {
    return reply(interaction, { content: '⚠️ צריך לבחור ערוץ טקסט.' });
  }

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
    hostId: interaction.user.id,
    hostTag: interaction.user.tag,
  };

  giveaways.set(id, g);

  let message;
  try {
    message = await channel.send({ embeds: [giveawayEmbed(g)], components: giveawayComponents(g) });
  } catch (err) {
    giveaways.remove(id);
    console.error('[giveaway] send:', err.message);
    return reply(interaction, { content: '❌ אין לי הרשאה לשלוח בערוץ הזה.' });
  }

  giveaways.set(id, { messageId: message.id });
  setTimeout(() => endGiveaway(id), minutes * 60_000);

  return reply(interaction, {
    content: `✅ ההגרלה נוצרה בערוץ <#${channel.id}>.\nמזהה הודעה: \`${message.id}\``,
  });
}

async function enterGiveaway(interaction) {
  const id = interaction.customId.slice('giveaway_enter:'.length);
  const g = giveaways.get(id);

  if (!g || g.ended) {
    return interaction.reply({ content: '⚠️ ההגרלה כבר הסתיימה.', ephemeral: true }).catch(() => {});
  }

  if (g.roleId && !interaction.member?.roles?.cache?.has(g.roleId)) {
    return interaction.reply({ content: config.giveaway.roleRequired, ephemeral: true }).catch(() => {});
  }

  const entrants = new Set(g.entrants || []);
  if (entrants.has(interaction.user.id)) {
    return interaction.reply({ content: config.giveaway.already, ephemeral: true }).catch(() => {});
  }

  entrants.add(interaction.user.id);
  giveaways.set(id, { entrants: [...entrants] });

  await interaction.reply({ content: config.giveaway.entered, ephemeral: true }).catch(() => {});
  await refreshGiveawayMessage({ ...g, entrants: [...entrants] });
}

async function giveawayByMessage(interaction) {
  const messageId = interaction.options.getString('id', true).trim();
  return Object.values(giveaways.all()).find(
    (g) => g.messageId === messageId && g.guildId === interaction.guild.id
  );
}

async function rerollGiveaway(interaction) {
  const g = await giveawayByMessage(interaction);
  if (!g) return reply(interaction, { content: '⚠️ לא נמצאה הגרלה עם המזהה הזה.' });

  const excluded = g.rerollWinners || [];
  const [winnerId] = pickWinners(g.entrants || [], 1, excluded);
  if (!winnerId) return reply(interaction, { content: config.giveaway.noReroll });

  giveaways.set(g.id, { rerollWinners: [...excluded, winnerId] });

  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (channel) {
    try {
      await channel.send({
        content: config.giveaway.rerollWinner.replace('{winner}', `<@${winnerId}>`),
        allowedMentions: { parse: [] },
      });
    } catch {
      /* no permission */
    }
  }

  return reply(interaction, {
    content: config.giveaway.rerollWinner.replace('{winner}', `<@${winnerId}>`),
  });
}

async function listGiveaways(interaction) {
  const open = Object.values(giveaways.all()).filter(
    (g) => g.guildId === interaction.guild.id && !g.ended
  );
  const lines = open.map(
    (g) =>
      `• **${g.prize}** — <#${g.channelId}> — \`${g.messageId}\` — <t:${Math.floor(g.endsAt / 1000)}:R>`
  );
  return reply(interaction, {
    content: lines.length ? `**הגרלות פתוחות:**\n${lines.join('\n')}` : 'אין הגרלות פתוחות כרגע.',
  });
}

/* ------------------------------------------------------------------ */
/* AutoMod — Discord-native link + NSFW rules                          */
/* ------------------------------------------------------------------ */

const AUTOMOD_ACTIONS = () => [
  { type: 1, metadata: {} }, // BLOCK_MESSAGE
  {
    type: 3, // TIMEOUT
    metadata: { duration_seconds: Math.floor(config.moderation.timeoutMs / 1000) },
  },
];

function automodRuleBody(name, triggerType, triggerMetadata, exemptRoles) {
  return {
    name,
    event_type: 1, // MESSAGE_SEND
    trigger_type: triggerType,
    trigger_metadata: triggerMetadata,
    actions: AUTOMOD_ACTIONS(),
    exempt_roles: exemptRoles,
    enabled: true,
  };
}

async function syncAutoModRules(guild) {
  const cfg = configFor(guild.id);
  const exempt = [...new Set([...(cfg.supportRoles || []), ...(config.ids.supportRoles || [])])]
    .filter((id) => guild.roles.cache.has(id));

  const desired = [
    automodRuleBody(
      config.moderation.linkRuleName,
      1, // KEYWORD — regex patterns match all links
      { keyword_filter: [], regex_patterns: config.moderation.linkRegex },
      exempt
    ),
    automodRuleBody(
      config.moderation.nsfwRuleName,
      1,
      { keyword_filter: config.moderation.nsfwKeywords, regex_patterns: [] },
      exempt
    ),
  ];

  let existing = [];
  try {
    existing = await client.rest.get(`/guilds/${guild.id}/auto-moderation/rules`);
  } catch (err) {
    console.error(`[automod] ${guild.id} list:`, err.rawError?.message || err.message);
    return;
  }

  for (const rule of desired) {
    const current = existing.find((r) => r.name === rule.name);
    try {
      if (current) {
        await client.rest.patch(`/guilds/${guild.id}/auto-moderation/rules/${current.id}`, { body: rule });
      } else {
        await client.rest.post(`/guilds/${guild.id}/auto-moderation/rules`, { body: rule });
      }
      console.log(`[automod] ${guild.id}: ${rule.name} ready`);
    } catch (err) {
      console.error(
        `[automod] ${guild.id} ${rule.name}:`,
        err.rawError?.message || err.message,
        err.rawError?.errors ? JSON.stringify(err.rawError.errors) : ''
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

// Start the HTTP server right away — /health must answer even if the Discord
// login fails, otherwise the host thinks the app is dead.
oauthServer.start(async (user, guildId) => {
  try {
    const roleId = configFor(guildId).verifyRoleId;
    if (!roleId) return;
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member && !member.roles.cache.has(roleId)) {
      await member.roles.add(roleId, 'Verified via OAuth2');
    }
  } catch (err) {
    console.error('[oauth] role:', err.message);
  }
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  await restoreGiveaways();
  console.log(`   Tickets category: ${config.ids.category || 'NOT SET'}`);
  console.log(`   Support roles: ${config.ids.supportRoles.join(', ') || 'NOT SET'}`);

  // On cloud hosts there is no terminal to run `npm run deploy` manually.
  if (process.env.AUTO_DEPLOY_COMMANDS === 'true') {
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, ['src/deploy-commands.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('error', (err) => console.error('[deploy]', err.message));
  }

  // Sync existing messages with the latest saved settings on every start.
  for (const guild of c.guilds.cache.values()) {
    try {
      const cfg = configFor(guild.id);
      const tickets = await refreshTicketEmbeds(guild, cfg);
      const panels = await refreshPanelEmbeds(guild, cfg);
      if (tickets || panels) {
        console.log(`[sync] ${guild.id}: tickets=${tickets} panels=${panels}`);
      }
      await syncAutoModRules(guild);
    } catch (err) {
      console.error(`[sync] ${guild.id}: ${err.message}`);
    }
  }
});

// Never let an unexpected async error take the whole bot down.
client.on(Events.Error, (err) => {
  console.error('[client error]', err?.message || err);
});

// Automatic welcome message with a large profile picture on member join.
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const gid = member.guild.id;
    const cfg = configFor(gid);

    // Give the new member the configured "unverified" / join role first.
    if (cfg.unverifiedRoleId && !member.roles.cache.has(cfg.unverifiedRoleId)) {
      const role =
        member.guild.roles.cache.get(cfg.unverifiedRoleId) ||
        (await member.guild.roles.fetch(cfg.unverifiedRoleId).catch(() => null));
      if (role) {
        try {
          await member.roles.add(role, 'Auto role on join');
        } catch (err) {
          console.error('[welcome] join role:', err.message);
        }
      }
    }

    const channelId = cfg.welcomeChannelId || member.guild.systemChannelId;
    if (!channelId) return;

    const channel =
      member.guild.channels.cache.get(channelId) ||
      (await member.guild.channels.fetch(channelId).catch(() => null));
    if (!channel || !channel.isTextBased() || channel.isDMBased()) return;

    await channel.send({ embeds: [buildWelcomeEmbed(member.user, member.guild)] });
    console.log(`[welcome] ${member.user.tag} joined ${member.guild.name} (#${member.guild.memberCount})`);
  } catch (err) {
    console.error('[welcome]', err.message);
  }
});

process.on('unhandledRejection', (err) => {
  console.error('[unhandled]', err?.message || err);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      switch (interaction.commandName) {
        case 'verify-setup': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת **ניהול ערוצים** כדי להשתמש בזה.' });
          }

          const gid = interaction.guild.id;
          const { embed, row } = verifyPanel(gid);
          try {
            await interaction.channel.send({ embeds: [embed], components: [row] });
          } catch (err) {
            return reply(interaction, {
              content:
                '⚠️ אין לי הרשאה לכתוב בערוץ הזה. ' +
                'פתחו הרשאות ערוץ → הוסיפו את הבוט → אשרו **הצגת ערוץ** ו**שליחת הודעות**.',
            });
          }
          guildConfig.set(gid, { verifyChannelId: interaction.channel.id });

          let roleNote = '';
          if (!configFor(gid).verifyRoleId) {
            const existing = interaction.guild.roles.cache.find(
              (r) => r.name === config.verify.roleName
            );
            const role =
              existing ||
              (await interaction.guild.roles
                .create({
                  name: config.verify.roleName,
                  color: config.verify.roleColor,
                  reason: 'Verification role',
                })
                .catch(() => null));
            if (role) {
              guildConfig.set(gid, { verifyRoleId: role.id });
              roleNote = `\nתפקיד האימות נוצר אוטומטית: <@&${role.id}>`;
            } else {
              roleNote = '\n⚠️ לא נוצר תפקיד אימות. הגדירו אותו עם `/verify-role`.';
            }
          }

          return reply(interaction, { content: config.verify.setupReply + roleNote });
        }

        case 'welcome-setup': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת **ניהול ערוצים** כדי להשתמש בזה.' });
          }
          guildConfig.set(interaction.guild.id, { welcomeChannelId: interaction.channel.id });

          const perms = interaction.channel.permissionsFor(client.user);
          const missing = [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
          ]
            .filter((bit) => !perms?.has(bit))
            .map((bit) =>
              bit === PermissionFlagsBits.ViewChannel
                ? 'צפייה בערוץ'
                : bit === PermissionFlagsBits.SendMessages
                ? 'שליחת הודעות'
                : 'הטמעת קישורים'
            );

          return reply(interaction, {
            content:
              config.memberWelcome.setupDone +
              (missing.length
                ? `\n\n⚠️ לבוט אין הרשאות בערוץ הזה: ${missing.join(', ')}. תנו לו אותן בהגדרות הערוץ.`
                : ''),
          });
        }

        case 'test': {
          if (
            !OWNER_IDS.includes(interaction.user.id) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
          ) {
            return reply(interaction, { content: config.auth.notAllowed });
          }

          const raw = (interaction.options.getString('user') || '').trim();
          const userId = raw.replace(/^<@!?(\d+)>$/, '$1');
          let user = interaction.user;
          if (userId) {
            if (!/^\d{17,20}$/.test(userId)) {
              return reply(interaction, { content: config.auth.invalidUser });
            }
            user = (await client.users.fetch(userId).catch(() => null)) || interaction.user;
          }

          return interaction.reply({
            embeds: [buildWelcomeEmbed(user, interaction.guild)],
            ephemeral: false,
          });
        }

        case 'giveaway': {
          const sub = interaction.options.getSubcommand();
          if (sub === 'start') return await createGiveaway(interaction);
          if (sub === 'end') {
            const g = await giveawayByMessage(interaction);
            if (!g) return reply(interaction, { content: '⚠️ לא נמצאה הגרלה עם המזהה הזה.' });
            await endGiveaway(g.id);
            return reply(interaction, { content: '✅ ההגרלה נסגרה.' });
          }
          if (sub === 'reroll') return await rerollGiveaway(interaction);
          if (sub === 'list') return await listGiveaways(interaction);
          return reply(interaction, { content: '⚠️ פעולה לא מוכרת.' });
        }

        case 'beautify':
        case 'betifuel': {
          if (
            !OWNER_IDS.includes(interaction.user.id) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)
          ) {
            return reply(interaction, { content: config.auth.notAllowed });
          }

          const text = (interaction.options.getString('text', true) || '').trim();
          if (!text) return reply(interaction, { content: config.beautify.empty });

          const title = (interaction.options.getString('title') || '').trim();
          return interaction.reply({
            content: buildBeautifiedText(text, title),
            allowedMentions: { parse: [] },
            ephemeral: false,
          });
        }

        case 'verify-role': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת ניהול שרת.' });
          }

          const gid = interaction.guild.id;
          const chosen = interaction.options.getRole('role');
          const role =
            chosen ||
            (await interaction.guild.roles
              .create({
                name: config.verify.roleName,
                color: config.verify.roleColor,
                reason: 'Verification role',
              })
              .catch(() => null));

          if (!role) {
            return reply(interaction, {
              content: '⚠️ לא נוצר תפקיד. ודאו שלבוט יש הרשאת "ניהול תפקידים".',
            });
          }

          guildConfig.set(gid, { verifyRoleId: role.id });
          return reply(interaction, {
            content: `✅ תפקיד האימות בשרת הזה: <@&${role.id}>`,
          });
        }

        case 'verify-unverified':
        case 'join-role': {
          if (
            !OWNER_IDS.includes(interaction.user.id) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
          ) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת ניהול שרת.' });
          }

          const gid = interaction.guild.id;
          const chosen = interaction.options.getRole('role');
          const current = configFor(gid).unverifiedRoleId;

          if (interaction.options.getBoolean('clear')) {
            guildConfig.set(gid, { unverifiedRoleId: null });
            return reply(interaction, { content: config.verify.unverifiedCleared });
          }

          if (!chosen) {
            return reply(interaction, {
              content: current
                ? fill(config.verify.unverifiedCurrent, { role: current })
                : config.verify.unverifiedNone,
            });
          }

          guildConfig.set(gid, { unverifiedRoleId: chosen.id });
          return reply(interaction, {
            content: fill(config.verify.unverifiedSet, { role: chosen.id }),
          });
        }

        case 'verify-profiles': {
          if (!isSupport(interaction.member)) {
            return reply(interaction, { content: config.rename.notMod });
          }
          const list = profiles.list(interaction.guild.id);
          if (!list.length) {
            return reply(interaction, { content: 'אין עדיין פרופילים מאומתים.' });
          }
          const lines = list.slice(0, 20).map((p) => {
            const avatar = p.avatar ? ` [תמונה](${p.avatar})` : '';
            const banner = p.banner ? ` [באנר](${p.banner})` : '';
            return `<@${p.userId}> — **${p.username}**${p.globalName ? ` (${p.globalName})` : ''}${avatar}${banner}`;
          });
          return reply(interaction, {
            content: `**פרופילים מאומתים (${list.length}):**\n${lines.join('\n')}`,
          });
        }

        case 'verify-add': {
          if (
            !isSupport(interaction.member) &&
            !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
          ) {
            return reply(interaction, { content: config.verifyAdd.notAllowed });
          }
          if (!oauthServer.enabled()) {
            return reply(interaction, { content: config.verifyAdd.notConfigured });
          }

          await interaction.deferReply({ ephemeral: true });

          const targetId =
            interaction.options.getString('guild') ||
            process.env.VERIFY_ADD_GUILD_ID ||
            interaction.guild.id;
          const target =
            client.guilds.cache.get(targetId) ||
            (await client.guilds.fetch(targetId).catch(() => null));
          if (!target) {
            return interaction.editReply({ content: config.verifyAdd.noTarget });
          }

          const authorized = oauth.list();
          if (!authorized.length) {
            return interaction.editReply({ content: config.verifyAdd.none });
          }

          const stats = await addAuthorizedToGuild(target);

          return interaction.editReply({
            content: fill(config.verifyAdd.done, stats),
          });
        }

        case 'auth-list': {
          if (!OWNER_IDS.includes(interaction.user.id)) {
            return reply(interaction, { content: config.auth.notAllowed });
          }
          if (!oauthServer.enabled()) {
            return reply(interaction, { content: config.verifyAdd.notConfigured });
          }

          const entries = oauth.list();
          if (!entries.length) {
            return reply(interaction, { content: config.auth.empty });
          }

          const allProfiles = profiles.load();
          const lines = entries.slice(0, 25).map((e) => {
            const state = !e.accessToken
              ? config.auth.tokenMissing
              : e.expiresAt && e.expiresAt < Date.now()
                ? config.auth.tokenExpired
                : config.auth.tokenOk;
            const profileCount = Object.keys(allProfiles).filter((k) =>
              k.endsWith(`:${e.userId}`)
            ).length;
            const custom = Object.entries(allProfiles).find(
              ([k, v]) => k.endsWith(`:${e.userId}`) && v.customName
            )?.[1].customName;
            const when = e.authorizedAt
              ? new Date(e.authorizedAt).toLocaleDateString('he-IL')
              : '?';
            return `<@${e.userId}> — **${custom || e.globalName || e.username || '?'}** | ${state} | פרופילים: ${profileCount} | ${when}`;
          });

          return reply(interaction, {
            content: `${fill(config.auth.listTitle, { count: entries.length })}\n${lines.join('\n')}`,
          });
        }

        case 'auth-add-all': {
          if (!OWNER_IDS.includes(interaction.user.id)) {
            return reply(interaction, { content: config.auth.notAllowed });
          }
          if (!oauthServer.enabled()) {
            return reply(interaction, { content: config.verifyAdd.notConfigured });
          }
          if (!oauth.list().length) {
            return reply(interaction, { content: config.auth.empty });
          }

          await interaction.deferReply({ ephemeral: true });

          const guildId = interaction.options.getString('guild');
          let targets;
          if (guildId) {
            const g =
              client.guilds.cache.get(guildId) ||
              (await client.guilds.fetch(guildId).catch(() => null));
            if (!g) return interaction.editReply({ content: config.auth.noGuild });
            targets = [g];
          } else {
            targets = [...client.guilds.cache.values()];
          }
          if (!targets.length) return interaction.editReply({ content: config.auth.noGuilds });

          const stats = { added: 0, existing: 0, failed: 0, skipped: 0 };
          for (const g of targets) {
            const one = await addAuthorizedToGuild(g);
            stats.added += one.added;
            stats.existing += one.existing;
            stats.failed += one.failed;
            stats.skipped += one.skipped;
          }

          return interaction.editReply({
            content: fill(config.auth.addAllDone, { guilds: targets.length, ...stats }),
          });
        }

        case 'auth-nick': {
          if (!OWNER_IDS.includes(interaction.user.id)) {
            return reply(interaction, { content: config.auth.notAllowed });
          }

          const rawUser = interaction.options.getString('user', true).trim();
          const userId = rawUser.replace(/^<@!?(\d+)>$/, '$1');
          if (!/^\d{17,20}$/.test(userId)) {
            return reply(interaction, { content: config.auth.invalidUser });
          }
          if (!oauth.get(userId)) {
            return reply(interaction, { content: config.auth.notAuthorized });
          }

          const name = interaction.options.getString('name', true).trim();
          oauth.set(userId, { customName: name });
          await interaction.deferReply({ ephemeral: true });

          const guildId = interaction.options.getString('guild');
          let targets;
          if (guildId) {
            const g =
              client.guilds.cache.get(guildId) ||
              (await client.guilds.fetch(guildId).catch(() => null));
            if (!g) return interaction.editReply({ content: config.auth.noGuild });
            targets = [g];
          } else {
            targets = [...client.guilds.cache.values()];
          }
          if (!targets.length) return interaction.editReply({ content: config.auth.noGuilds });

          let updated = 0;
          let failed = 0;
          for (const g of targets) {
            try {
              const member = await g.members.fetch(userId).catch(() => null);
              if (member) await member.setNickname(name, 'Owner nickname change');
              profiles.set(g.id, userId, { customName: name, nickname: name });
              updated++;
            } catch (err) {
              console.error('[auth-nick]', g.id, err.message);
              failed++;
            }
          }

          return interaction.editReply({
            content: fill(config.auth.nickDone, { name, updated, failed }),
          });
        }

        case 'join-server': {
          if (!OWNER_IDS.includes(interaction.user.id)) {
            return reply(interaction, { content: config.joinServer.notAllowed });
          }

          const rawUser = interaction.options.getString('user', true).trim();
          const userId = rawUser.replace(/^<@!?(\d+)>$/, '$1');
          if (!/^\d{17,20}$/.test(userId)) {
            return reply(interaction, { content: config.joinServer.invalidUser });
          }
          if (userId === interaction.user.id) {
            return reply(interaction, { content: config.joinServer.self });
          }

          const invite = interaction.options.getString('invite')?.trim() || '';
          const guildId = (interaction.options.getString('guild') || '').replace(/\D/g, '');
          const extra = interaction.options.getString('message')?.trim() || '';

          if (!invite && !guildId) {
            return reply(interaction, { content: config.joinServer.needTarget });
          }

          await interaction.deferReply({ ephemeral: true });

          let target;
          try {
            target = await client.users.fetch(userId);
          } catch {
            return interaction.editReply({ content: config.joinServer.notFound });
          }

          // Direct add only works when the bot is already in the target server.
          if (guildId) {
            const guild =
              client.guilds.cache.get(guildId) ||
              (await client.guilds.fetch(guildId).catch(() => null));
            if (!guild) {
              return interaction.editReply({ content: config.joinServer.notInGuild });
            }

            const entry = oauth.get(userId);
            if (!entry) {
              return interaction.editReply({ content: config.joinServer.notAuthorized });
            }
            const token = await validAccessToken(entry);
            if (!token) {
              return interaction.editReply({ content: config.joinServer.noToken });
            }

            let status = 0;
            let errorText = '';
            try {
              const res = await fetch(
                `https://discord.com/api/v10/guilds/${guild.id}/members/${userId}`,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ access_token: token }),
                }
              );
              status = res.status;
              if (!res.ok) errorText = (await res.text()).slice(0, 200);
            } catch (err) {
              errorText = err.message;
            }

            if (status === 201 || status === 204 || status === 200) {
              const roleId = configFor(guild.id).verifyRoleId;
              if (roleId) {
                await fetch(
                  `https://discord.com/api/v10/guilds/${guild.id}/members/${userId}/roles/${roleId}`,
                  {
                    method: 'PUT',
                    headers: {
                      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
                      'Content-Type': 'application/json',
                    },
                    body: '{}',
                  }
                ).catch(() => {});
              }
              const key = status === 201 ? 'added' : 'already';
              return interaction.editReply({
                content: fill(config.joinServer[key], {
                  user: `<@${userId}>`,
                  guild: guild.name,
                }),
              });
            }

            if (invite) {
              // fall through to DM the invite below
            } else {
              return interaction.editReply({
                content: fill(config.joinServer.addFailed, {
                  user: `<@${userId}>`,
                  guild: guild.name,
                  error: errorText || `HTTP ${status}`,
                }),
              });
            }
          }

          // Invite path: works even when the bot is not in that server.
          let link = invite;
          if (!/^https?:\/\//i.test(link)) {
            link = `https://discord.gg/${link.replace(/^discord\.gg\//i, '')}`;
          }
          const text = ['לחצו כדי להצטרף לשרת:', link, extra].filter(Boolean).join('\n\n');
          const embed = makeEmbed({
            title: config.joinServer.title,
            description: text,
            color: config.colors.panel,
            footerText: '',
            showTimestamp: false,
            vars: {},
          });

          try {
            await target.send({ embeds: [embed] });
            return interaction.editReply({
              content: fill(config.joinServer.sent, { user: `<@${target.id}>` }),
            });
          } catch (error) {
            console.error('[join-server] DM failed:', error.message);
            return interaction.editReply({
              content: fill(config.joinServer.failed, { user: `<@${target.id}>` }),
            });
          }
        }

        case 'broadcast': {
          if (!isSupport(interaction.member)) {
            return reply(interaction, { content: config.broadcast.notAllowed });
          }
          const text = interaction.options.getString('message');
          const members = [...interaction.guild.members.cache.values()].filter(
            (m) => !m.user.bot
          );
          await interaction.deferReply({ ephemeral: true });

          const embed = makeEmbed({
            title: config.broadcast.title,
            description: text,
            color: config.colors.panel,
            footerText: config.broadcast.footer,
            showTimestamp: false,
            vars: {},
          });

          let sent = 0;
          let failed = 0;
          for (const member of members.slice(0, 500)) {
            try {
              await member.send({ embeds: [embed] });
              sent++;
            } catch {
              failed++;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          return interaction.editReply({
            content: fill(config.broadcast.done, { sent, failed }),
          });
        }

        case 'dm':
          return dmSpecificUser(interaction, config.dmUser);

        case 'alert':
          return dmSpecificUser(interaction, config.alertUser);

        case 'ticket-setup': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת **ניהול ערוצים** כדי להשתמש בזה.' });
          }

          const guildCfg = configFor(interaction.guild.id);
          const embed = makeEmbed({
            title: guildCfg.panelTitle || config.panel.title,
            description: guildCfg.panelDescription || config.panel.description,
            color: config.colors.panel,
            footerText: config.panel.footer,
            showTimestamp: false,
            vars: dateVars(),
          });
          if (guildCfg.imageUrl) embed.setImage(guildCfg.imageUrl);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_create')
              .setLabel(config.panel.buttonLabel)
              .setEmoji(config.panel.buttonEmoji)
              .setStyle(ButtonStyle.Primary)
          );

          await interaction.channel.send({ embeds: [embed], components: [row] });
          await reply(interaction, {
            content: fill(config.panel.reply, { user: `<@${interaction.user.id}>` }),
          });
          break;
        }

        case 'ticket-config': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת ניהול שרת.' });
          }

          const log = interaction.options.getChannel('log');
          if (!log) {
            return reply(interaction, { content: '⚠️ יש לציין ערוץ לוגים.' });
          }

          guildConfig.set(interaction.guild.id, { logChannel: log.id });
          return reply(interaction, {
            content: `✅ ערוץ הלוגים נשמר לשרת הזה: <#${log.id}>`,
          });
        }

        case 'ticket-roles': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת ניהול שרת.' });
          }

          const current = [...configFor(interaction.guild.id).supportRoles];
          const sub = interaction.options.getSubcommand();
          const role = interaction.options.getRole('role');

          if (sub === 'add') {
            if (!current.includes(role.id)) current.push(role.id);
            guildConfig.set(interaction.guild.id, { supportRoles: current });
            return reply(interaction, {
              content: `✅ הרול <@&${role.id}> נוסף. סה״כ ${current.length} רולים.`,
            });
          }

          if (sub === 'remove') {
            const next = current.filter((id) => id !== role.id);
            guildConfig.set(interaction.guild.id, { supportRoles: next });
            return reply(interaction, {
              content: `✅ הרול <@&${role.id}> הוסר. נותרו ${next.length} רולים.`,
            });
          }

          return reply(interaction, {
            content: current.length
              ? `**רולי צוות בשרת הזה (${current.length}):**\n${current.map((id) => `<@&${id}>`).join('\n')}`
              : 'אין עדיין רולי צוות. הוסיפו עם `/ticket-roles add`.',
          });
        }

        case 'ticket-panel': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת ניהול שרת.' });
          }
          return updatePanelText(interaction, interaction.guild.id);
        }

        case 'ticket-message': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת ניהול שרת.' });
          }

          const gid = interaction.guild.id;
          const current = configFor(gid);
          const sub = interaction.options.getSubcommand();

          if (sub === 'ticket') {
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            if (!title && !description) {
              return reply(interaction, { content: '⚠️ יש לציין כותרת או תיאור.' });
            }
            const values = {};
            if (title) values.ticketTitle = title;
            if (description) values.ticketDescription = description;
            guildConfig.set(gid, values);
            const updated = await refreshTicketEmbeds(interaction.guild, configFor(gid));
            return reply(interaction, {
              content:
                `✅ הודעת הטיקט עודכנה לשרת הזה. ` +
                (updated ? `השינוי הוחל מיידית על ${updated} טיקטים פתוחים.` : 'אין טיקטים פתוחים לעדכון.'),
            });
          }

          if (sub === 'welcome') {
            const text = interaction.options.getString('text');
            guildConfig.set(gid, { welcomeText: text });
            return reply(interaction, {
              content: '✅ הודעת הברכה עודכנה. היא תישלח כהודעה נפרדת בתוך כל טיקט חדש.',
            });
          }

          if (sub === 'panel') {
            return updatePanelText(interaction, gid);
          }

          if (sub === 'reset') {
            guildConfig.set(gid, {
              ticketTitle: null,
              ticketDescription: null,
              welcomeText: null,
              panelTitle: null,
              panelDescription: null,
              imageUrl: null,
            });
            const cfg = configFor(gid);
            const tickets = await refreshTicketEmbeds(interaction.guild, cfg);
            const panels = await refreshPanelEmbeds(interaction.guild, cfg);
            return reply(interaction, {
              content: `✅ הטקסטים והתמונה חזרו למקוריים. עודכנו ${tickets} טיקטים ו־${panels} פאנלים.`,
            });
          }

          const shownTitle = current.ticketTitle || config.ticket.title;
          const shownDesc = current.ticketDescription || config.ticket.description;
          const shownWelcome = current.welcomeText || '(לא הוגדרה — הברכה כלולה בהודעת הטיקט)';
          const shownPanelTitle = current.panelTitle || config.panel.title;
          const shownPanelDesc = current.panelDescription || config.panel.description;
          return reply(interaction, {
            content:
              `**פאנל — כותרת:** ${shownPanelTitle}\n` +
              `**פאנל — תיאור:** ${shownPanelDesc}\n\n` +
              `**טיקט — כותרת:** ${shownTitle}\n` +
              `**טיקט — תיאור:**\n${shownDesc}\n\n` +
              `**ברכה:**\n${shownWelcome}`,
          });
        }

        case 'ticket-category': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת ניהול שרת.' });
          }

          const gid = interaction.guild.id;
          const categories = [...configFor(gid).categories];
          const sub = interaction.options.getSubcommand();

          if (sub === 'add') {
            const name = interaction.options.getString('name');
            const description = interaction.options.getString('description') || '';
            const channel = interaction.options.getChannel('category');

            let value = name
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

            guildConfig.set(gid, { categories });
            return reply(interaction, {
              content: `✅ הקטגוריה **${name}** נוספה (ערך: \`${value}\`).\n` +
                (channel ? `תשתמש בקטגוריית דיסקורד: <#${channel.id}>` : 'קטגוריית דיסקורד תיווצר אוטומטית.'),
            });
          }

          if (sub === 'remove') {
            const value = interaction.options.getString('value');
            const next = categories.filter((c) => c.value !== value);
            guildConfig.set(gid, { categories: next });
            return reply(interaction, {
              content: `✅ הקטגוריה \`${value}\` הוסרה. נותרו ${next.length}.`,
            });
          }

          return reply(interaction, {
            content: categories.length
              ? `**קטגוריות בשרת הזה (${categories.length}):**\n` +
                categories.map((c) => `• ${c.label} — \`${c.value}\``).join('\n')
              : 'אין קטגוריות. הוסיפו עם `/ticket-category add`.',
          });
        }

        case 'ticket-image': {
          if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return reply(interaction, { content: '⚠️ נדרשת הרשאת ניהול שרת.' });
          }

          const gid = interaction.guild.id;
          const sub = interaction.options.getSubcommand();

          if (sub === 'remove') {
            guildConfig.set(gid, { imageUrl: null });
            const cfg = configFor(gid);
            const tickets = await refreshTicketEmbeds(interaction.guild, cfg);
            const panels = await refreshPanelEmbeds(interaction.guild, cfg);
            return reply(interaction, {
              content: `✅ התמונה הוסרה. עודכנו ${tickets} טיקטים ו־${panels} פאנלים.`,
            });
          }

          if (sub === 'preview') {
            const url = configFor(gid).imageUrl;
            return reply(interaction, {
              content: url ? `**התמונה הנוכחית:**\n${url}` : 'אין תמונה מוגדרת בשרת הזה.',
            });
          }

          const url =
            sub === 'url'
              ? interaction.options.getString('link')
              : interaction.options.getAttachment('image')?.url || null;

          if (!url || !/^https?:\/\//i.test(url)) {
            return reply(interaction, { content: '⚠️ יש לספק קובץ תמונה או קישור תקין.' });
          }

          guildConfig.set(gid, { imageUrl: url });
          const cfg = configFor(gid);
          const tickets = await refreshTicketEmbeds(interaction.guild, cfg);
          const panels = await refreshPanelEmbeds(interaction.guild, cfg);

          return reply(interaction, {
            content:
              `✅ התמונה נשמרה לשרת הזה. השינוי הוחל מיידית על ${tickets} טיקטים ו־${panels} פאנלים.`,
          });
        }

        case 'ticket-edit': {
          const channel = interaction.channel;
          if (!isTicketChannel(channel)) {
            return reply(interaction, {
              content: '⚠️ אפשר להשתמש בפקודה הזו רק בתוך ערוץ טיקט.',
            });
          }
          if (!isSupport(interaction.member)) {
            return reply(interaction, { content: config.rename.notMod });
          }

          if (interaction.options.getBoolean('reset')) {
            ticketConfig.remove(channel.id);
            await refreshOneTicket(channel, configFor(interaction.guild.id));
            return reply(interaction, {
              content: '✅ הכותרת והתיאור של הטיקט הזה חזרו להגדרות השרת.',
            });
          }

          const title = interaction.options.getString('title');
          const description = interaction.options.getString('description');
          if (!title && !description) {
            return reply(interaction, {
              content: '⚠️ יש לציין כותרת או תיאור (או `reset:true`).',
            });
          }

          const values = {};
          if (title) values.title = title;
          if (description) values.description = description;
          ticketConfig.set(channel.id, values);
          await refreshOneTicket(channel, configFor(interaction.guild.id));

          return reply(interaction, {
            content: '✅ הכותרת והתיאור של הטיקט הזה עודכנו מיידית.',
          });
        }

        case 'ticket-close':
          await askCloseConfirmation(interaction);
          break;

        case 'open-tickets': {
          if (!isSupport(interaction.member)) {
            return reply(interaction, { content: config.rename.notMod });
          }
          const tickets = interaction.guild.channels.cache
            .filter(
              (ch) =>
                ch.type === ChannelType.GuildText && /^ticket-\d+/.test(ch.name || '')
            )
            .map((ch) => `<#${ch.id}> — \`${ch.name}\``);

          return reply(interaction, {
            content: tickets.length
              ? `**טיקטים פתוחים (${tickets.length}):**\n${tickets.slice(0, 20).join('\n')}`
              : 'אין טיקטים פתוחים כרגע.',
          });
        }
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category_select') {
      const chosen = configFor(interaction.guild.id).categories.find(
        (c) => c.value === interaction.values[0]
      );
      if (!chosen) {
        return reply(interaction, { content: '⚠️ קטגוריה לא תקינה.' });
      }
      await interaction.update({
        content: '🎫 יוצר טיקט...',
        embeds: [],
        components: [],
      });
      await createTicket(interaction, chosen);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === 'ticket_rename_modal') {
      await applyRename(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith('giveaway_enter:')) {
      await enterGiveaway(interaction);
      return;
    }

    if (!interaction.isButton()) return;

    switch (interaction.customId) {
      case 'verify_button': {
        // Defer immediately — role + profile API calls can exceed Discord's 3s window.
        await interaction.deferReply({ ephemeral: true }).catch(() => {});

        const roleId = configFor(interaction.guild.id).verifyRoleId;
        if (!roleId) {
          return interaction.editReply({ content: config.verify.noRole }).catch(() => {});
        }

        if (interaction.member.roles.cache.has(roleId)) {
          return interaction.editReply({ content: config.verify.already }).catch(() => {});
        }

        const role =
          interaction.guild.roles.cache.get(roleId) ||
          (await interaction.guild.roles.fetch(roleId).catch(() => null));
        if (!role) {
          return interaction.editReply({ content: config.verify.noRole }).catch(() => {});
        }

        try {
          await interaction.member.roles.add(role, 'Verified via button');
        } catch (err) {
          console.error('[verify]', err.message);
          return interaction.editReply({ content: config.verify.failed }).catch(() => {});
        }

        // Remove the configured "unverified" role if present.
        let unverifiedNote = '';
        const unverifiedId = configFor(interaction.guild.id).unverifiedRoleId;
        if (unverifiedId && interaction.member.roles.cache.has(unverifiedId)) {
          try {
            await interaction.member.roles.remove(unverifiedId, 'Verified via button');
            unverifiedNote = fill(config.verify.unverifiedRemoved, { unverified: unverifiedId });
          } catch (err) {
            console.error('[verify] unverified role:', err.message);
          }
        }

        // Profile saving must never block or break the verification response.
        await saveProfile(interaction.guild.id, interaction.user).catch((err) =>
          console.error('[verify] profile:', err.message)
        );

        const success = fill(config.verify.success, { role: role.id, unverifiedNote });
        return interaction.editReply({ content: success }).catch(() => {});
      }

      case 'ticket_create': {
        const options = configFor(interaction.guild.id).categories.map((c) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(c.label)
            .setValue(c.value)
            .setDescription(c.description || 'בדיקה')
        );

        if (!options.length) {
          return reply(interaction, { content: '⚠️ לא הוגדרו קטגוריות לטיקטים.' });
        }

        const select = new StringSelectMenuBuilder()
          .setCustomId('ticket_category_select')
          .setPlaceholder('בחר קטגוריה')
          .addOptions(options);

        return reply(interaction, {
          content: 'בחר קטגוריה לטיקט:',
          components: [new ActionRowBuilder().addComponents(select)],
        });
      }
      case 'ticket_claim':
        await claimTicket(interaction);
        break;
      case 'ticket_rename':
        await openRenameModal(interaction);
        break;
      case 'ticket_close':
        await askCloseConfirmation(interaction);
        break;
      case 'ticket_close_cancel':
        await interaction.update({
          content: config.close.cancelled,
          embeds: [],
          components: [],
        });
        break;
      case 'ticket_close_confirm':
        await closeTicket(interaction);
        break;
    }
  } catch (error) {
    console.error('[ticket] Interaction error:', error);
    const message = '⚠️ אירעה שגיאה. נסו שוב.';
    try {
      if (interaction.isButton() && interaction.deferred) {
        await interaction.followUp({ content: message, ephemeral: true });
      } else {
        await reply(interaction, { content: message });
      }
    } catch (_) {
      /* interaction may already be gone */
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
