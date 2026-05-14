describe('getOrgSecret', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.GITHUB_ORG;
  });

  test('exports getOrgSecret function', () => {
    const mod = require('../lib/github-secrets');
    expect(typeof mod.getOrgSecret).toBe('function');
  });

  test('returns matching secret value from gh output', async () => {
    const childProcess = require('child_process');
    jest.spyOn(childProcess, 'execSync').mockReturnValue(
      JSON.stringify([
        { name: 'OPENAI_API_KEY', value: 'sk-test' },
        { name: 'GROQ_API_KEY', value: 'gsk-test' },
      ])
    );

    const { getOrgSecret } = require('../lib/github-secrets');
    const value = await getOrgSecret('OPENAI_API_KEY');

    expect(value).toBe('sk-test');
  });

  test('uses GITHUB_ORG env var with fallback to heer-org', async () => {
    process.env.GITHUB_ORG = 'custom-org';
    const childProcess = require('child_process');
    const execSpy = jest
      .spyOn(childProcess, 'execSync')
      .mockReturnValue(JSON.stringify([{ name: 'OPENAI_API_KEY', value: 'sk-test' }]));

    const { getOrgSecret } = require('../lib/github-secrets');
    await getOrgSecret('OPENAI_API_KEY');

    expect(execSpy).toHaveBeenCalledWith(
      expect.stringContaining('gh secret list --org custom-org --json name,value'),
      expect.any(Object)
    );
  });

  test('throws when secret is not found', async () => {
    const childProcess = require('child_process');
    jest
      .spyOn(childProcess, 'execSync')
      .mockReturnValue(JSON.stringify([{ name: 'OTHER', value: 'x' }]));

    const { getOrgSecret } = require('../lib/github-secrets');

    await expect(getOrgSecret('OPENAI_API_KEY')).rejects.toThrow(
      'Secret OPENAI_API_KEY not found in org heer-org'
    );
  });

  test('wraps JSON parse errors with context', async () => {
    const childProcess = require('child_process');
    jest.spyOn(childProcess, 'execSync').mockReturnValue('not-json');

    const { getOrgSecret } = require('../lib/github-secrets');

    await expect(getOrgSecret('OPENAI_API_KEY')).rejects.toThrow(
      'Failed to fetch secret OPENAI_API_KEY:'
    );
  });

  test('handles missing gh CLI gracefully', async () => {
    const childProcess = require('child_process');
    jest.spyOn(childProcess, 'execSync').mockImplementation(() => {
      const err = new Error('spawnSync gh ENOENT');
      err.code = 'ENOENT';
      throw err;
    });

    const { getOrgSecret } = require('../lib/github-secrets');

    await expect(getOrgSecret('OPENAI_API_KEY')).rejects.toThrow(
      'gh CLI is not installed or not available in PATH'
    );
  });
});
