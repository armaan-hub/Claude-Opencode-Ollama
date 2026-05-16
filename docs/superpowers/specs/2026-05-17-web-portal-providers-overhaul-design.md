# Web Portal & Provider Connection Overhaul

**Date:** 2026-05-17  
**Status:** Approved  
**Scope:** Fix web portal loading bugs, add Live Stats panel, fix Providers page, create connect-provider CLI script

---

## Problem

1. **Dashboard stuck at "Loading..."** — `loadConfig()` in the dashboard JS has no error handling. If the fetch to `/api/config` fails for any reason, the panels show "Loading..." forever with no error message, no retry option.

2. **Go/Free model counts show "—"** — Same root cause: `loadConfig()` fails silently before updating `d-go` / `d-free` DOM elements.

3. **No live stats** — No way to see the active model, request counts per provider, or errors from the dashboard.

4. **Providers page** — The connect/disconnect flow lacks loading spinners and error feedback, making it appear frozen during operations.

5. **No CLI provider connection** — To connect a provider inside Claude Code, users need to write raw `curl` commands. There's no ergonomic `!connect-provider` command.

---

## Architecture

### Files Changed

| File | Change |
|------|--------|
| `opencode-proxy-server.js` | Fix dashboard JS; add `/api/stats` endpoint; fix Providers page JS |
| `bin/connect-provider` | New script (also copies to `~/bin/`) |
| `.claude/commands/connect-provider.md` | New slash command definition |

### Files NOT Changed

- Proxy routing logic
- Config file format (`opencode-proxy-config.json`, `~/.claude-proxy/settings.json`)
- All existing API endpoints (`/api/config`, `/api/providers`, `/api/active-model`, etc.)
- Model switching scripts (`switch-model-visual`, `switch-model`, `run-claude-opencode`)

---

## Feature 1: Dashboard Fix

### Root Cause
`loadConfig()` is declared as `async function` and called bare at page load with no try-catch and no `.catch()`. Any error in the fetch chain silently rejects the promise.

### Fix
Wrap the body of `loadConfig()` in a try-catch. On error, replace "Loading…" text with an error state that includes a retry button:

```
❌ Failed to load config — [Retry]
```

Auto-retry logic: call `loadConfig()` once automatically after a 1-second delay if the first call fails (handles proxy startup race conditions).

### Go/Free counts
Same try-catch fixes the "—" issue — if fetch succeeds, `d-go` and `d-free` are updated correctly.

---

## Feature 2: Live Stats Panel

### New `/api/stats` Endpoint

Returns:
```json
{
  "activeModel": "copilot/gpt-5-mini",
  "totalRequests": 42,
  "providers": [
    { "id": "opencode", "name": "OpenCode (free)", "requests": 31 },
    { "id": "github-copilot", "name": "GitHub Copilot", "requests": 11 }
  ],
  "uptime": 3600
}
```

Implementation: reads `~/.claude/active-model` + returns `REQUEST_COUNTS` from memory (already tracked in the proxy). No new state.

### Dashboard Panel

New "Live Stats" panel on the Dashboard page, below the existing panels:

```
╔────────────────────────────────────────╗
║ ⚡ Live Stats                  [Refresh]║
╠────────────────────────────────────────╣
║ Active Model:  copilot/gpt-5-mini      ║
║ Requests:      42 total                ║
║   OpenCode:    31                      ║
║   Copilot:     11                      ║
╚────────────────────────────────────────╝
```

Auto-refreshes every 10 seconds. Manual "Refresh" button in the panel header.

---

## Feature 3: Providers Page Fix

### Issues Fixed

1. **No loading state** — Grid shows blank white area while fetching. Fix: show "Loading providers..." spinner until data arrives.

2. **Connect modal appears frozen** — No visual feedback while the API call is in flight. Fix: disable the Save button and show "Saving..." while the POST request runs.

3. **Missing feedback on success/error** — After connecting, the toast fires but the card doesn't update visually. Fix: call `load()` after successful connect to refresh all cards.

4. **Request counts added** — Each provider card shows request count from the session (already available in `/api/providers` response).

### Provider Card Layout

```
┌─────────────────────────────────┐
│ ✅ GitHub Copilot               │
│ 9 models · 11 requests          │
│                    [Disconnect] │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ ❌ Gemini                       │
│ No key set                      │
│ → Get key: aistudio.google.com  │
│                    [Connect]    │
└─────────────────────────────────┘
```

---

## Feature 4: `connect-provider` CLI Script

### File Location
- `bin/connect-provider` in repo
- Installed to `~/bin/connect-provider`

### Usage

```bash
# Inside Claude Code (instant, zero tokens, zero AI)
!~/bin/connect-provider               # Show status table + prompt
!~/bin/connect-provider status        # Status table only
!~/bin/connect-provider gemini AIzaXXX    # Connect Gemini directly
!~/bin/connect-provider groq gsk_XXX      # Connect Groq directly
!~/bin/connect-provider openai sk-XXX     # Connect OpenAI directly
!~/bin/connect-provider nvidia nvapi-XXX  # Connect Nvidia directly
!~/bin/connect-provider openrouter sk-or-v1-XXX  # Connect OpenRouter directly
!~/bin/connect-provider copilot           # Connect Copilot via gh CLI OAuth
!~/bin/connect-provider disconnect groq   # Disconnect a provider
```

### Output (no args)

```
╔══════════════════════════════════════════════════════╗
║           PROVIDER CONNECTION STATUS                 ║
╚══════════════════════════════════════════════════════╝

  1. ✅ OpenCode (free)     14 models   31 reqs   [always on]
  2. ✅ GitHub Copilot       9 models    0 reqs
  3. ❌ Gemini               —           get key → aistudio.google.com/apikey
  4. ❌ Groq                 —           get key → console.groq.com/keys
  5. ❌ OpenAI               —           get key → platform.openai.com/api-keys
  6. ❌ Nvidia NIM            —           get key → build.nvidia.com
  7. ❌ OpenRouter            —           get key → openrouter.ai/keys
  8. ✅ Ollama (local)        0 models   [no key needed]

╔══════════════════════════════════════════════════════╗
║  To connect:  !~/bin/connect-provider groq YOUR_KEY  ║
╚══════════════════════════════════════════════════════╝
```

### Direct Connect Output

```
!~/bin/connect-provider groq gsk_xxxxx

  Connecting Groq...
  ✅ Connected! Groq · 5 models available
  → Switch to Groq: !~/bin/switch-model-visual groq/llama-3.3-70b-versatile
```

### Implementation Details

- Calls `POST http://127.0.0.1:4001/api/providers/{id}/connect` with `{"apiKey":"..."}` for API-key providers
- For `copilot`: runs `gh auth login` 
- For `ollama`: no-op (already always connected if Ollama is running)
- For `status`: calls `GET http://127.0.0.1:4001/api/providers` and formats the response
- Validates proxy is running before all operations; starts proxy if needed

### Slash Command

`.claude/commands/connect-provider.md`:
```markdown
Run: !~/bin/connect-provider $ARGUMENTS
```

Enables `/connect-provider` and `/connect-provider groq YOUR_KEY` inside Claude Code (though the `!` prefix is faster).

---

## Error Handling

| Scenario | Behavior |
|----------|---------|
| Proxy not running | Script auto-starts proxy, retries |
| Invalid API key | Proxy returns 400, script shows "❌ Key rejected by provider" |
| Unknown provider name | Script shows list of valid provider names |
| `copilot` without gh CLI | Shows install instructions for `gh` |
| Network timeout | Shows "⚠️ Timeout — is proxy running?" |

---

## Testing

Manual verification steps:
1. Open dashboard at `http://127.0.0.1:4001/` → API Keys and Model Summary panels load (not stuck at "Loading...")
2. Open Providers page → all 8 providers show with correct status
3. Click Connect on a provider → modal shows spinner, success toast, card updates
4. Run `!~/bin/connect-provider` → status table shows
5. Run `!~/bin/connect-provider groq FAKE_KEY` → shows ❌ error
6. Run `!~/bin/connect-provider status` → table shows without prompting
