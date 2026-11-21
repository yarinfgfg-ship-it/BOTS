require('dotenv').config();

const { PermissionsBitField } = require('discord.js');

const { CLIENT_ID } = process.env;

if (!CLIENT_ID) {
  console.error('❌ Set CLIENT_ID in .env first (see .env.example).');
  process.exit(1);
}

// Everything the ticket bot needs to create/manage ticket channels.
const permissions = [
  'ViewChannel',
  'SendMessages',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
  'AddReactions',
  'ManageChannels',
  'ManageMessages',
  'ManageGuild',
  'ModerateMembers',
];

const bitfield = PermissionsBitField.resolve(permissions);

const url =
  `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}` +
  `&permissions=${bitfield}` +
  `&scope=bot%20applications.commands`;

console.log('\n👉 Open this link in your browser to invite the bot:\n');
console.log(url);
console.log('\n(You must be logged into the Discord account that owns the server.)\n');
