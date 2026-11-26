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
  'anti-nuke.json': 'ANTI_NUKE_JSON',
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Environment variables are the initial defaults; values saved at runtime by
// commands win. Without this merge, every bot restart wiped settings such as
// verifyRoleId back to the stale GUILDS_JSON on Render.
function mergeSaved(saved, seeded) {
  if (!isObject(saved) || !isObject(seeded)) return saved;
  const out = { ...seeded };
  for (const [key, value] of Object.entries(saved)) {
    out[key] = isObject(value) && isObject(seeded[key]) ? mergeSaved(value, seeded[key]) : value;
  }
  return out;
}

for (const [file, envName] of Object.entries(files)) {
  const value = process.env[envName];
  if (!value) continue;

  const target = path.join(dataDir, file);
  let seeded;
  try {
    seeded = JSON.parse(value);
  } catch {
    console.warn(`[seed] ${envName} is not valid JSON — skipped`);
    continue;
  }

  let saved = null;
  try {
    if (fs.existsSync(target)) saved = JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    saved = null;
  }

  if (saved === null) {
    fs.writeFileSync(target, JSON.stringify(seeded, null, 2));
    console.log(`[seed] created ${file} from ${envName}`);
  } else {
    const merged = mergeSaved(saved, seeded);
    fs.writeFileSync(target, JSON.stringify(merged, null, 2));
    console.log(`[seed] merged ${file} with ${envName} (saved values kept)`);
  }
}

console.log(`[seed] data dir: ${dataDir}`);
