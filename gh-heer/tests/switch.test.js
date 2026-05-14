const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_HOME = path.join(__dirname, 'test-home-switch');

// Mock all dependencies before loading the switch module
jest.mock('chalk', () => ({
  blue: (str) => str,
  green: (str) => str,
  yellow: (str) => str,
  red: (str) => str,
}));

jest.mock('../lib/proxy-client');
jest.mock('../lib/audit-logger');

describe('switch command', () => {
  let proxyClient;
  let auditLogger;
  let switchModule;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock os.homedir for this test
    jest.spyOn(os, 'homedir').mockReturnValue(TEST_HOME);

    // Clear the module cache to get fresh references
    delete require.cache[require.resolve('../commands/switch')];
    
    // Get fresh references after reset
    proxyClient = require('../lib/proxy-client');
    auditLogger = require('../lib/audit-logger');
    switchModule = require('../commands/switch');
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    if (fs.existsSync(TEST_HOME)) {
      fs.rmSync(TEST_HOME, { recursive: true, force: true });
    }
  });

  test('switchCommand throws error if modelName not provided', async () => {
    const { switchCommand } = switchModule;

    await expect(switchCommand()).rejects.toThrow(
      'Model name required. Usage: gh heer switch <model>'
    );
    await expect(switchCommand(null)).rejects.toThrow(
      'Model name required. Usage: gh heer switch <model>'
    );
    await expect(switchCommand('')).rejects.toThrow(
      'Model name required. Usage: gh heer switch <model>'
    );
  });

  test('switchCommand calls getProxyStatus to validate model exists', async () => {
    proxyClient.getProxyStatus.mockResolvedValue({
      data: [
        { id: 'gpt-4', provider: 'openai' },
        { id: 'claude-3', provider: 'anthropic' },
      ],
    });

    const { switchCommand } = switchModule;
    await switchCommand('gpt-4');

    expect(proxyClient.getProxyStatus).toHaveBeenCalled();
  });

  test('switchCommand throws error if model not found with available models list', async () => {
    proxyClient.getProxyStatus.mockResolvedValue({
      data: [
        { id: 'gpt-4', provider: 'openai' },
        { id: 'claude-3', provider: 'anthropic' },
      ],
    });

    const { switchCommand } = switchModule;

    await expect(switchCommand('nonexistent')).rejects.toThrow(
      'Model nonexistent not found. Available models: gpt-4, claude-3'
    );
  });

  test('switchCommand throws error if proxy is unreachable', async () => {
    proxyClient.getProxyStatus.mockRejectedValue(
      new Error('Proxy unreachable at http://localhost:4001: ECONNREFUSED')
    );

    const { switchCommand } = switchModule;

    await expect(switchCommand('gpt-4')).rejects.toThrow(
      'Failed to verify model with proxy: Proxy unreachable at http://localhost:4001: ECONNREFUSED'
    );
  });

  test('switchCommand creates ~/.claude directory if missing', async () => {
    proxyClient.getProxyStatus.mockResolvedValue({
      data: [{ id: 'gpt-4' }],
    });

    const { switchCommand, ACTIVE_MODEL_FILE } = switchModule;
    const claudeDir = path.dirname(ACTIVE_MODEL_FILE);
    expect(fs.existsSync(claudeDir)).toBe(false);

    await switchCommand('gpt-4');

    expect(fs.existsSync(claudeDir)).toBe(true);
  });

  test('switchCommand writes model name to ~/.claude/active-model', async () => {
    proxyClient.getProxyStatus.mockResolvedValue({
      data: [{ id: 'claude-3' }],
    });

    const { switchCommand, ACTIVE_MODEL_FILE } = switchModule;

    await switchCommand('claude-3');

    expect(fs.existsSync(ACTIVE_MODEL_FILE)).toBe(true);
    const content = fs.readFileSync(ACTIVE_MODEL_FILE, 'utf-8');
    expect(content).toBe('claude-3');
  });

  test('switchCommand calls appendAuditLog with action and model', async () => {
    proxyClient.getProxyStatus.mockResolvedValue({
      data: [{ id: 'gpt-4' }],
    });

    const { switchCommand } = switchModule;

    await switchCommand('gpt-4');

    expect(auditLogger.appendAuditLog).toHaveBeenCalledWith('switch', { model: 'gpt-4' });
  });

  test('switchCommand overwrites existing active model file', async () => {
    proxyClient.getProxyStatus.mockResolvedValue({
      data: [
        { id: 'gpt-4' },
        { id: 'claude-3' },
      ],
    });

    const { switchCommand, ACTIVE_MODEL_FILE } = switchModule;

    fs.mkdirSync(path.dirname(ACTIVE_MODEL_FILE), { recursive: true });
    fs.writeFileSync(ACTIVE_MODEL_FILE, 'old-model', 'utf-8');

    await switchCommand('gpt-4');

    const content = fs.readFileSync(ACTIVE_MODEL_FILE, 'utf-8');
    expect(content).toBe('gpt-4');
  });

  test('switchCommand handles proxy response with empty data array', async () => {
    proxyClient.getProxyStatus.mockResolvedValue({
      data: [],
    });

    const { switchCommand } = switchModule;

    await expect(switchCommand('gpt-4')).rejects.toThrow(
      'Model gpt-4 not found. Available models: '
    );
  });

  test('switchCommand handles proxy response with missing data field', async () => {
    proxyClient.getProxyStatus.mockResolvedValue({});

    const { switchCommand } = switchModule;

    await expect(switchCommand('gpt-4')).rejects.toThrow(
      'Model gpt-4 not found. Available models: '
    );
  });

  test('switchCommand outputs progress in blue and success in green', async () => {
    proxyClient.getProxyStatus.mockResolvedValue({
      data: [{ id: 'gpt-4' }],
    });

    const { switchCommand } = switchModule;
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await switchCommand('gpt-4');

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Switching to model: gpt-4'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Switched to gpt-4'));
  });
});
