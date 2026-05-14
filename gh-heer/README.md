# gh-heer — Multi-Provider LLM Authentication for GitHub CLI

Seamlessly authenticate and switch between multiple LLM providers from your GitHub CLI.

## Features

- **Centralized Credential Management**: Store API keys in GitHub Organization Secrets
- **Instant Model Switching**: Change LLM provider/model without CLI restart
- **Team Collaboration**: Share credentials securely across Heer organization
- **Audit Logging**: Track who authenticated when and which models were used

## Installation

### From Source

1. Clone the repository:
```bash
git clone https://github.com/heer/gh-heer
cd gh-heer
npm install
```

2. Install as GitHub CLI extension:
```bash
gh extension install .
```

### Verify Installation

```bash
gh heer --version
```

## Usage

### Authenticate with GitHub Org Secrets

```bash
gh heer auth
```

This command:
1. Reads API keys from your GitHub Organization Secrets
2. Caches them in `~/.opencode/opencode-proxy-config.json`
3. Logs the action to `~/.opencode/audit.log`

**Required GitHub Organization Secrets:**
- `OPENAI_API_KEY` — OpenAI API key for GPT models
- `GROQ_API_KEY` — Groq API key for Mixtral/LLaMA models
- `GOOGLE_GEMINI_KEY` — Google Gemini API key
- `GITHUB_OAUTH_TOKEN` — GitHub OAuth token for Copilot

**Example:**
```bash
$ gh heer auth
Authenticating with GitHub Org: heer-org
✓ openai: updated
✓ groq: updated
✓ google_gemini: updated
✓ github_copilot: updated

✓ Authenticated 4 provider(s)
```

### Switch Between Models

Switch to different LLM models instantly:

```bash
gh heer switch gpt-4-turbo
gh heer switch groq/mixtral
gh heer switch google/gemini-pro
gh heer switch copilot/gpt-4.1
```

The proxy automatically detects the new model and routes requests accordingly. No restart needed.

**Example:**
```bash
$ gh heer switch gpt-4-turbo
Switching to model: gpt-4-turbo
✓ Switched to gpt-4-turbo
```

### View Status

Check the current authentication and proxy status:

```bash
gh heer status
```

**Example Output:**
```
=== gh-heer Status ===

Active Model: gpt-4-turbo
Configured Providers: openai, groq, google_gemini, github_copilot
Proxy Models Available: 15
✓ Proxy is running at localhost:4001
```

## Architecture

The plugin does NOT modify the proxy server. Instead, it manages three files:

1. **`~/.opencode/opencode-proxy-config.json`** — Cached provider API keys (from GitHub Org Secrets)
2. **`~/.claude/active-model`** — Active model name (watched by proxy for instant switching)
3. **`~/.opencode/audit.log`** — Append-only log of auth events (team accountability)

The proxy already handles:
- Multi-provider routing
- OAuth flows
- Request/response translation between provider APIs
- Model switching via file watching

## Configuration

### Proxy Server

Ensure the proxy server is running:
```bash
node opencode-proxy-server.js
```

The proxy listens on `localhost:4001` by default.

### Environment Variables

Create a `.env` file if needed:
```env
PROXY_URL=http://localhost:4001
ORG_NAME=heer-org
```

## Troubleshooting

### Proxy unreachable?

**Error:** `✗ Proxy unreachable: connect ECONNREFUSED 127.0.0.1:4001`

**Solution:**
1. Verify proxy is running:
   ```bash
   ps aux | grep opencode-proxy
   ```
2. Start proxy:
   ```bash
   node opencode-proxy-server.js
   ```
3. Test connectivity:
   ```bash
   curl http://localhost:4001/v1/models
   ```

### Authentication failed?

**Error:** `Error: No providers authenticated. Check GitHub Org Secrets and permissions.`

**Solution:**
1. Verify GitHub CLI is authenticated:
   ```bash
   gh auth status
   ```
2. Check organization secrets exist:
   ```bash
   gh secret list --org heer-org
   ```
3. Ensure your user has permission to read org secrets (requires Owner or Secret admin role)

### Model not found?

**Error:** `Error: Model gpt-5 not found. Available models: gpt-4-turbo, gpt-4, gpt-3.5-turbo, mixtral-8x7b, gemini-pro`

**Solution:**
1. Run `gh heer status` to see available models
2. Ensure proxy config includes the provider credentials
3. Verify provider API key is valid

### Config file permissions error?

**Error:** `Error: Permission denied: ~/.opencode/opencode-proxy-config.json`

**Solution:**
```bash
chmod 600 ~/.opencode/opencode-proxy-config.json
```

## Security

- **GitHub Org Secrets** store master credentials (encrypted, only readable via `gh` CLI with proper permissions)
- **Local Config** cached in `~/.opencode/` (readable by user only: chmod 600)
- **Audit Log** tracks all authentication events (for compliance/debugging)
- **No credentials in environment** — passed directly to proxy config file
- **No credentials in logs** — only provider names logged

## Development Setup

### Install Dependencies

```bash
npm install
npm install --save-dev jest @types/jest
```

### Run Tests

```bash
npm test
```

### Run CLI in Development

```bash
npm run dev
```

Or directly:
```bash
node index.js auth --help
node index.js switch gpt-4
node index.js status
```

### Project Structure

```
gh-heer/
├── index.js              # CLI entry point (Commander)
├── gh-heer              # Bash wrapper for GitHub CLI
├── package.json         # Dependencies and metadata
├── commands/
│   ├── auth.js          # Authenticate with GitHub Org Secrets
│   ├── switch.js        # Switch active model
│   └── status.js        # Show status
├── lib/
│   ├── github-secrets.js    # GitHub API client
│   ├── config-manager.js    # Config file I/O
│   ├── audit-logger.js      # Audit log tracking
│   └── proxy-client.js      # Proxy communication
├── tests/               # Jest test suites
└── README.md           # This file
```

## Future: Enterprise Model

When the team grows to >10 developers, upgrade to Option C:
- Per-developer OAuth tokens (instead of shared credentials)
- Revocation on offboarding
- Usage-based cost allocation
- GitHub Organization Access Control

## Contributing

1. Fork and create a feature branch
2. Write tests for new commands using Jest
3. Run `npm test` to verify all tests pass
4. Ensure `npm run lint` passes (if linting is configured)
5. Submit PR with detailed description

### Testing Guidelines

- Write unit tests for new commands in `tests/`
- Use mocks for external API calls (GitHub, proxy)
- Ensure 100% test pass rate before submitting PR
- Update README if adding new commands or features

## License

MIT

## Support

For issues, questions, or feature requests:
1. Check the [Troubleshooting](#troubleshooting) section
2. Open an issue on GitHub
3. Contact the Heer team

## Related Documentation

- [GitHub CLI Documentation](https://cli.github.com)
- [Commander.js Documentation](https://github.com/tj/commander.js)
- [Proxy Server Documentation](./PROXY_SERVER.md) (if available)
