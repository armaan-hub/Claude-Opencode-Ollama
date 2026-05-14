const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_HOME = path.join(__dirname, 'test-home-status');

function loadStatus({
  config = { providers: {} },
  proxyStatus = { data: [] },
  proxyError = null,
} = {}) {
  jest.resetModules();
  jest.spyOn(os, 'homedir').mockReturnValue(TEST_HOME);

  jest.doMock('chalk', () => ({
    blue: (s) => s,
    cyan: (s) => s,
    green: (s) => s,
    red: (s) => s,
  }));

  jest.doMock('../lib/config-manager', () => ({
    readConfig: jest.fn(() => config),
  }));

  jest.doMock('../lib/proxy-client', () => ({
    getProxyStatus: proxyError
      ? jest.fn().mockRejectedValue(proxyError)
      : jest.fn().mockResolvedValue(proxyStatus),
  }));

  return require('../commands/status');
}

describe('statusCommand', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  test('shows active model, configured providers, model count, and proxy success', async () => {
    const activeModelPath = path.join(TEST_HOME, '.claude', 'active-model');
    fs.mkdirSync(path.dirname(activeModelPath), { recursive: true });
    fs.writeFileSync(activeModelPath, 'copilot/gpt-4.1\n', 'utf-8');

    const { statusCommand } = loadStatus({
      config: {
        providers: {
          openai: { apiKey: 'sk-123' },
          groq: { apiKey: 'gsk-123' },
          google_gemini: { apiKey: null },
          github_copilot: { token: 'ghu_123' },
        },
      },
      proxyStatus: {
        data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      },
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await statusCommand();

    expect(logSpy).toHaveBeenCalledWith('=== gh-heer Status ===\n');
    expect(logSpy).toHaveBeenCalledWith('Active Model:', 'copilot/gpt-4.1');
    expect(logSpy).toHaveBeenCalledWith(
      'Configured Providers:',
      'openai, groq, github_copilot'
    );
    expect(logSpy).toHaveBeenCalledWith('Proxy Models Available:', 3);
    expect(logSpy).toHaveBeenCalledWith('✓ Proxy is running at localhost:4001');
    expect(logSpy).toHaveBeenCalledWith('');
  });

  test('shows "none" when active model file is missing', async () => {
    const { statusCommand } = loadStatus({
      config: {
        providers: {
          openai: { apiKey: null },
        },
      },
      proxyStatus: { data: [] },
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await statusCommand();

    expect(logSpy).toHaveBeenCalledWith('Active Model:', 'none');
  });

  test('shows "none" when no providers are configured', async () => {
    const { statusCommand } = loadStatus({
      config: {
        providers: {
          openai: { apiKey: null },
          groq: { apiKey: '' },
          github_copilot: { token: null },
        },
      },
      proxyStatus: { data: [] },
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await statusCommand();

    expect(logSpy).toHaveBeenCalledWith('Configured Providers:', 'none');
  });

  test('handles proxy unreachable without throwing', async () => {
    const { statusCommand } = loadStatus({
      config: {
        providers: {
          openai: { apiKey: 'sk-123' },
        },
      },
      proxyError: new Error('Proxy unreachable at http://localhost:4001: ECONNREFUSED'),
    });

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await expect(statusCommand()).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(
      '✗ Proxy unreachable:',
      'Proxy unreachable at http://localhost:4001: ECONNREFUSED'
    );
  });
});
