const fs = require('fs');
const path = require('path');
const os = require('os');
const { getProxyStatus } = require('../lib/proxy-client');
const { readConfig } = require('../lib/config-manager');
const chalk = require('chalk');

const ACTIVE_MODEL_FILE = path.join(os.homedir(), '.claude', 'active-model');

async function statusCommand() {
  console.log(chalk.blue('=== gh-heer Status ===\n'));

  let activeModel = 'none';
  if (fs.existsSync(ACTIVE_MODEL_FILE)) {
    activeModel = fs.readFileSync(ACTIVE_MODEL_FILE, 'utf-8').trim();
  }
  console.log(chalk.cyan('Active Model:'), activeModel);

  const config = readConfig();
  const configuredProviders = Object.entries(config.providers)
    .filter(([_, provider]) => provider.apiKey || provider.token)
    .map(([name]) => name);

  console.log(chalk.cyan('Configured Providers:'), configuredProviders.join(', ') || 'none');

  try {
    const proxyStatus = await getProxyStatus();
    const modelCount = (proxyStatus.data || []).length;
    console.log(chalk.cyan('Proxy Models Available:'), modelCount);
    console.log(chalk.green('✓ Proxy is running at localhost:4001'));
  } catch (error) {
    console.log(chalk.red('✗ Proxy unreachable:'), error.message);
  }

  console.log('');
}

module.exports = { statusCommand };
