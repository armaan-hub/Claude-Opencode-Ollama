const fs = require('fs');
const path = require('path');
const os = require('os');
const { getProxyStatus } = require('../lib/proxy-client');
const { appendAuditLog } = require('../lib/audit-logger');
const chalk = require('chalk');

const ACTIVE_MODEL_FILE = path.join(os.homedir(), '.claude', 'active-model');

async function switchCommand(modelName) {
  if (!modelName) {
    throw new Error('Model name required. Usage: gh heer switch <model>');
  }

  console.log(chalk.blue(`Switching to model: ${modelName}`));

  // Verify model exists
  try {
    const response = await getProxyStatus();
    const modelList = response.data || [];
    const modelExists = modelList.some(m => m.id === modelName);

    if (!modelExists) {
      const availableModels = modelList.map(m => m.id).join(', ');
      throw new Error(`Model ${modelName} not found. Available models: ${availableModels}`);
    }
  } catch (error) {
    // If error is already a "Model not found" error from validation above, re-throw as-is
    if (error.message.includes('not found')) {
      throw error;
    }
    // Otherwise it's a proxy communication error
    throw new Error(`Failed to verify model with proxy: ${error.message}`);
  }

  // Write to active model file
  const dir = path.dirname(ACTIVE_MODEL_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(ACTIVE_MODEL_FILE, modelName, 'utf-8');
  appendAuditLog('switch', { model: modelName });

  console.log(chalk.green(`✓ Switched to ${modelName}`));
}

module.exports = { switchCommand, ACTIVE_MODEL_FILE };
