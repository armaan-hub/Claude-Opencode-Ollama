const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_HOME = path.join(__dirname, 'test-home');

// Mock chalk at the top level
jest.mock('chalk', () => ({
  blue: (str) => str,
  green: (str) => str,
  yellow: (str) => str,
}));

function mockConsole() {
  const consoleSpy = {
    log: jest.fn(),
    error: jest.fn(),
  };
  jest.spyOn(console, 'log').mockImplementation(consoleSpy.log);
  jest.spyOn(console, 'error').mockImplementation(consoleSpy.error);
  return consoleSpy;
}

describe('authCommand', () => {
  beforeEach(() => {
    jest.spyOn(os, 'homedir').mockReturnValue(TEST_HOME);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  test('authenticates successfully with all 4 providers', async () => {
    const githubSecrets = require('../lib/github-secrets');
    jest.spyOn(githubSecrets, 'getOrgSecret').mockImplementation(async (secretName) => {
      const secrets = {
        OPENAI_API_KEY: 'sk-openai-123',
        GROQ_API_KEY: 'gsk-groq-456',
        GOOGLE_GEMINI_KEY: 'gm-google-789',
        GITHUB_OAUTH_TOKEN: 'ghp-copilot-012',
      };
      if (secrets[secretName]) {
        return secrets[secretName];
      }
      throw new Error(`Secret ${secretName} not found`);
    });

    const { authCommand } = require('../commands/auth');
    mockConsole();

    // Ensure config dir exists
    fs.mkdirSync(path.join(TEST_HOME, '.opencode'), { recursive: true });

    await authCommand('test-org');

    // Verify config was written
    const configFile = path.join(TEST_HOME, '.opencode', 'opencode-proxy-config.json');
    expect(fs.existsSync(configFile)).toBe(true);

    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    expect(config.providers.openai.apiKey).toBe('sk-openai-123');
    expect(config.providers.groq.apiKey).toBe('gsk-groq-456');
    expect(config.providers.google_gemini.apiKey).toBe('gm-google-789');
    expect(config.providers.github_copilot.token).toBe('ghp-copilot-012');

    jest.resetModules();
  });

  test('succeeds with partial provider failure (2 of 4)', async () => {
    const githubSecrets = require('../lib/github-secrets');
    jest.spyOn(githubSecrets, 'getOrgSecret').mockImplementation(async (secretName) => {
      const secrets = {
        OPENAI_API_KEY: 'sk-openai-123',
        GROQ_API_KEY: 'gsk-groq-456',
      };
      if (secrets[secretName]) {
        return secrets[secretName];
      }
      throw new Error(`Secret ${secretName} not found`);
    });

    const { authCommand } = require('../commands/auth');
    mockConsole();

    fs.mkdirSync(path.join(TEST_HOME, '.opencode'), { recursive: true });

    await authCommand('test-org');

    const configFile = path.join(TEST_HOME, '.opencode', 'opencode-proxy-config.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

    expect(config.providers.openai.apiKey).toBe('sk-openai-123');
    expect(config.providers.groq.apiKey).toBe('gsk-groq-456');
    expect(config.providers.google_gemini.apiKey).toBeNull();
    expect(config.providers.github_copilot.token).toBeNull();

    jest.resetModules();
  });

  test('throws when no providers are authenticated', async () => {
    const githubSecrets = require('../lib/github-secrets');
    jest
      .spyOn(githubSecrets, 'getOrgSecret')
      .mockImplementation(async () => {
        throw new Error('All secrets not found');
      });

    const { authCommand } = require('../commands/auth');
    mockConsole();

    fs.mkdirSync(path.join(TEST_HOME, '.opencode'), { recursive: true });

    await expect(authCommand('test-org')).rejects.toThrow(
      'No providers authenticated. Check GitHub Org Secrets and permissions.'
    );

    jest.resetModules();
  });

  test('logs audit entry with org name and provider count', async () => {
    const githubSecrets = require('../lib/github-secrets');
    jest.spyOn(githubSecrets, 'getOrgSecret').mockImplementation(async (secretName) => {
      const secrets = {
        OPENAI_API_KEY: 'sk-openai-123',
        GROQ_API_KEY: 'gsk-groq-456',
      };
      if (secrets[secretName]) {
        return secrets[secretName];
      }
      throw new Error(`Secret ${secretName} not found`);
    });

    const auditLogger = require('../lib/audit-logger');
    const appendSpy = jest.spyOn(auditLogger, 'appendAuditLog').mockImplementation(() => {});

    const { authCommand } = require('../commands/auth');
    mockConsole();

    fs.mkdirSync(path.join(TEST_HOME, '.opencode'), { recursive: true });

    await authCommand('my-org');

    expect(appendSpy).toHaveBeenCalledWith('auth', {
      org: 'my-org',
      providers: 2,
    });

    jest.resetModules();
  });

  test('accepts orgName parameter and uses it in audit log', async () => {
    const githubSecrets = require('../lib/github-secrets');
    jest.spyOn(githubSecrets, 'getOrgSecret').mockImplementation(async (secretName) => {
      const secrets = {
        OPENAI_API_KEY: 'sk-123',
      };
      if (secrets[secretName]) {
        return secrets[secretName];
      }
      throw new Error(`Secret ${secretName} not found`);
    });

    const auditLogger = require('../lib/audit-logger');
    const appendSpy = jest.spyOn(auditLogger, 'appendAuditLog').mockImplementation(() => {});

    const { authCommand } = require('../commands/auth');
    mockConsole();

    fs.mkdirSync(path.join(TEST_HOME, '.opencode'), { recursive: true });

    await authCommand('custom-org');

    expect(appendSpy).toHaveBeenCalledWith('auth', {
      org: 'custom-org',
      providers: 1,
    });

    jest.resetModules();
  });

  test('uses chalk for colored output', async () => {
    const githubSecrets = require('../lib/github-secrets');
    jest.spyOn(githubSecrets, 'getOrgSecret').mockImplementation(async (secretName) => {
      const secrets = {
        OPENAI_API_KEY: 'sk-123',
      };
      if (secrets[secretName]) {
        return secrets[secretName];
      }
      throw new Error(`Secret ${secretName} not found`);
    });

    const { authCommand } = require('../commands/auth');
    const consoleSpy = mockConsole();

    fs.mkdirSync(path.join(TEST_HOME, '.opencode'), { recursive: true });

    await authCommand('test-org');

    // Verify console.log was called with chalk formatted output
    expect(consoleSpy.log).toHaveBeenCalled();

    jest.resetModules();
  });

  test('handles missing config file gracefully', async () => {
    const githubSecrets = require('../lib/github-secrets');
    jest.spyOn(githubSecrets, 'getOrgSecret').mockImplementation(async (secretName) => {
      const secrets = {
        OPENAI_API_KEY: 'sk-123',
      };
      if (secrets[secretName]) {
        return secrets[secretName];
      }
      throw new Error(`Secret ${secretName} not found`);
    });

    const { authCommand } = require('../commands/auth');
    mockConsole();

    // Don't create config dir - let it be created
    await authCommand('test-org');

    const configFile = path.join(TEST_HOME, '.opencode', 'opencode-proxy-config.json');
    expect(fs.existsSync(configFile)).toBe(true);

    jest.resetModules();
  });
});

