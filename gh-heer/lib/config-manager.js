const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.opencode');
const CONFIG_FILE = path.join(CONFIG_DIR, 'opencode-proxy-config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function readConfig() {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    return {
      providers: {
        openai: { apiKey: null },
        groq: { apiKey: null },
        google_gemini: { apiKey: null },
        github_copilot: { token: null, clientId: null },
      },
      lastUpdated: null,
    };
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to read config from ${CONFIG_FILE}: ${error.message}`);
  }
}

function writeConfig(config) {
  ensureConfigDir();

  if (fs.existsSync(CONFIG_FILE)) {
    const backup = `${CONFIG_FILE}.bak`;
    fs.copyFileSync(CONFIG_FILE, backup);
  }

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    const backup = `${CONFIG_FILE}.bak`;
    if (fs.existsSync(backup)) {
      fs.copyFileSync(backup, CONFIG_FILE);
    }
    throw new Error(`Failed to write config: ${error.message}`);
  }

  config.lastUpdated = new Date().toISOString();
}

function getProvider(name) {
  const config = readConfig();

  if (!config.providers[name]) {
    throw new Error(`Provider ${name} not found in config`);
  }

  return config.providers[name];
}

module.exports = { readConfig, writeConfig, getProvider, CONFIG_DIR, CONFIG_FILE };
