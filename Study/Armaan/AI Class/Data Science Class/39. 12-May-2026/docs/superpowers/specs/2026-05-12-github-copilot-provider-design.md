# GitHub Copilot Provider + /model Command Fix

**Date:** 2026-05-12  
**Status:** Approved  
**Scope:** Add GitHub Copilot as provider 6 in the proxy, fix the `/model` slash command in Claude Code, and add a Copilot auth panel to the proxy dashboard.

---

## Problem Statement

1. **`/model` slash command doesn't work inside Claude Code** — the `model.md` file is in the wrong location (`~/.claude/plugins/.../commands/model.md`). Claude Code loads custom slash commands from `~/.claude/commands/`, not from the plugin folder. So the command either doesn't appear or shows only built-in Anthropic models.

2. **GitHub Copilot models are missing** — models like GPT-5.4, Claude Opus 4.7, Grok Code Fast 1 are available via the official `api.githubcopilot.com` API using the existing `gh auth` login, but they're not in the proxy or any model picker.

3. **No way to manage Copilot login from the dashboard** — users need a UI to check GitHub auth status, test the connection, login, and logout without opening a terminal.

---

## Architecture

```
Claude Code
  → ANTHROPIC_BASE_URL=http://localhost:4001
  → opencode-proxy-server.js (port 4001)
      getProviderForModel('copilot/gpt-4.1')
      → strip 'copilot/' prefix
      → get token: execSync('gh auth token') [cached 5 min TTL]
      → POST api.githubcopilot.com/chat/completions
         Headers: Authorization, Editor-Version, Copilot-Integration-Id
      → response (OpenAI format) → pipe back to Claude Code

Claude Code slash command:
  /model           → ~/.claude/commands/model.md
  /model gpt-4.1   → writes to ~/.claude/active-model
  proxy reads ~/.claude/active-model on each request → routes to correct provider
```

---

## Components

### Task 1 — Fix `/model` slash command (`~/.claude/commands/model.md`)

**Location:** `~/.claude/commands/model.md` (this is the correct location for Claude Code custom slash commands)

**Remove:** Old `~/.claude/plugins/cache/local/universal-model-switcher/1.0.0/commands/model.md` and plugin registration (it's not the right mechanism)

**Behaviour:**
- `/model` — show current active model + grouped list of all proxy models
- `/model <name>` — validate model exists in proxy list, write to `~/.claude/active-model`, confirm switch
- `/model clear` — remove `~/.claude/active-model`, confirm cleared
- `/model list` — show all available models grouped by provider
- `/model status` — show current override

**Security:** Use `printf '%s\n' 'MODEL'` not `echo` to write the file (injection-safe).

**Allowed tools:** `Bash(printf *)`, `Bash(mkdir *)`, `Bash(cat *)`, `Bash(rm *)`, `Bash(curl *)`, `Bash(python3 *)`

---

### Task 2 — Add Copilot provider to proxy (`~/opencode-proxy-server.js`)

**New constants:**
```
COPILOT_HOST = 'api.githubcopilot.com'
COPILOT_BASE = '/chat/completions'  (but mounted at /v1 level: '/v1/chat/completions' or just via forwardToProvider)
COPILOT_EDITOR_VERSION = 'vscode/1.99.0'
COPILOT_INTEGRATION_ID = 'vscode-chat'
```

**Token management:**
```js
let _copilotToken = null;
let _copilotTokenTime = 0;
const COPILOT_TOKEN_TTL = 5 * 60 * 1000; // 5 minutes

function getCopilotToken() {
  const now = Date.now();
  if (_copilotToken && now - _copilotTokenTime < COPILOT_TOKEN_TTL) return _copilotToken;
  try {
    _copilotToken = require('child_process').execSync('gh auth token', {encoding:'utf8'}).trim();
    _copilotTokenTime = now;
    return _copilotToken;
  } catch { return null; }
}
```

**Model list (`/v1/models`):** Add 11 Copilot models with `owned_by: 'github-copilot'`:
- `copilot/claude-opus-4.7` — Claude Opus 4.7 via GitHub Copilot
- `copilot/claude-opus-4.6-1m` — Claude Opus 4.6 1M context via GitHub Copilot
- `copilot/claude-sonnet-4.6` — Claude Sonnet 4.6 via GitHub Copilot
- `copilot/claude-sonnet-4.5` — Claude Sonnet 4.5 via GitHub Copilot
- `copilot/claude-haiku-4.5` — Claude Haiku 4.5 via GitHub Copilot
- `copilot/claude-opus-4.5` — Claude Opus 4.5 via GitHub Copilot
- `copilot/gpt-5.4` — GPT-5.4 via GitHub Copilot
- `copilot/gpt-5.2` — GPT-5.2 via GitHub Copilot
- `copilot/gpt-5-mini` — GPT-5 mini via GitHub Copilot
- `copilot/gpt-4.1` — GPT-4.1 via GitHub Copilot
- `copilot/grok-code-fast-1` — Grok Code Fast 1 via GitHub Copilot

*(Excluded: GPT-5.5, GPT-5.3-Codex, GPT-5.2-Codex — these only support `/responses` API, not `/chat/completions`)*

**Routing in `getProviderForModel()`:**
```js
if (modelId.startsWith('copilot/')) {
  const actualModel = modelId.slice('copilot/'.length);
  return { name: 'GitHub Copilot', host: COPILOT_HOST, base: '/chat/completions', ssl: true, actualModel };
}
```

**Forwarding in `forwardToProvider()`:** When provider is Copilot:
1. Get token via `getCopilotToken()`
2. If no token → return 401 error: `"GitHub Copilot: not logged in. Run 'gh auth login' in terminal."`
3. Use `actualModel` (not `copilot/model`) in the OpenAI body
4. Add Copilot-specific headers
5. Forward to `https://api.githubcopilot.com/chat/completions`

**Dashboard `/api/config`:** Add `copilotStatus` to GET response: `{loggedIn: bool, user: string|null}` from `gh auth status` output.

**New endpoint `/api/copilot/login`:** POST → spawn `gh auth login --web`, return `{ok: true}`

**New endpoint `/api/copilot/logout`:** POST → run `gh auth logout --hostname github.com -y`, return `{ok: true}`, clear token cache

**New endpoint `/api/copilot/test`:** GET → try `GET api.githubcopilot.com/models`, return `{ok: bool, modelCount: number, user: string}`

---

### Task 3 — Update `run-claude-opencode` fzf picker (`~/.zshrc`)

Add all 11 Copilot models to the fzf model list, grouped together with `→ Description via GitHub Copilot (subscription)` labels:

```
copilot/claude-opus-4.7     → Claude Opus 4.7 via GitHub Copilot (subscription)
copilot/claude-opus-4.6-1m  → Claude Opus 4.6 1M context via Copilot
copilot/claude-sonnet-4.6   → Claude Sonnet 4.6 via GitHub Copilot (subscription)
copilot/claude-sonnet-4.5   → Claude Sonnet 4.5 via GitHub Copilot (subscription)
copilot/claude-haiku-4.5    → Claude Haiku 4.5 via GitHub Copilot (subscription)
copilot/claude-opus-4.5     → Claude Opus 4.5 via GitHub Copilot (subscription)
copilot/gpt-5.4             → GPT-5.4 via GitHub Copilot (subscription)
copilot/gpt-5.2             → GPT-5.2 via GitHub Copilot (subscription)
copilot/gpt-5-mini          → GPT-5 mini via GitHub Copilot (subscription)
copilot/gpt-4.1             → GPT-4.1 via GitHub Copilot (subscription)
copilot/grok-code-fast-1    → Grok Code Fast 1 via GitHub Copilot (subscription)
```

---

### Task 4 — GitHub Copilot auth panel in proxy dashboard

**New nav item:** `🐙 Copilot` (added to the nav bar beside existing items)

**Panel contents:**
- Auth status card: shows ✅ `Logged in as <username>` or ❌ `Not connected`
- "Test Connection" button → calls `/api/copilot/test` → shows model count
- "Login with GitHub" button (shown when not logged in) → calls `/api/copilot/login` → polls auth status every 2s until success
- "Disconnect" button (shown when logged in) → calls `/api/copilot/logout` → refreshes status

**Dashboard JS:** `loadCopilotStatus()` function polls `/api/config` copilotStatus field on panel show.

---

### Task 5 — Integration tests

Update `~/test-universal-proxy.sh` to add:
- Test 6: Copilot models appear in `/v1/models` list (e.g., `copilot/gpt-4.1`)
- Test 7: Active model with `copilot/gpt-4.1` prefix routes to Copilot (check proxy log)
- Test 8: `/api/copilot/test` returns ok=true and modelCount > 0
- Test 9: `set-model copilot/claude-sonnet-4.6` writes file correctly
- Test 10: `~/.claude/commands/model.md` exists and is readable

---

## Error Handling

- **`gh` not installed:** `forwardToProvider` returns 503 with message "GitHub Copilot requires 'gh' CLI. Install from: https://cli.github.com"
- **Not logged in:** Returns 401 with message "Not logged in to GitHub. Run 'gh auth login' in terminal or use the proxy dashboard."
- **Token expired:** The 5-min TTL means the token refreshes frequently. `gh auth token` auto-refreshes tokens internally.
- **Model not in chat/completions list:** The model is simply not added to the `COPILOT_MODELS` array, so it won't be routable.

---

## Testing Plan

Each task is tested independently:

1. **Task 1:** Confirm `/model` appears in Claude Code slash command menu; confirm switching writes the file; confirm proxy picks it up
2. **Task 2:** Unit test: `getCopilotToken()` returns non-empty string; integration: send a real message via `copilot/gpt-4.1` and verify response
3. **Task 3:** Run `run-claude-opencode` and verify Copilot models appear in fzf list
4. **Task 4:** Open dashboard, navigate to Copilot panel, verify auth status shows correctly
5. **Task 5:** Run `~/test-universal-proxy.sh` and all 10 tests pass

---

## Files Changed

| File | Change |
|------|--------|
| `~/.claude/commands/model.md` | **CREATE** (new location for slash command) |
| `~/.claude/plugins/installed_plugins.json` | Remove `universal-model-switcher@local` entry |
| `~/.claude/plugins/cache/local/universal-model-switcher/` | Remove directory |
| `~/opencode-proxy-server.js` | Add Copilot provider, token cache, 3 new endpoints, dashboard panel |
| `~/.zshrc` | Add 11 Copilot models to fzf picker |
| `~/test-universal-proxy.sh` | Add tests 6–10 |
