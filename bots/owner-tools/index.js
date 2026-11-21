require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
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

const OWNER_IDS = (process.env.BOT_OWNER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('dm')
    .setDescription('שליחת הודעה פרטית למשתמש (יוצר בוט בלבד)')
    .addStringOption((o) => o.setName('user').setDescription('מזהה או אזכור').setRequired(true))
    .addStringOption((o) => o.setName('message').setDescription('התוכן').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('alert')
    .setDescription('שליחת התראה למשתמש (יוצר בוט בלבד)')
    .addStringOption((o) => o.setName('user').setDescription('מזהה או אזכור').setRequired(true))
    .addStringOption((o) => o.setName('message').setDescription('התוכן').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('join-server')
    .setDescription('שליחת הזמנה למשתמש להצטרף לשרת (גם אם הבוט לא בשרת)')
    .addStringOption((o) => o.setName('user').setDescription('מזהה או אזכור').setRequired(true))
    .addStringOption((o) => o.setName('invite').setDescription('קישור discord.gg'))
    .addStringOption((o) => o.setName('message').setDescription('הודעה אישית'))
    .toJSON(),
];

function fill(text, vars) {
  let out = String(text ?? '');
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v ?? ''));
  return out;
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

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    const name = interaction.commandName;
    if (!['dm', 'alert', 'join-server'].includes(name)) return;

    if (!OWNER_IDS.includes(interaction.user.id)) {
      return reply(interaction, { content: config.notAllowed });
    }

    const userId = (interaction.options.getString('user', true).trim()).replace(/^<@!?(\d+)>$/, '$1');
    if (!/^\d{17,20}$/.test(userId)) return reply(interaction, { content: config.invalidUser });
    if (userId === interaction.user.id) return reply(interaction, { content: config.self });

    await interaction.deferReply({ ephemeral: true });
    const target = await client.users.fetch(userId).catch(() => null);
    if (!target) return interaction.editReply({ content: config.notFound });

    if (name === 'dm' || name === 'alert') {
      const embed = new EmbedBuilder()
        .setColor(name === 'alert' ? config.alertColor : config.color)
        .setTitle(name === 'alert' ? config.alertTitle : config.dmTitle)
        .setDescription(interaction.options.getString('message', true));
      try {
        await target.send({ embeds: [embed] });
        return interaction.editReply({ content: fill(config.sent, { user: `<@${target.id}>` }) });
      } catch (err) {
        console.error('[send]', err.message);
        return interaction.editReply({ content: fill(config.failed, { user: `<@${target.id}>` }) });
      }
    }

    let invite = (interaction.options.getString('invite') || '').trim();
    if (!invite) return interaction.editReply({ content: config.needTarget });
    if (!/^https?:\/\//i.test(invite)) invite = `https://discord.gg/${invite.replace(/^discord\.gg\//i, '')}`;
    const extra = (interaction.options.getString('message') || '').trim();
    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setTitle(config.joinTitle)
      .setDescription(['לחצו כדי להצטרף לשרת:', invite, extra].filter(Boolean).join('\n\n'));
    try {
      await target.send({ embeds: [embed] });
      return interaction.editReply({ content: fill(config.joinSent, { user: `<@${target.id}>` }) });
    } catch (err) {
      console.error('[join-server]', err.message);
      return interaction.editReply({ content: fill(config.joinFailed, { user: `<@${target.id}>` }) });
    }
  } catch (err) {
    console.error('[interaction]', err.message);
  }
});

client.login(token);
