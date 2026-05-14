const fs = require('fs');
const path = require('path');
const os = require('os');

const AUDIT_DIR = path.join(os.homedir(), '.opencode');
const AUDIT_FILE = path.join(AUDIT_DIR, 'audit.log');

function ensureAuditDir() {
  if (!fs.existsSync(AUDIT_DIR)) {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
  }
}

function appendAuditLog(action, details = {}) {
  ensureAuditDir();

  const timestamp = new Date().toISOString();
  const user = process.env.USER || 'unknown';
  const logEntry = JSON.stringify({
    timestamp,
    action,
    user,
    details,
  });

  try {
    fs.appendFileSync(AUDIT_FILE, logEntry + '\n', 'utf-8');
  } catch (error) {
    console.error(`Warning: Failed to write audit log: ${error.message}`);
    // Non-critical: don't fail the command if audit logging fails
  }
}

module.exports = { appendAuditLog, AUDIT_DIR, AUDIT_FILE };
