const fs = require('fs');
const path = require('path');
const os = require('os');

describe('appendAuditLog', () => {
  let auditLoggerModule;

  const mockHomeDir = (homeDir) => {
    jest.spyOn(os, 'homedir').mockReturnValue(homeDir);
    delete require.cache[require.resolve('../lib/audit-logger')];
    auditLoggerModule = require('../lib/audit-logger');
    return auditLoggerModule;
  };

  afterEach(() => {
    jest.restoreAllMocks();
    // Clean up test directories
    const testDirs = ['.test-home-1', '.test-home-2', '.test-home-3']
      .map(d => path.join(process.cwd(), d));
    testDirs.forEach(dir => {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  test('creates ~/.opencode and writes JSON line with required fields', () => {
    const homeDir = path.join(process.cwd(), '.test-home-1');
    fs.rmSync(homeDir, { recursive: true, force: true });

    process.env.USER = 'test-user';
    const { appendAuditLog, AUDIT_DIR, AUDIT_FILE } = mockHomeDir(homeDir);

    appendAuditLog('auth.login', { provider: 'openai' });

    expect(AUDIT_DIR).toBe(path.join(homeDir, '.opencode'));
    expect(AUDIT_FILE).toBe(path.join(homeDir, '.opencode', 'audit.log'));
    expect(fs.existsSync(AUDIT_DIR)).toBe(true);
    expect(fs.existsSync(AUDIT_FILE)).toBe(true);

    const lines = fs.readFileSync(AUDIT_FILE, 'utf-8').trim().split('\n');
    expect(lines.length).toBe(1);

    const entry = JSON.parse(lines[0]);
    expect(entry.action).toBe('auth.login');
    expect(entry.user).toBe('test-user');
    expect(entry.details).toEqual({ provider: 'openai' });
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('appends lines instead of overwriting', () => {
    const homeDir = path.join(process.cwd(), '.test-home-2');
    fs.rmSync(homeDir, { recursive: true, force: true });

    process.env.USER = 'append-user';
    const { appendAuditLog, AUDIT_FILE } = mockHomeDir(homeDir);

    appendAuditLog('auth.login', { one: 1 });
    appendAuditLog('auth.switch', { two: 2 });

    const lines = fs.readFileSync(AUDIT_FILE, 'utf-8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).action).toBe('auth.login');
    expect(JSON.parse(lines[1]).action).toBe('auth.switch');
  });

  test('logs warning and does not throw on write failure', () => {
    const homeDir = path.join(process.cwd(), '.test-home-3');
    fs.rmSync(homeDir, { recursive: true, force: true });

    const { appendAuditLog } = mockHomeDir(homeDir);

    const originalAppend = fs.appendFileSync;
    let warningMessage = '';

    fs.appendFileSync = () => {
      throw new Error('disk full');
    };
    jest.spyOn(console, 'error').mockImplementation((msg) => {
      warningMessage = String(msg);
    });

    expect(() => appendAuditLog('auth.fail', { reason: 'io' })).not.toThrow();
    expect(warningMessage).toMatch(/Warning: Failed to write audit log: disk full/);

    fs.appendFileSync = originalAppend;
  });
});
