# Claude-Opencode-Ollama Proxy

> **Use Claude Code with 57+ AI models for free** — OpenCode, GitHub Copilot, Gemini, Groq, Nvidia NIM, OpenRouter, Ollama, and OpenAI — all through a single local proxy on port 4001.

Claude Code normally only works with Anthropic models. This proxy sits between Claude Code and any provider you configure, letting you switch models instantly without restarting Claude Code.

---

## Table of Contents

1. [What This Does](#what-this-does)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Daily Usage](#daily-usage)
6. [Switching Models](#switching-models)
7. [Connecting Providers](#connecting-providers)
8. [Provider Setup](#provider-setup)
9. [Troubleshooting](#troubleshooting)
10. [File Reference](#file-reference)

---

## What This Does

```
Claude Code  →  Local Proxy (port 4001)  →  Any AI Provider
                       ↑
              reads ~/.claude/active-model
              routes each request to the
              correct provider/model
```

**Key features:**
- 🆓 **57+ free and paid models** from OpenCode, GitHub Copilot, Gemini, Groq, Nvidia, OpenRouter, Ollama
- ⚡ **Instant model switching** — no restart, takes effect on your next message
- 🎯 **Native Claude Code model picker** — proxy models appear in Claude Code's built-in `⌘K → Select model` list
- 🔄 **Proxy survives Claude Code exit** — runs as a background daemon
- 🖥️ **Interactive fzf model picker** at startup — arrow keys to select
- 💡 **Free tier** — OpenCode provides free models (MiniMax, Ring 2.6, Nemotron, etc.) with no API key needed
- 🔌 **Provider CLI** — connect/disconnect providers instantly with `!~/bin/connect-provider`
- 🌐 **Web portal** — live dashboard at `http://127.0.0.1:4001` with stats and provider management

---

## Prerequisites

Install all of the following before proceeding.

### 1. Node.js (v18 or higher)
Required to run the proxy server.
- **Download:** https://nodejs.org/en/download
- **macOS (Homebrew):** `brew install node`
- **Verify:** `node --version`

### 2. Claude Code (Anthropic CLI)
The AI coding assistant this proxy enhances.
- **Install:** https://claude.ai/code
- **Direct install:** `npm install -g @anthropic-ai/claude-code`
- **Verify:** `claude --version`

### 3. fzf (Fuzzy Finder)
Powers the interactive model picker at startup.
- **macOS (Homebrew):** `brew install fzf`
- **Linux:** `sudo apt install fzf` or `sudo dnf install fzf`
- **Manual install:** https://github.com/junegunn/fzf#installation
- **Verify:** `fzf --version`

### 4. Python 3 (v3.8 or higher)
Used for model list parsing and settings injection.
- **macOS:** Pre-installed. Verify with `python3 --version`
- **Download (if needed):** https://www.python.org/downloads/
- **macOS (Homebrew):** `brew install python@3.11`

### 5. curl
Used to communicate with the proxy API.
- **macOS:** Pre-installed
- **Linux:** `sudo apt install curl`
- **Verify:** `curl --version`

### 6. Git
Required to clone this repository.
- **Download:** https://git-scm.com/downloads
- **macOS (Homebrew):** `brew install git`
- **Verify:** `git --version`

### Optional: Ollama (for local models)
Only needed if you want to run local AI models on your machine.
- **Download:** https://ollama.com/download
- **Verify:** `ollama --version`
- **Pull a model:** `ollama pull qwen3:8b`

---

## Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/armaan-hub/Claude-Opencode-Ollama.git
cd Claude-Opencode-Ollama
```

### Step 2 — Install Node.js dependencies

```bash
npm install
```

> If you don't have a `package.json` yet, the proxy server (`opencode-proxy-server.js`) has no external npm dependencies — it uses only Node.js built-ins. Skip this step.

### Step 3 — Copy scripts to your PATH

```bash
# Create ~/bin if it doesn't exist
mkdir -p ~/bin

# Copy all launcher scripts
cp bin/run-claude-opencode  ~/bin/
cp bin/switch-model         ~/bin/
cp bin/switch-model-visual  ~/bin/
cp bin/switch-model-chat    ~/bin/
cp bin/connect-provider     ~/bin/
cp bin/model                ~/bin/    # optional: alias for switch-model

# Make them executable
chmod +x ~/bin/run-claude-opencode
chmod +x ~/bin/switch-model
chmod +x ~/bin/switch-model-visual
chmod +x ~/bin/switch-model-chat
chmod +x ~/bin/connect-provider
```

### Step 4 — Add ~/bin to your PATH

Add to your `~/.zshrc` (or `~/.bashrc`):

```bash
export PATH="$HOME/bin:$PATH"
```

Then reload:

```bash
source ~/.zshrc   # or source ~/.bashrc
```

### Step 5 — Create the proxy config directory

```bash
mkdir -p ~/.claude-proxy
```

Copy the sample config:

```bash
cp opencode-proxy-config.json ~/.claude-proxy/settings.json
```

### Step 6 — Copy Claude Code slash commands

```bash
mkdir -p ~/.claude/commands
cp .claude/commands/switch-model.md     ~/.claude/commands/
cp .claude/commands/connect-provider.md ~/.claude/commands/
```

### Step 7 — Verify the setup

```bash
# Check Claude Code is installed
claude --version

# Check fzf is installed
fzf --version

# Check Node.js is installed
node --version

# Check ~/bin is in PATH
which run-claude-opencode
```

---

## Configuration

The proxy reads its configuration from:

```
~/.claude-proxy/settings.json
```

### Configuration File Structure

```json
{
  "apiKeyGo": "sk-...",              // OpenCode paid-tier key
  "apiKeyFree": "sk-...",            // OpenCode free-tier key

  "goModels": ["minimax-m2.7", ...], // OpenCode paid models
  "freeModels": ["minimax-m2.5-free", "ring-2.6-1t-free", ...],

  "githubOAuthClientId": "...",      // GitHub OAuth app ID (pre-configured)
  "githubOAuthClientSecret": "...",  // GitHub OAuth app secret (pre-configured)
  "githubOAuthToken": "",            // Set after running /connect-provider copilot
  "githubOAuthUsername": "",         // Set automatically after OAuth

  "groqApiKey": "",                  // https://console.groq.com/keys
  "nvidiaApiKey": "",                // https://build.nvidia.com/
  "openrouterApiKey": "",            // https://openrouter.ai/keys
  "geminiApiKey": "",                // https://aistudio.google.com/apikey
  "openaiApiKey": "",                // https://platform.openai.com/api-keys

  "ollamaModels": ["qwen3:8b", ...], // Ollama local models (must be pulled first)
  "groqModels": [...],
  "geminiModels": [...],
  "openaiModels": [...],

  "defaultModel": "opencode/minimax-m2.5-free"
}
```

### Active Model File

The proxy reads which model to use from:

```
~/.claude/active-model
```

This file contains a single model ID like `opencode/minimax-m2.5-free` or `copilot/gpt-5-mini`.

**Set it manually:**
```bash
echo "opencode/minimax-m2.5-free" > ~/.claude/active-model
```

**Or use the switch script (recommended):**
```bash
!~/bin/switch-model-visual
```

---

## Daily Usage

### Launch Claude Code with the proxy

```bash
run-claude-opencode
```

This will:
1. ✅ Start the proxy on port 4001 (if not already running)
2. 🎯 Show an interactive fzf model picker (arrow keys + Enter to select)
3. 🚀 Launch Claude Code pointed at the proxy
4. 📋 Inject all proxy models into Claude Code's native model picker

### Launch with a specific model (skip picker)

```bash
run-claude-opencode copilot/gpt-5-mini
run-claude-opencode opencode/minimax-m2.5-free
run-claude-opencode -m copilot/gpt-4o
```

### Start proxy only (without Claude Code)

```bash
cd ~/Claude-Opencode-Ollama
nohup node opencode-proxy-server.js > /tmp/opencode-proxy.log 2>&1 &
```

Check proxy is running:

```bash
curl http://127.0.0.1:4001/api/providers
```

---

## Switching Models

### ⚡ Instant switch inside Claude Code (recommended)

Use the `!` prefix in Claude Code chat to run shell commands directly — **zero tokens, zero AI, instant**:

```
!~/bin/switch-model-visual
```

This shows a numbered list with the current model marked `➤`:

```
┌────────────────────────────────────────────────────────────────────┐
│                    SELECT YOUR AI MODEL                            │
└────────────────────────────────────────────────────────────────────┘

   1. opencode/minimax-m2.5-free               [FREE]
➤  2. copilot/gpt-5-mini                       [FREE]
   3. copilot/gpt-4o                            [1x]
   4. opencode/kimi-k2.5-free                  [FREE]
   ...
```

**Switch by number:**
```
!~/bin/switch-model-visual 5
```

**Switch by model name:**
```
!~/bin/switch-model-visual copilot/gpt-4o
```

The switch takes effect on your **next message** — no restart needed.

### Using the /switch-model slash command

> ⚠️ Note: Slash commands always go through the AI (they're processed as prompts). This takes ~15-30 seconds. Use `!` prefix above for instant switching.

```
/switch-model          # show model list
/switch-model 5        # switch to model #5
```

### Check current model

```bash
cat ~/.claude/active-model
```

Or inside Claude Code:
```
!cat ~/.claude/active-model
```

### Model ID format

| Provider | Model ID format | Example |
|----------|----------------|---------|
| OpenCode (paid) | `opencode/<model>` | `opencode/minimax-m2.7` |
| OpenCode (free) | `opencode/<model>-free` | `opencode/minimax-m2.5-free` |
| GitHub Copilot | `copilot/<model>` | `copilot/gpt-5-mini` |
| Gemini | `gemini/<model>` | `gemini/gemini-2.5-pro` |
| Groq | `groq/<model>` | `groq/llama-3.3-70b-versatile` |
| Nvidia NIM | `nvidia/<model>` | `nvidia/meta/llama-3.3-70b-instruct` |
| OpenRouter | `openrouter/<model>` | `openrouter/deepseek/deepseek-r1:free` |
| Ollama (local) | `ollama/<model>` | `ollama/qwen3:8b` |
| OpenAI | `openai/<model>` | `openai/gpt-4o` |

---

## Connecting Providers

The `connect-provider` script lets you connect, disconnect, and check provider status — all as instant shell commands (zero tokens, no AI involved).

### Check all provider status

```bash
# Inside Claude Code (instant)
!~/bin/connect-provider

# Or from terminal
~/bin/connect-provider
```

Output example:
```
╔══════════════════════════════════════════════════════════╗
║              PROVIDER CONNECTION STATUS                  ║
╚══════════════════════════════════════════════════════════╝

  1. ✅ GitHub Copilot         9 models
  2. ❌ Google Gemini          —  get key → https://aistudio.google.com/apikey
  3. ❌ OpenAI / Codex         —  get key → https://platform.openai.com/api-keys
  4. ❌ Groq                   —  get key → https://console.groq.com/keys
  5. ❌ NVIDIA NIM             —  get key → https://build.nvidia.com
  6. ❌ OpenRouter             —  get key → https://openrouter.ai/keys
  7. ✅ Ollama                 [Running on :11434]
```

### Connect a provider with an API key

```bash
!~/bin/connect-provider groq      YOUR_GROQ_KEY
!~/bin/connect-provider gemini    YOUR_GEMINI_KEY
!~/bin/connect-provider openai    YOUR_OPENAI_KEY
!~/bin/connect-provider nvidia    YOUR_NVIDIA_KEY
!~/bin/connect-provider openrouter YOUR_OPENROUTER_KEY
```

### Connect GitHub Copilot (OAuth)

```bash
!~/bin/connect-provider copilot
# Opens browser for GitHub OAuth — token saved automatically
```

Or use the slash command:
```
/connect-provider copilot
```

### Disconnect a provider

```bash
!~/bin/connect-provider disconnect groq
!~/bin/connect-provider disconnect gemini
```

### Slash commands (inside Claude Code)

> ⚠️ Note: `/connect-provider` and `/switch-model` slash commands go through the AI (~15–30s).  
> Use `!` prefix above for **instant zero-token** execution.

```
/connect-provider                    # show status table
/connect-provider groq YOUR_KEY      # connect with key
/connect-provider copilot            # OAuth flow
/connect-provider disconnect groq    # disconnect
```

### Web portal

Visit `http://127.0.0.1:4001` in your browser while the proxy is running to see:
- 📊 **Dashboard** — live stats (active model, total requests, uptime)
- 🔌 **Providers** — visual connect/disconnect UI for all providers
- ⚙️ **Settings** — configure API keys via web form

---

## Provider Setup

### OpenCode (Pre-configured — works out of the box)

OpenCode API keys are already included in the config. Free models work immediately.

**Free models available:**
- `opencode/minimax-m2.5-free` — MiniMax M2.5 (recommended default)
- `opencode/ring-2.6-1t-free` — Ring 2.6
- `opencode/nemotron-3-super-free` — Nvidia Nemotron
- `opencode/minimax-m2.1-free` — MiniMax M2.1
- And more (see `freeModels` in config)

### GitHub Copilot (OAuth — free if you have Copilot subscription)

Connect via OAuth inside Claude Code:

```bash
!~/bin/connect-provider copilot
```

Or using the slash command:
```
/connect-provider copilot
```

Or manually:
```bash
curl http://127.0.0.1:4001/api/auth/copilot/start
```

This opens a browser for GitHub OAuth. After authenticating, your token is saved automatically.

**Get API key:** https://github.com/settings/tokens
**Copilot subscription:** https://github.com/features/copilot

**Models available:**
- `copilot/gpt-5-mini` — GPT-5 Mini (free with Copilot)
- `copilot/gpt-4o` — GPT-4o
- `copilot/claude-3.5-sonnet` — Claude 3.5 Sonnet
- `copilot/o3` — OpenAI o3
- And more

### Gemini (Google AI Studio)

1. Get API key: https://aistudio.google.com/apikey
2. Connect instantly:
   ```bash
   !~/bin/connect-provider gemini YOUR_API_KEY
   ```
3. Or add to config manually:
   ```json
   "geminiApiKey": "AIza..."
   ```
4. Switch to a Gemini model:
   ```bash
   !~/bin/switch-model-visual gemini/gemini-2.5-pro
   ```

### Groq (Ultra-fast inference — free tier available)

1. Get API key: https://console.groq.com/keys
2. Connect instantly:
   ```bash
   !~/bin/connect-provider groq YOUR_API_KEY
   ```
3. Or add to config manually:
   ```json
   "groqApiKey": "gsk_..."
   ```
4. Models in config by default:
   - `groq/llama-3.3-70b-versatile`
   - `groq/llama-3.1-8b-instant`
   - `groq/deepseek-r1-distill-llama-70b-32768`

### Nvidia NIM (Free API with NVIDIA account)

1. Get API key: https://build.nvidia.com/
2. Connect instantly:
   ```bash
   !~/bin/connect-provider nvidia YOUR_API_KEY
   ```
3. Or add to config manually:
   ```json
   "nvidiaApiKey": "nvapi-..."
   ```

### OpenRouter (Access 200+ models)

1. Get API key: https://openrouter.ai/keys
2. Connect instantly:
   ```bash
   !~/bin/connect-provider openrouter YOUR_API_KEY
   ```
3. Or add to config manually:
   ```json
   "openrouterApiKey": "sk-or-v1-..."
   ```
4. Free models available (`:free` suffix):
   - `openrouter/google/gemma-3-27b-it:free`
   - `openrouter/meta-llama/llama-3.3-70b-instruct:free`
   - `openrouter/deepseek/deepseek-r1:free`

### OpenAI

1. Get API key: https://platform.openai.com/api-keys
2. Connect instantly:
   ```bash
   !~/bin/connect-provider openai YOUR_API_KEY
   ```
3. Or add to config manually:
   ```json
   "openaiApiKey": "sk-..."
   ```

### Ollama (Local models — runs on your machine)

1. Install Ollama: https://ollama.com/download
2. Pull models:
   ```bash
   ollama pull qwen3:8b
   ollama pull llama3.3:70b
   ```
3. Models in config are used automatically when Ollama is running.
4. Browse models: https://ollama.com/library

---

## Troubleshooting

### Proxy not starting

```bash
# Check if something is using port 4001
lsof -i :4001

# Check proxy log
cat /tmp/opencode-proxy.log

# Start manually
cd ~/Claude-Opencode-Ollama
node opencode-proxy-server.js
```

### Model not switching / wrong model being used

```bash
# Check what model is set
cat ~/.claude/active-model

# Fix it manually
echo "opencode/minimax-m2.5-free" > ~/.claude/active-model

# Verify proxy reads it
curl http://127.0.0.1:4001/v1/models | python3 -m json.tool | head -30
```

### "401 Unauthorized" errors

The active model file has a corrupt value. Reset it:

```bash
echo "opencode/minimax-m2.5-free" > ~/.claude/active-model
```

### Models not showing in Claude Code's native picker

The gateway cache needs refreshing. Restart via `run-claude-opencode` — it automatically injects all proxy models into the native picker on every launch.

### fzf picker hangs / takes too long

Inside Claude Code, **never use** `/switch-model` (slash command) for instant switching.  
**Always use** the `!` prefix:

```
!~/bin/switch-model-visual
```

### Proxy keeps stopping

The proxy should run with `nohup` (detached). Check `run-claude-opencode`:

```bash
grep "nohup" ~/bin/run-claude-opencode
```

Should show: `nohup node opencode-proxy-server.js > /tmp/opencode-proxy.log 2>&1 &`

If not, edit the file to use `nohup`.

### Check all providers status

```bash
# Quick visual status (recommended)
!~/bin/connect-provider

# JSON API
curl http://127.0.0.1:4001/api/providers | python3 -m json.tool
```

---

## File Reference

### Scripts (install to ~/bin/)

| File | Purpose |
|------|---------|
| `bin/run-claude-opencode` | Main launcher — starts proxy, shows model picker, launches Claude Code |
| `bin/switch-model-visual` | Visual model list with `➤` marker — use with `!` prefix in Claude Code |
| `bin/switch-model` | Full-featured switcher with fzf, list, and direct-name modes |
| `bin/switch-model-chat` | Minimal switcher, safe for Claude Code bash tool use |
| `bin/connect-provider` | Connect/disconnect providers by API key or OAuth |

### Proxy

| File | Purpose |
|------|---------|
| `opencode-proxy-server.js` | Main proxy server (~2400 lines) — routes requests to providers + web portal |
| `opencode-proxy-config.json` | Proxy configuration — API keys, models, OAuth credentials |

### Claude Code integration

| File | Purpose |
|------|---------|
| `.claude/commands/switch-model.md` | `/switch-model` slash command definition |
| `.claude/commands/connect-provider.md` | `/connect-provider` slash command definition |

### Key system files (not in repo)

| File | Purpose |
|------|---------|
| `~/.claude/active-model` | Current active model ID — proxy reads this on every request |
| `~/.claude-proxy/settings.json` | Proxy config (copy of `opencode-proxy-config.json`) |
| `/tmp/opencode-proxy.log` | Proxy server log output |
| `~/.claude/cache/gateway-models.json` | Claude Code's native model list (injected by `run-claude-opencode`) |

---

## Quick Reference Card

```bash
# ── Launch ────────────────────────────────────────────────────────────────
run-claude-opencode                          # pick model at startup
run-claude-opencode copilot/gpt-5-mini       # use specific model

# ── Switch model (inside Claude Code — instant, zero tokens) ─────────────
!~/bin/switch-model-visual                   # show numbered model list (➤ = current)
!~/bin/switch-model-visual 5                 # switch to model #5
!~/bin/switch-model-visual copilot/gpt-4o    # switch by name
!cat ~/.claude/active-model                  # check current model

# ── Switch model (from terminal) ──────────────────────────────────────────
switch-model list                            # numbered list
switch-model 5                               # switch by number
switch-model fzf                             # fzf picker (terminal only)
switch-model status                          # show current model

# ── Providers (inside Claude Code — instant, zero tokens) ────────────────
!~/bin/connect-provider                      # show all provider status
!~/bin/connect-provider copilot              # OAuth → GitHub Copilot
!~/bin/connect-provider groq      YOUR_KEY   # connect Groq
!~/bin/connect-provider gemini    YOUR_KEY   # connect Gemini
!~/bin/connect-provider openai    YOUR_KEY   # connect OpenAI
!~/bin/connect-provider nvidia    YOUR_KEY   # connect Nvidia NIM
!~/bin/connect-provider openrouter YOUR_KEY  # connect OpenRouter
!~/bin/connect-provider disconnect groq      # disconnect a provider

# ── Slash commands (go through AI — slower) ───────────────────────────────
/switch-model                                # show model list
/switch-model 5                              # switch to model #5
/connect-provider                            # show provider status
/connect-provider groq YOUR_KEY              # connect provider
/connect-provider disconnect groq            # disconnect provider

# ── Proxy & diagnostics ───────────────────────────────────────────────────
curl http://127.0.0.1:4001/api/providers     # check provider status (JSON)
curl http://127.0.0.1:4001/api/stats         # live stats (model, requests, uptime)
curl http://127.0.0.1:4001/v1/models         # list all available models
cat /tmp/opencode-proxy.log                  # proxy server logs

# ── Web portal ────────────────────────────────────────────────────────────
# Open http://127.0.0.1:4001 in browser — Dashboard, Providers, Settings
```

---

## License

MIT

---

## Links Summary

| Tool | Link |
|------|------|
| Claude Code | https://claude.ai/code |
| Node.js | https://nodejs.org/en/download |
| fzf | https://github.com/junegunn/fzf#installation |
| Python | https://www.python.org/downloads/ |
| Git | https://git-scm.com/downloads |
| Ollama | https://ollama.com/download |
| Ollama model library | https://ollama.com/library |
| GitHub Copilot | https://github.com/features/copilot |
| GitHub tokens | https://github.com/settings/tokens |
| Google AI Studio (Gemini) | https://aistudio.google.com/apikey |
| Groq console | https://console.groq.com/keys |
| Nvidia NIM | https://build.nvidia.com/ |
| OpenRouter | https://openrouter.ai/keys |
| OpenAI platform | https://platform.openai.com/api-keys |
