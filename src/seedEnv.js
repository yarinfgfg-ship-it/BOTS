// Preloaded before index.js on hosts that have no Render-style entrypoint.
// Keeps JSON state in one writable directory and lets any host seed settings
// through environment variables (GUILDS_JSON, GIVEAWAYS_JSON, ...).
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const root = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : process.env.TOKAY_DATA_DIR
    ? path.resolve(process.env.TOKAY_DATA_DIR)
    : path.join(root, 'data');

fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;

const files = {
  'guilds.json': 'GUILDS_JSON',
  'tickets.json': 'TICKETS_JSON',
  'profiles.json': 'PROFILES_JSON',
  'oauth.json': 'OAUTH_JSON',
  'giveaways.json': 'GIVEAWAYS_JSON',
  'suggestions.json': 'SUGGESTIONS_JSON',
  'levels.json': 'LEVELS_JSON',
  'verifications.json': 'VERIFICATIONS_JSON',
};

for (const [file, envName] of Object.entries(files)) {
  const value = process.env[envName];
  if (value) fs.writeFileSync(path.join(dataDir, file), value);
}

console.log(`[seed] data dir: ${dataDir}`);
