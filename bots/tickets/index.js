require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
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
];

async function deploy() {
  const rest = new REST({ version: '10' }).setToken(token);
  const guildIds = (process.env.GUILD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
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

function panel() {
  const embed = new EmbedBuilder()
    .setColor(config.colors.panel)
    .setTitle(config.panelTitle)
    .setDescription(config.panelDescription);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open')
      .setLabel(config.buttonLabel)
      .setEmoji(config.buttonEmoji)
      .setStyle(ButtonStyle.Primary)
  );
  return { embeds: [embed], components: [row] };
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

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await deploy().catch((err) => console.error('[deploy]', err.message));
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'ticket-setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        return reply(interaction, config.needPerm);
      }
      await interaction.channel.send(panel());
      return reply(interaction, config.setupDone);
    }

    if (!interaction.isButton()) return;

    if (interaction.customId === 'ticket_open') {
      const { guild, user } = interaction;
      const existing = guild.channels.cache.find(
        (ch) => ch.type === ChannelType.GuildText && (ch.topic || '').includes(`creator:${user.id}`)
      );
      if (existing) return reply(interaction, fill(config.duplicate, { channel: `<#${existing.id}>` }));

      let category = guild.channels.cache.get(process.env.TICKET_CATEGORY_ID || '') || null;
      if (!category || category.type !== ChannelType.GuildCategory) {
        category = guild.channels.cache.find(
          (ch) => ch.type === ChannelType.GuildCategory && ch.name === 'TICKETS'
        ) || null;
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
        topic: `creator:${user.id}|status:open`,
        permissionOverwrites: overwrites,
      });

      await channel.send({
        content: `<@${user.id}>`,
        embeds: [
          new EmbedBuilder()
            .setColor(config.colors.open)
            .setTitle(fill(config.ticketTitle, { number }))
            .setDescription(fill(config.ticketDescription, { user: `<@${user.id}>`, number })),
        ],
        components: [ticketButtons(false)],
      });
      return reply(interaction, fill(config.created, { channel: `<#${channel.id}>` }));
    }

    if (interaction.customId === 'ticket_claim') {
      await interaction.deferReply({ ephemeral: true });
      const topic = `creator:${/creator:(\d+)/.exec(interaction.channel.topic || '')?.[1] || ''}|status:claimed|staff:${interaction.user.id}`;
      await interaction.channel.setTopic(topic).catch(() => {});
      await interaction.message.edit({ components: [ticketButtons(true)] }).catch(() => {});
      const msg = await interaction.channel.messages.fetch(interaction.message.id).catch(() => null);
      if (msg) {
        const embed = EmbedBuilder.from(msg.embeds[0] || {});
        embed.setColor(config.colors.claimed).setTitle(config.claimedTitle)
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
