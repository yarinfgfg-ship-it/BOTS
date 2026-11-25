const fs = require('fs');
const path = require('path');

// On a host, DATA_DIR points at a persistent volume. Locally it falls back to
// the project root so existing JSON files keep working exactly as before.
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : process.env.TOKAY_DATA_DIR
    ? path.resolve(process.env.TOKAY_DATA_DIR)
    : path.join(__dirname, '..');

if (process.env.DATA_DIR) fs.mkdirSync(dataDir, { recursive: true });

function storePath(filename) {
  return path.join(dataDir, filename);
}

module.exports = { storePath, dataDir };
