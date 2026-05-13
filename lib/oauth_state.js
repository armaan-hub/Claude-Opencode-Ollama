// lib/oauth_state.js
const fs = require('fs');
const os = require('os');
const path = require('path');

const STATE_DIR = path.join(os.homedir(), '.opencode');
const STATE_PATH = path.join(STATE_DIR, 'oauth-state.json');
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

function _safeWrite(file, buf) {
  fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, buf, { mode: 0o600 });
}

function saveOauthState(state) {
  try {
    const payload = { state: String(state), ts: Date.now() };
    _safeWrite(STATE_PATH, JSON.stringify(payload));
    return true;
  } catch (e) {
    return false;
  }
}

function readOauthState({ maxAgeMs = DEFAULT_TTL_MS } = {}) {
  try {
    if (!fs.existsSync(STATE_PATH)) return null;
    const raw = fs.readFileSync(STATE_PATH, 'utf8');
    const p = JSON.parse(raw);
    if (!p || !p.state) return null;
    if (Date.now() - (p.ts || 0) > maxAgeMs) {
      try { fs.unlinkSync(STATE_PATH); } catch (e) {}
      return null;
    }
    return p; // { state, ts }
  } catch (e) {
    return null;
  }
}

function deleteOauthState() {
  try {
    if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { saveOauthState, readOauthState, deleteOauthState, STATE_PATH };
