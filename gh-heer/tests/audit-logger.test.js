const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_USER = process.env.USER;

function loadAuditLoggerWithHome(homeDir) {
  process.env.HOME = homeDir;
  delete require.cache[require.resolve('../lib/audit-logger')];
  return require('../lib/audit-logger');
}

test.afterEach(() => {
  process.env.HOME = ORIGINAL_HOME;
  process.env.USER = ORIGINAL_USER;
});

test('appendAuditLog creates ~/.opencode and writes JSON line with required fields', () => {
  const homeDir = path.join(process.cwd(), '.test-home-1');
  fs.rmSync(homeDir, { recursive: true, force: true });

  process.env.USER = 'test-user';
  const { appendAuditLog, AUDIT_DIR, AUDIT_FILE } = loadAuditLoggerWithHome(homeDir);

  appendAuditLog('auth.login', { provider: 'openai' });

  assert.equal(AUDIT_DIR, path.join(homeDir, '.opencode'));
  assert.equal(AUDIT_FILE, path.join(homeDir, '.opencode', 'audit.log'));
  assert.ok(fs.existsSync(AUDIT_DIR));
  assert.ok(fs.existsSync(AUDIT_FILE));

  const lines = fs.readFileSync(AUDIT_FILE, 'utf-8').trim().split('\n');
  assert.equal(lines.length, 1);

  const entry = JSON.parse(lines[0]);
  assert.equal(entry.action, 'auth.login');
  assert.equal(entry.user, 'test-user');
  assert.deepEqual(entry.details, { provider: 'openai' });
  assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);

  fs.rmSync(homeDir, { recursive: true, force: true });
});

test('appendAuditLog appends lines instead of overwriting', () => {
  const homeDir = path.join(process.cwd(), '.test-home-2');
  fs.rmSync(homeDir, { recursive: true, force: true });

  process.env.USER = 'append-user';
  const { appendAuditLog, AUDIT_FILE } = loadAuditLoggerWithHome(homeDir);

  appendAuditLog('auth.login', { one: 1 });
  appendAuditLog('auth.switch', { two: 2 });

  const lines = fs.readFileSync(AUDIT_FILE, 'utf-8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).action, 'auth.login');
  assert.equal(JSON.parse(lines[1]).action, 'auth.switch');

  fs.rmSync(homeDir, { recursive: true, force: true });
});

test('appendAuditLog logs warning and does not throw on write failure', () => {
  const homeDir = path.join(process.cwd(), '.test-home-3');
  fs.rmSync(homeDir, { recursive: true, force: true });

  const { appendAuditLog } = loadAuditLoggerWithHome(homeDir);

  const originalAppend = fs.appendFileSync;
  const originalError = console.error;
  let warningMessage = '';

  fs.appendFileSync = () => {
    throw new Error('disk full');
  };
  console.error = (msg) => {
    warningMessage = String(msg);
  };

  assert.doesNotThrow(() => appendAuditLog('auth.fail', { reason: 'io' }));
  assert.match(warningMessage, /Warning: Failed to write audit log: disk full/);

  fs.appendFileSync = originalAppend;
  console.error = originalError;

  fs.rmSync(homeDir, { recursive: true, force: true });
});
