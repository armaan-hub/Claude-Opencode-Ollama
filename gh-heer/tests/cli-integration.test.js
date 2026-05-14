const { spawn } = require('child_process');
const path = require('path');

describe('CLI Integration', () => {
  const cliPath = path.join(__dirname, '..', 'index.js');

  const runCli = (args) => {
    return new Promise((resolve, reject) => {
      const process = spawn('node', [cliPath, ...args], {
        cwd: path.dirname(cliPath),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      process.on('error', (error) => {
        reject(error);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
      }, 5000);
    });
  };

  test('CLI shows version', async () => {
    const result = await runCli(['--version']);
    expect(result.stdout).toContain('1.0.0');
  });

  test('auth command help is accessible', async () => {
    const result = await runCli(['auth', '--help']);
    expect(result.stdout).toContain('Authenticate with GitHub Org Secrets');
  });

  test('switch command help is accessible', async () => {
    const result = await runCli(['switch', '--help']);
    expect(result.stdout).toContain('Switch to a different LLM model');
  });

  test('status command help is accessible', async () => {
    const result = await runCli(['status', '--help']);
    expect(result.stdout).toContain('Show authentication and proxy status');
  });

  test('CLI shows help for main command', async () => {
    const result = await runCli(['--help']);
    expect(result.stdout).toContain('Multi-provider LLM authentication for GitHub CLI');
  });
});

