require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
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

const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
if (process.env.ENABLE_MEMBERS_INTENT === 'true') intents.push(GatewayIntentBits.GuildMembers);
const client = new Client({ intents });

const commands = [
  new SlashCommandBuilder()
    .setName('welcome-setup')
    .setDescription('הגדרת ערוץ הברכות בערוץ הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('תצוגה מקדימה של הודעת הברכה')
    .addStringOption((o) => o.setName('user').setDescription('משתמש לתצוגה (אופציונלי)'))
    .toJSON(),
];

function fill(text, vars) {
  let out = String(text ?? '');
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v ?? ''));
  return out;
}

function embedFor(user, guild) {
  return new EmbedBuilder()
    .setColor(config.color)
    .setTitle(fill(config.title, { guild: guild.name }))
    .setDescription(fill(config.text, {
      user: `<@${user.id}>`,
      guild: guild.name,
      count: guild.memberCount,
    }))
    .setImage(user.displayAvatarURL({ size: 4096, extension: 'png' }));
}

async function reply(interaction, payload) {
  const body = { ephemeral: true, ...payload };
  if (interaction.replied || interaction.deferred) return interaction.followUp(body);
  return interaction.reply(body);
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
  try {
    const channelId = store[member.guild.id]?.welcomeChannelId || member.guild.systemChannelId;
    if (!channelId) return;
    const channel = member.guild.channels.cache.get(channelId) ||
      (await member.guild.channels.fetch(channelId).catch(() => null));
    if (!channel?.isTextBased() || channel.isDMBased()) return;
    await channel.send({ embeds: [embedFor(member.user, member.guild)] });
    console.log(`[welcome] ${member.user.tag} -> ${member.guild.name}`);
  } catch (err) {
    console.error('[welcome]', err.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'welcome-setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        return reply(interaction, { content: config.needPerm });
      }
      store[interaction.guild.id] = { ...(store[interaction.guild.id] || {}), welcomeChannelId: interaction.channel.id };
      fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));

      const perms = interaction.channel.permissionsFor(client.user);
      const bits = [
        [PermissionFlagsBits.ViewChannel, 'צפייה בערוץ'],
        [PermissionFlagsBits.SendMessages, 'שליחת הודעות'],
        [PermissionFlagsBits.EmbedLinks, 'הטמעת קישורים'],
      ];
      const missing = bits.filter(([bit]) => !perms?.has(bit)).map(([, name]) => name);
      return reply(interaction, {
        content: config.setupDone + (missing.length
          ? '\n\n' + fill(config.missingPerms, { list: missing.join(', ') })
          : ''),
      });
    }

    if (interaction.commandName === 'test') {
      const raw = (interaction.options.getString('user') || '').replace(/^<@!?(\d+)>$/, '$1');
      let user = interaction.user;
      if (raw) {
        if (!/^\d{17,20}$/.test(raw)) return reply(interaction, { content: config.invalidUser });
        user = (await client.users.fetch(raw).catch(() => null)) || interaction.user;
      }
      await interaction.reply({ embeds: [embedFor(user, interaction.guild)], ephemeral: false });
    }
  } catch (err) {
    console.error('[interaction]', err.message);
  }
});

client.login(token);
