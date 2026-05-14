const { execSync } = require('child_process');

const ORG_NAME = process.env.GITHUB_ORG || 'heer-org';

async function getOrgSecret(secretName) {
  try {
    const output = execSync(
      `gh secret list --org ${ORG_NAME} --json name,value 2>/dev/null || echo '[]'`,
      {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }
    );

    let secrets;
    try {
      secrets = JSON.parse(output || '[]');
    } catch (parseError) {
      throw new Error(`Invalid JSON response from gh CLI: ${parseError.message}`);
    }

    const secret = secrets.find((s) => s.name === secretName);

    if (!secret) {
      throw new Error(`Secret ${secretName} not found in org ${ORG_NAME}`);
    }

    return secret.value;
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(
        `Failed to fetch secret ${secretName}: gh CLI is not installed or not available in PATH`
      );
    }

    throw new Error(`Failed to fetch secret ${secretName}: ${error.message}`);
  }
}

module.exports = { getOrgSecret };
