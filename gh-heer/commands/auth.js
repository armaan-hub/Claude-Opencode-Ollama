const { getOrgSecret } = require('../lib/github-secrets');
const { readConfig, writeConfig } = require('../lib/config-manager');
const { appendAuditLog } = require('../lib/audit-logger');
const chalk = require('chalk');

const PROVIDER_SECRETS = {
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  google_gemini: 'GOOGLE_GEMINI_KEY',
  github_copilot: 'GITHUB_OAUTH_TOKEN',
};

async function authCommand(orgName = 'heer-org') {
  console.log(chalk.blue(`Authenticating with GitHub Org: ${orgName}`));

  const config = readConfig();
  let updatedCount = 0;

  for (const [provider, secretName] of Object.entries(PROVIDER_SECRETS)) {
    try {
      const secretValue = await getOrgSecret(secretName);

      if (!config.providers[provider]) {
        config.providers[provider] = {};
      }

      if (provider === 'github_copilot') {
        config.providers[provider].token = secretValue;
      } else {
        config.providers[provider].apiKey = secretValue;
      }

      console.log(chalk.green(`✓ ${provider}: updated`));
      updatedCount++;
    } catch (error) {
      console.log(chalk.yellow(`⚠ ${provider}: ${error.message}`));
    }
  }

  if (updatedCount === 0) {
    throw new Error('No providers authenticated. Check GitHub Org Secrets and permissions.');
  }

  writeConfig(config);
  appendAuditLog('auth', { org: orgName, providers: updatedCount });

  console.log(chalk.green(`\n✓ Authenticated ${updatedCount} provider(s)`));
}

module.exports = { authCommand };
