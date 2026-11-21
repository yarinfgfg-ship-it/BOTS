require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Events,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
} = require('discord.js');
const config = require('./config');

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('❌ Set DISCORD_TOKEN in .env first.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder()
    .setName('automod-setup')
    .setDescription('יצירה/עדכון של כללי AutoMod בשרת הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
  new SlashCommandBuilder()
    .setName('automod-status')
    .setDescription('הצגת כללי ה־AutoMod בשרת הזה')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .toJSON(),
];

function ruleBody(name, triggerType, triggerMetadata, exemptRoles) {
  return {
    name,
    event_type: 1, // MESSAGE_SEND
    trigger_type: triggerType, // 1 = KEYWORD
    trigger_metadata: triggerMetadata,
    actions: [
      { type: 1, metadata: {} }, // BLOCK_MESSAGE
      {
        type: 3, // TIMEOUT
        metadata: { duration_seconds: Math.floor(config.timeoutMs / 1000) },
      },
    ],
    exempt_roles: exemptRoles,
    enabled: true,
  };
}

function desiredRules(guild) {
  const exempt = config.exemptRoles.filter((id) => guild.roles.cache.has(id));

  return [
    ruleBody(
      config.linkRuleName,
      1,
      { keyword_filter: [], regex_patterns: config.linkRegex },
      exempt
    ),
    ruleBody(
      config.nsfwRuleName,
      1,
      { keyword_filter: config.nsfwKeywords, regex_patterns: [] },
      exempt
    ),
  ];
}

async function listRules(guild) {
  return client.rest.get(`/guilds/${guild.id}/auto-moderation/rules`);
}

async function syncRules(guild) {
  let existing = [];
  try {
    existing = await listRules(guild);
  } catch (err) {
    console.error(`[automod] ${guild.id} list:`, err.rawError?.message || err.message);
    return 0;
  }

  let changed = 0;
  for (const rule of desiredRules(guild)) {
    const current = existing.find((r) => r.name === rule.name);
    try {
      if (current) {
        await client.rest.patch(`/guilds/${guild.id}/auto-moderation/rules/${current.id}`, {
          body: rule,
        });
      } else {
        await client.rest.post(`/guilds/${guild.id}/auto-moderation/rules`, { body: rule });
      }
      changed += 1;
      console.log(`[automod] ${guild.id}: ${rule.name} ready`);
    } catch (err) {
      console.error(
        `[automod] ${guild.id} ${rule.name}:`,
        err.rawError?.message || err.message,
        err.rawError?.errors ? JSON.stringify(err.rawError.errors) : ''
      );
    }
  }
  return changed;
}

client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    await client.rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`Deployed ${commands.length} command(s).`);
  } catch (err) {
    console.error('[deploy]', err.rawError?.message || err.message);
  }

  for (const guild of client.guilds.cache.values()) {
    await syncRules(guild);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) return;

  if (interaction.commandName === 'automod-setup') {
    await interaction.deferReply({ ephemeral: true });
    const changed = await syncRules(interaction.guild);
    return interaction.editReply(
      changed === 2
        ? '✅ שני כללי ה־AutoMod מוכנים בשרת הזה.'
        : '⚠️ חלק מהכללים לא נוצרו — בדקו שהבוט יש לו הרשאת **Manage Server**.'
    );
  }

  if (interaction.commandName === 'automod-status') {
    try {
      const rules = await listRules(interaction.guild);
      const lines = rules.map((r) => `• ${r.name} — ${r.enabled ? 'פעיל' : 'כבוי'}`);
      return interaction.reply({
        ephemeral: true,
        content: lines.length ? lines.join('\n') : 'אין עדיין כללי AutoMod בשרת.',
      });
    } catch (err) {
      return interaction.reply({
        ephemeral: true,
        content: '❌ לא ניתן לקרוא את הכללים. צריך הרשאת **Manage Server**.',
      });
    }
  }
});

process.on('unhandledRejection', (err) => {
  console.error('[unhandled]', err?.message || err);
});

client.login(token);
