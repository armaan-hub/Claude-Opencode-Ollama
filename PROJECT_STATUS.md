# Project Status & Continuation Guide

> **Last updated:** May 17, 2026  
> **Purpose:** Complete snapshot of what has been built, how it works, and how to continue.  
> If you're picking this project up fresh — start here.

---

## What This Project Is

A **local reverse proxy** (`opencode-proxy-server.js`) that sits between Claude Code and any AI provider. Claude Code normally only works with Anthropic models. This proxy intercepts every request, reads a user-controlled model file (`~/.claude/active-model`), and routes the request to the correct provider — OpenCode, GitHub Copilot, Gemini, Groq, Nvidia NIM, OpenRouter, Ollama, or OpenAI.

```
Claude Code  ──►  Proxy (127.0.0.1:4001)  ──►  Any Provider / Model
                         │
                  reads ~/.claude/active-model
                  translates request format
                  returns standard response
```

**Core value:** 57+ free and paid models inside Claude Code, switched instantly, no restart needed.

---

## Current State (What Has Been Built)

### ✅ Core Proxy (`opencode-proxy-server.js` — 2,358 lines)
- Listens on `127.0.0.1:4001`
- Translates Anthropic Claude API format → each provider's native format
- Reads `~/.claude/active-model` on **every request** (instant switching, no restart)
- Supports streaming (SSE) responses
- Handles tool calls / function calling for all providers
- GitHub Copilot OAuth flow (get token via `gh` CLI)
- API key auth for: Gemini, OpenAI, Groq, Nvidia NIM, OpenRouter, OpenCode
- Ollama local model support (no key needed)
- OpenCode free tier (no key needed — always available)

### ✅ Web Portal (`http://127.0.0.1:4001`)
Four pages served by the proxy itself:

| Page | URL | What it does |
|------|-----|---|
| Dashboard | `/` | Live stats: active model, request counts, uptime, provider breakdown |
| Providers | `/providers` | Connect/disconnect providers, enter API keys, OAuth button |
| Models | `/models` | Browse all available models grouped by provider |
| Settings | `/settings` | View proxy configuration |

**Security fixes applied:** XSS via `esc()` helper in all innerHTML, JSON injection via `python3 json.dumps()`, disconnect whitelist.

### ✅ Shell Scripts (`bin/`)

| Script | What it does |
|--------|---|
| `run-claude-opencode` | Main launcher — starts proxy if needed, shows fzf model picker, injects proxy models into Claude Code's native picker, launches `claude --dangerously-skip-permissions` |
| `switch-model` | Terminal command to switch model without restarting — `switch-model opencode/minimax-m2.5-free` or no args for fzf picker |
| `switch-model-chat` | Switch model from **inside** a running Claude Code session (as a slash command) |
| `switch-model-visual` | Visual alternative picker |
| `model` | Quick model info / list |
| `model-open` | Open model selector |
| `connect-provider` | CLI to connect/disconnect providers — `connect-provider status`, `connect-provider gemini <key>`, `connect-provider copilot` |

### ✅ Claude Code Integration (`.claude/`)
- `/switch-model` — slash command inside Claude Code to switch model instantly
- `/providers` — slash command to open provider management in browser
- `/provider` — slash command for quick provider status
- `/connect-provider` — slash command wrapper for the CLI tool
- `CLAUDE.md` — project instructions visible to Claude Code
- `settings.json` — default Claude Code settings for this project

### ✅ Security
- `opencode-proxy-config.json` (contains real API keys) is **gitignored** — never committed
- `opencode-proxy-config.example.json` shows the structure with placeholder values
- All 236 git history commits were rewritten with `git-filter-repo` to remove previously leaked keys
- OAuth state stored in `lib/oauth_state.js` (in-memory, not persisted)

---

## Architecture Deep Dive

### How Model Routing Works
```
1. Claude Code sends POST /v1/messages {"model": "claude-sonnet-4-5", ...}
2. Proxy reads ~/.claude/active-model → e.g. "opencode/minimax-m2.5-free"
3. Proxy ignores the model field from Claude Code, uses active-model instead
4. Proxy translates request body to provider format
5. Proxy sends to correct endpoint (opencode API, GitHub, etc.)
6. Proxy translates response back to Anthropic format
7. Claude Code receives standard response — it doesn't know about the proxy
```

### How Native Model Picker Injection Works
`run-claude-opencode` modifies `~/.claude/cache/gateway-models.json` before launching Claude Code:
- Saves original gateway-models.json as `gateway-models-original.json` (once, permanently)
- Fetches all proxy models from `/v1/models`
- Injects them with `anthropic/opencode/...` or `anthropic/gh-copilot/...` prefix (Claude Code only shows `anthropic/` prefixed models)
- Restores original on exit via `trap cleanup_gateway EXIT`

### Config File Structure (`opencode-proxy-config.json`)
```json
{
  "port": 4001,
  "providers": {
    "opencode": { "apiKeyGo": "...", "apiKeyFree": "..." },
    "github": { "clientId": "...", "clientSecret": "..." },
    "gemini": { "apiKey": "" },
    "openai": { "apiKey": "" },
    "groq": { "apiKey": "" },
    "nvidia": { "apiKey": "" },
    "openrouter": { "apiKey": "" }
  }
}
```

---

## Files Reference

```
Claude-Opencode-Ollama/
├── opencode-proxy-server.js        ← Main proxy (ALL logic here — 2,358 lines)
├── opencode-proxy-config.example.json ← Config template (safe to commit)
├── opencode-proxy-config.json      ← REAL config with keys (gitignored, local only)
├── lib/
│   └── oauth_state.js              ← GitHub OAuth state management
├── bin/
│   ├── run-claude-opencode         ← Primary launcher script
│   ├── switch-model                ← Model switcher (terminal)
│   ├── switch-model-chat           ← Model switcher (inside Claude Code)
│   ├── switch-model-visual         ← Visual model picker
│   ├── model                       ← Model info/list
│   ├── model-open                  ← Model open picker
│   └── connect-provider            ← Provider connect/disconnect CLI
├── .claude/
│   ├── CLAUDE.md                   ← Instructions for Claude Code
│   ├── settings.json               ← Claude Code project settings
│   ├── statusline-command.sh       ← Status line helper
│   └── commands/
│       ├── switch-model.md         ← /switch-model slash command
│       ├── providers.md            ← /providers slash command
│       ├── provider.md             ← /provider slash command
│       └── connect-provider.md     ← /connect-provider slash command
├── tests/
│   └── oauth_state.test.js         ← Unit tests for OAuth state
├── setup_workspace.sh              ← 7-pane tmux workspace launcher
├── test_workspace.sh               ← Tests for workspace launcher
├── test-universal-proxy.sh         ← Integration tests for proxy
├── docs/
│   └── superpowers/
│       ├── plans/                  ← Implementation plans
│       └── specs/                  ← Feature design specs
└── README.md                       ← Full installation + usage guide
```

---

## Providers Currently Supported

| Provider | Auth | Free? | Models |
|----------|------|-------|--------|
| OpenCode (Zen) | API key (or free tier) | ✅ Free tier always works | 19+ (MiniMax, Kimi, Ring, Nemotron, etc.) |
| GitHub Copilot | OAuth via `gh` CLI | ✅ With subscription | 9 (Claude Sonnet/Haiku/Opus, GPT-5.4, GPT-5-mini) |
| Ollama | None (local) | ✅ Local only | Whatever you pull locally |
| Google Gemini | API key | ❌ | Gemini 2.0 Flash, Pro, etc. |
| OpenAI / Codex | API key | ❌ | GPT-5.x, o3, etc. |
| Groq | API key | ❌ (free tier available) | Llama 3.3, DeepSeek, etc. |
| Nvidia NIM | API key | ❌ (free tier available) | Llama, Nemotron, etc. |
| OpenRouter | API key | ❌ (some free models) | 100s of models |

---

## How to Start Fresh (Quick Setup)

### 1. Install prerequisites
```bash
brew install node fzf python3    # macOS
npm install -g @anthropic-ai/claude-code
```

### 2. Clone and install
```bash
git clone https://github.com/armaan-hub/Claude-Opencode-Ollama.git ~/Claude-Opencode-Ollama
cp ~/Claude-Opencode-Ollama/opencode-proxy-config.example.json ~/Claude-Opencode-Ollama/opencode-proxy-config.json
# Edit opencode-proxy-config.json with your real API keys
```

### 3. Install scripts to ~/bin
```bash
mkdir -p ~/bin
cp ~/Claude-Opencode-Ollama/bin/* ~/bin/
chmod +x ~/bin/*
```

### 4. Add shell functions to ~/.zshrc
```bash
# Proxy functions
export PATH="$HOME/bin:$PATH"

run-claude-opencode() {
  "$HOME/bin/run-claude-opencode"
}
set-model() {
  # Sets ~/.claude/active-model directly
  [[ -z "$1" ]] && cat ~/.claude/active-model 2>/dev/null && return
  echo "$1" > ~/.claude/active-model && echo "✅ Model set to: $1"
}
```

### 5. Create proxy settings dir
```bash
mkdir -p ~/.claude-proxy
cp ~/.claude/settings.json ~/.claude-proxy/settings.json 2>/dev/null || echo '{}' > ~/.claude-proxy/settings.json
```

### 6. Run
```bash
run-claude-opencode     # Interactive model picker → launches Claude Code
# OR
run-claude-opencode opencode/minimax-m2.5-free   # Direct model
```

---

## Known Issues & Limitations

| Issue | Status | Notes |
|-------|--------|-------|
| OpenCode `apiKeyGo`/`apiKeyFree` leaked in git history | ✅ Fixed | History rewritten, keys must be rotated |
| GitHub OAuth `clientSecret` leaked in git history | ✅ Fixed | History rewritten, secret must be rotated |
| Providers page blank (esc() missing) | ✅ Fixed | May 17, 2026 |
| Terminal pane title shows stale model after exit | ✅ Fixed | May 17, 2026 |
| OpenCode free tier: DEFAULT_CONFIG keys are `REDACTED_*` | ⚠️ Action needed | User MUST add real OpenCode keys to local config |

---

## What Needs To Be Done Next

### High Priority
- [ ] **Rotate leaked API keys** (cannot be done in code — manual):
  - OpenCode `apiKeyGo` and `apiKeyFree` → regenerate at opencode.ai
  - GitHub OAuth Client Secret → regenerate at github.com/settings/developers
  - Update `~/Claude-Opencode-Ollama/opencode-proxy-config.json` with new values

### Potential Future Features
- [ ] Web portal: Usage analytics / cost tracking per provider
- [ ] Auto-fallback: If active model fails, fall back to free OpenCode model
- [ ] Rate limiting display: Show how close you are to provider limits
- [ ] Model favorites: Pin frequently used models to top of picker
- [ ] Browser extension: Model switcher accessible from browser
- [ ] Windows support: The shell scripts are bash-only (PowerShell versions needed)

---

## Testing

```bash
# Unit tests (Jest)
cd ~/Claude-Opencode-Ollama && npx jest tests/unit/ --no-coverage

# Integration test (proxy must be running)
cd ~/Claude-Opencode-Ollama && bash test-universal-proxy.sh

# Manual: verify proxy is healthy
curl http://127.0.0.1:4001/health

# Manual: list all available models
curl -s http://127.0.0.1:4001/v1/models | python3 -c "import sys,json; [print(m['id']) for m in json.load(sys.stdin)['data']]"
```

---

## Key Design Decisions (Why Things Are The Way They Are)

1. **Single JS file** (`opencode-proxy-server.js`) — all logic including HTML for the web portal is embedded. Keeps deployment simple (just `node opencode-proxy-server.js`).

2. **`~/.claude/active-model` read on every request** — means you can switch models mid-conversation without restarting anything.

3. **`anthropic/` prefix injection** — Claude Code's native model picker only shows models with the `anthropic/` prefix. We inject proxy models with this prefix so they appear in the picker. The proxy strips this prefix when routing.

4. **Proxy survives Claude Code exit** — started with `nohup`, not tied to Claude Code process. You keep your conversation context if you restart Claude Code.

5. **`run-claude-opencode` uses `--settings` flag** — passes a temp settings file so we can inject proxy URL (`127.0.0.1:4001`) without permanently modifying the user's global Claude settings.

---

*This file is the single source of truth for project state. Update it when major features are added or bugs are fixed.*
