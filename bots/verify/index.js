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
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  Events,
  AttachmentBuilder,
} = require('discord.js');
const config = require('./config');
const { buildVerifyPanelCard } = require('./panelCard');

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

const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (process.env.ENABLE_MEMBERS_INTENT === 'true') intents.push(GatewayIntentBits.GuildMembers);

const client = new Client({ intents, partials: [Partials.Message, Partials.Channel] });

const commands = [
  new SlashCommandBuilder()
    .setName('verify-setup')
    .setDescription('הקמת פאנל אימות בערוץ הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('verify-role')
    .setDescription('הגדרת תפקיד מאומת')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((o) => o.setName('role').setDescription('התפקיד שיינתן אחרי האימות'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('join-role')
    .setDescription('הגדרת התפקיד שיינתן בהצטרפות ויוסר עם האימות')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((o) => o.setName('role').setDescription('התפקיד לחברים חדשים'))
    .addBooleanOption((o) => o.setName('clear').setDescription('ביטול התפקיד'))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('verify-image')
    .setDescription('תמונה בפאנל האימות ובהודעת האימות')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('העלאת קובץ תמונה')
        .addAttachmentOption((o) =>
          o.setName('image').setDescription('קובץ התמונה').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('url')
        .setDescription('שימוש בקישור תמונה')
        .addStringOption((o) =>
          o.setName('link').setDescription('קישור http(s)').setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('remove').setDescription('הסרת התמונה'))
    .addSubcommand((s) => s.setName('preview').setDescription('הצגת התמונה הנוכחית'))
    .toJSON(),
];

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

async function panelVisual(guildId) {
  if (cfg(guildId).verifyImageUrl) {
    return { imageUrl: cfg(guildId).verifyImageUrl, files: [] };
  }
  const name = 'verify-panel.png';
  const buffer = await buildVerifyPanelCard({
    title: config.title,
    description: config.description,
  });
  return { imageUrl: `attachment://${name}`, files: [new AttachmentBuilder(buffer, { name })] };
}

async function panel(guildId) {
  const embed = new EmbedBuilder()
    .setColor(config.colors.panel)
    .setTitle(config.title)
    .setDescription(config.description);
  const visual = await panelVisual(guildId);
  embed.setImage(visual.imageUrl);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel(config.buttonLabel)
      .setEmoji(config.buttonEmoji)
      .setStyle(ButtonStyle.Success)
  );
  return { embeds: [brand(embed)], components: [row], files: visual.files };
}

function verifyPayload(guildId, content) {
  const payload = { content };
  const url = cfg(guildId).verifyImageUrl;
  if (url) {
    payload.embeds = [
      new EmbedBuilder()
        .setColor(config.colors.panel)
        .setTitle(config.imageTitle)
        .setImage(url),
    ];
  }
  return payload;
}

async function refreshVerifyPanels(guild) {
  const visual = await panelVisual(guild.id);
  let updated = 0;
  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased() || channel.isDMBased()) continue;
    const messages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
    if (!messages) continue;
    for (const m of messages.values()) {
      if (
        m.author.id !== client.user.id ||
        !m.components.some((row) => row.components.some((c) => c.customId === 'verify_button')) ||
        !m.embeds[0]
      ) {
        continue;
      }
      const embed = EmbedBuilder.from(m.embeds[0]);
      embed.setImage(visual.imageUrl);
      await m.edit({ embeds: [embed], files: visual.files }).catch(() => {});
      updated++;
    }
  }
  return updated;
}

async function reply(interaction, content) {
  const payload = { content, ephemeral: true };
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload);
  return interaction.reply(payload);
}

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(token);
  const guildIds = (process.env.GUILD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  try {
    if (guildIds.length) {
      for (const id of guildIds) await rest.put(Routes.applicationGuildCommands(clientId, id), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
    }
    console.log(`Deployed ${commands.length} command(s).`);
  } catch (err) {
    console.error('[deploy]', err.message);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  const roleId = cfg(member.guild.id).joinRoleId;
  if (!roleId) return;
  const role = member.guild.roles.cache.get(roleId) || (await member.guild.roles.fetch(roleId).catch(() => null));
  if (!role) return;
  try {
    await member.roles.add(role, 'Auto role on join');
    console.log(`[verify] join role -> ${member.user.tag}`);
  } catch (err) {
    console.error('[verify] join role:', err.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return reply(interaction, config.needPerm);
      }
      const gid = interaction.guild.id;

      if (interaction.commandName === 'verify-setup') {
        await interaction.channel.send(await panel(gid));
        if (!cfg(gid).verifyRoleId) {
          const existing = interaction.guild.roles.cache.find((r) => r.name === config.roleName);
          const role = existing || (await interaction.guild.roles
            .create({ name: config.roleName, color: config.roleColor })
            .catch(() => null));
          if (role) {
            cfg(gid).verifyRoleId = role.id;
            saveStore();
          }
        }
        return reply(interaction, config.setupDone);
      }

      if (interaction.commandName === 'verify-role') {
        let role = interaction.options.getRole('role');
        if (!role) {
          role = interaction.guild.roles.cache.find((r) => r.name === config.roleName) ||
            (await interaction.guild.roles
              .create({ name: config.roleName, color: config.roleColor })
              .catch(() => null));
        }
        if (!role) return reply(interaction, '⚠️ לא נוצר תפקיד.');
        cfg(gid).verifyRoleId = role.id;
        saveStore();
        return reply(interaction, fill(config.roleSet, { role: role.id }));
      }

      if (interaction.commandName === 'join-role') {
        if (interaction.options.getBoolean('clear')) {
          delete cfg(gid).joinRoleId;
          saveStore();
          return reply(interaction, config.joinRoleCleared);
        }
        const role = interaction.options.getRole('role');
        if (!role) {
          return reply(interaction, cfg(gid).joinRoleId
            ? fill(config.joinRoleCurrent, { role: cfg(gid).joinRoleId })
            : config.joinRoleNone);
        }
        cfg(gid).joinRoleId = role.id;
        saveStore();
        return reply(interaction, fill(config.joinRoleSet, { role: role.id }));
      }

      if (interaction.commandName === 'verify-image') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'remove') {
          delete cfg(gid).verifyImageUrl;
          saveStore();
          const updated = await refreshVerifyPanels(interaction.guild);
          return reply(interaction, fill(config.imageRemoved, { updated }));
        }

        if (sub === 'preview') {
          return reply(
            interaction,
            cfg(gid).verifyImageUrl
              ? fill(config.imageCurrent, { url: cfg(gid).verifyImageUrl })
              : config.imageNone
          );
        }

        const url =
          sub === 'url'
            ? interaction.options.getString('link')
            : interaction.options.getAttachment('image')?.url || null;
        if (!url || !/^https?:\/\//i.test(url)) {
          return reply(interaction, '⚠️ יש לספק תמונה או קישור תקין.');
        }
        cfg(gid).verifyImageUrl = url;
        saveStore();
        const updated = await refreshVerifyPanels(interaction.guild);
        return reply(interaction, fill(config.imageSet, { updated }));
      }
      return;
    }

    if (!interaction.isButton() || interaction.customId !== 'verify_button') return;

    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const gid = interaction.guild.id;
    const settings = cfg(gid);
    const roleId = settings.verifyRoleId;
    if (!roleId) return interaction.editReply({ content: config.noRole }).catch(() => {});
    if (interaction.member.roles.cache.has(roleId)) {
      return interaction.editReply(verifyPayload(gid, config.already)).catch(() => {});
    }
    const role = interaction.guild.roles.cache.get(roleId) ||
      (await interaction.guild.roles.fetch(roleId).catch(() => null));
    if (!role) return interaction.editReply({ content: config.noRole }).catch(() => {});
    try {
      await interaction.member.roles.add(role, 'Verified via button');
    } catch (err) {
      console.error('[verify]', err.message);
      return interaction.editReply({ content: config.failed }).catch(() => {});
    }
    let removed = '';
    const joinRoleId = settings.joinRoleId;
    if (joinRoleId && interaction.member.roles.cache.has(joinRoleId)) {
      try {
        await interaction.member.roles.remove(joinRoleId, 'Verified via button');
        removed = fill(config.removed, { role: joinRoleId });
      } catch (err) {
        console.error('[verify] remove join role:', err.message);
      }
    }
    return interaction.editReply(
      verifyPayload(gid, fill(config.success, { role: role.id, removed }))
    ).catch(() => {});
  } catch (err) {
    console.error('[interaction]', err.message);
  }
});

client.login(token);
