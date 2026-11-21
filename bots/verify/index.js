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
} = require('discord.js');
const config = require('./config');

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
];

function fill(text, vars) {
  let out = String(text ?? '');
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v ?? ''));
  return out;
}

function panel() {
  const embed = new EmbedBuilder()
    .setColor(config.colors.panel)
    .setTitle(config.title)
    .setDescription(config.description);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify_button')
      .setLabel(config.buttonLabel)
      .setEmoji(config.buttonEmoji)
      .setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
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
        await interaction.channel.send(panel());
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
      return;
    }

    if (!interaction.isButton() || interaction.customId !== 'verify_button') return;

    await interaction.deferReply({ ephemeral: true }).catch(() => {});
    const gid = interaction.guild.id;
    const settings = cfg(gid);
    const roleId = settings.verifyRoleId;
    if (!roleId) return interaction.editReply({ content: config.noRole }).catch(() => {});
    if (interaction.member.roles.cache.has(roleId)) {
      return interaction.editReply({ content: config.already }).catch(() => {});
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
    return interaction.editReply({ content: fill(config.success, { role: role.id, removed }) }).catch(() => {});
  } catch (err) {
    console.error('[interaction]', err.message);
  }
});

client.login(token);
