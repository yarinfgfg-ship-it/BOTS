const config = require('../config');
const guildConfig = require('./guildConfig');
const ticketLogs = require('./ticketLogs');

// One lifecycle log message per ticket, keyed by guild + padded ticket number.
// REST-only on purpose: it works from the gateway bot and from a standalone
// verification harness with the same token, with no cached client required.

function lifecyclePerson(id, tag, fallback) {
  if (!id) return fallback;
  if (!/^\d+$/.test(String(id))) return String(tag || id);
  return tag ? `<@${id}> (${tag})` : `<@${id}>`;
}

async function writeTicketLifecycleLog(
  rest,
  { makeEmbed, fill },
  guildId,
  number,
  patch,
  { transcript = null } = {}
) {
  const cfg = guildConfig.get(guildId, { logChannel: config.ids.logChannel });
  const logChannelId = cfg.logChannel || config.ids.logChannel;
  if (!logChannelId) return null;

  const channel = await rest.get(`/channels/${logChannelId}`).catch(() => null);
  if (!channel || ![0, 5].includes(channel.type)) return null;

  const record = { ...(ticketLogs.get(guildId, number) || { guildId, number }), ...patch };
  const embed = makeEmbed({
    title: config.log.lifecycleTitle,
    description: config.log.lifecycleDescription,
    color: record.rating
      ? config.colors.log
      : record.closer
        ? config.colors.closed
        : config.colors.open,
    footerText: config.log.lifecycleFooter,
    showTimestamp: true,
    vars: {
      number,
      opener: lifecyclePerson(record.opener, record.openerTag, config.log.pending),
      claimer: lifecyclePerson(record.claimer, record.claimerTag, config.log.pending),
      closer: lifecyclePerson(record.closer, record.closerTag, config.log.pending),
      rating: record.rating || config.log.notRated,
    },
  });

  const request = {
    body: {
      embeds: [typeof embed.toJSON === 'function' ? embed.toJSON() : embed],
      allowed_mentions: { parse: [] },
    },
  };
  if (transcript) {
    request.files = [
      {
        name: fill(config.log.fileName, { number }),
        data: Buffer.from(transcript, 'utf8'),
      },
    ];
  }

  let message = null;
  if (record.messageId) {
    message = await rest
      .get(`/channels/${logChannelId}/messages/${record.messageId}`)
      .catch(() => null);
  }

  try {
    message = message
      ? await rest.patch(`/channels/${logChannelId}/messages/${message.id}`, request)
      : await rest.post(`/channels/${logChannelId}/messages`, request);
  } catch (err) {
    console.error('[ticket-log]', err.message);
    return null;
  }

  ticketLogs.set(guildId, number, {
    ...record,
    messageId: message.id,
    channelId: logChannelId,
  });
  return ticketLogs.get(guildId, number);
}

module.exports = { writeTicketLifecycleLog, lifecyclePerson };
