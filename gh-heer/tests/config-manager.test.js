const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_HOME = path.join(__dirname, 'test-home');

function loadConfigManager() {
  jest.resetModules();
  jest.spyOn(os, 'homedir').mockReturnValue(TEST_HOME);
  return require('../lib/config-manager');
}

function createProviders() {
  return {
    openai: { apiKey: null },
    groq: { apiKey: null },
    google_gemini: { apiKey: null },
    github_copilot: { token: null, clientId: null },
  };
}

describe('config-manager', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  test('readConfig returns default config if file is missing', () => {
    const { readConfig, CONFIG_DIR, CONFIG_FILE } = loadConfigManager();

    const config = readConfig();

    expect(CONFIG_DIR).toBe(path.join(TEST_HOME, '.opencode'));
    expect(CONFIG_FILE).toBe(path.join(TEST_HOME, '.opencode', 'opencode-proxy-config.json'));
    expect(fs.existsSync(CONFIG_DIR)).toBe(true);
    expect(config).toEqual({
      providers: createProviders(),
      lastUpdated: null,
    });
  });

  test('readConfig parses existing config correctly', () => {
    const { readConfig, CONFIG_DIR, CONFIG_FILE } = loadConfigManager();

    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const existing = {
      providers: {
        ...createProviders(),
        openai: { apiKey: 'sk-123' },
      },
      lastUpdated: '2025-01-01T00:00:00.000Z',
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(existing), 'utf-8');

    expect(readConfig()).toEqual(existing);
  });

  test('writeConfig creates file with proper structure', () => {
    const { writeConfig, CONFIG_FILE } = loadConfigManager();

    const config = {
      providers: createProviders(),
      lastUpdated: null,
    };

    writeConfig(config);

    expect(fs.existsSync(CONFIG_FILE)).toBe(true);
    const written = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    expect(written.providers).toEqual(createProviders());
  });

  test('writeConfig backs up old config', () => {
    const { writeConfig, CONFIG_DIR, CONFIG_FILE } = loadConfigManager();

    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const oldConfig = { providers: createProviders(), lastUpdated: 'old' };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(oldConfig), 'utf-8');

    const newConfig = { providers: createProviders(), lastUpdated: null };
    writeConfig(newConfig);

    const backupPath = `${CONFIG_FILE}.bak`;
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(backupPath, 'utf-8'))).toEqual(oldConfig);
  });

  test('writeConfig sets lastUpdated timestamp', () => {
    const { writeConfig } = loadConfigManager();

    const config = { providers: createProviders(), lastUpdated: null };
    writeConfig(config);

    expect(typeof config.lastUpdated).toBe('string');
    expect(Number.isNaN(Date.parse(config.lastUpdated))).toBe(false);
  });

  test('writeConfig restores backup on write failure', () => {
    const { writeConfig, CONFIG_DIR, CONFIG_FILE } = loadConfigManager();

    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const oldConfig = { providers: createProviders(), lastUpdated: 'old' };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(oldConfig), 'utf-8');

    const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('disk full');
    });

    expect(() => writeConfig({ providers: createProviders(), lastUpdated: null })).toThrow(
      'Failed to write config: disk full'
    );

    writeSpy.mockRestore();

    expect(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))).toEqual(oldConfig);
  });

  test('getProvider returns provider config or throws', () => {
    const { getProvider, CONFIG_DIR, CONFIG_FILE } = loadConfigManager();

    const config = {
      providers: {
        ...createProviders(),
        groq: { apiKey: 'gsk_123' },
      },
      lastUpdated: null,
    };

    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config), 'utf-8');

    expect(getProvider('groq')).toEqual({ apiKey: 'gsk_123' });
    expect(() => getProvider('missing')).toThrow('Provider missing not found in config');
  });
});
