# Design: Model Picker UX Fix
**Date:** 2026-05-15  
**Status:** Approved (autonomous mode — user pre-authorized)

## Problem Statement
Three distinct UX bugs identified from screenshots:

1. **Separate Terminal opens** — `/model` (no args) invokes `osascript` to open a new Terminal.app window with fzf. User wants model list inline inside Claude Code.
2. **Status bar shows wrong model** — `statusline-command.sh` reads `model.display_name` from Claude Code's JSON (always the base configured model, e.g. "claude-opus-4-7"). Never reflects the active override in `~/.claude/active-model`.
3. **403 errors show cryptic GitHub ToS message** — Proxy forwards raw GitHub 403 (`x-endpoint-client-forbidden: tpm:...`) as-is. Users see "Access to this endpoint is forbidden. Please review our Terms of Service." with no guidance.

## Architecture

### Fix 1 — `~/bin/model-open` (the `/model` slash command handler)
**Current:** Empty/status case uses `osascript` to open a new Terminal.app window running `~/bin/model` (fzf TUI).  
**Fix:** Remove `osascript` entirely. Always call `show_model_list()` inline. This renders the full grouped model list directly in Claude Code's output pane. User selects by typing `/model <model-id>`.  
**Rationale:** Claude Code bash tools have no TTY. A new Terminal.app window is confusing UX. Inline text output is the correct pattern for Claude Code slash commands.

### Fix 2 — `~/.claude/statusline-command.sh` (bottom status bar)
**Current:** `model=$(echo "$input" | jq -r '.model.display_name // empty')` — reads Claude Code's internal model field (always the base model, never the proxy override).  
**Fix:** Read `~/.claude/active-model` file first. Fall back to `model.display_name` only if the file is empty.  
```sh
override=$(cat ~/.claude/active-model 2>/dev/null | tr -d '\n' | tr -d ' ')
if [ -n "$override" ]; then
  model="$override"
else
  model=$(echo "$input" | jq -r '.model.display_name // empty')
fi
```

### Fix 3 — `~/opencode-proxy-server.js` (proxy 403 handler)
**Current:** When GitHub returns 403 with `x-endpoint-client-forbidden` header, proxy pipes the raw response directly to Claude Code. Claude Code shows a cryptic "Terms of Service" error.  
**Fix:** In the upstream response handler (`forwardPromise.then()`), detect HTTP 403 from GitHub Copilot provider. Check for `x-endpoint-client-forbidden` header. Return a structured Anthropic-format error with a human-readable message explaining the rate limit and advising the user to wait ~60 seconds.

## Data Flow (after fixes)
```
User types /model in Claude Code
  → Claude Code runs ~/bin/model-open
  → show_model_list() outputs grouped model list inline
  → User sees list in Claude Code output pane ✅

User types /model copilot/claude-sonnet-4.6
  → model-open writes to ~/.claude/active-model
  → Status bar immediately shows "copilot/claude-sonnet-4.6" ✅

Next message hits proxy
  → proxy reads ~/.claude/active-model → "copilot/claude-sonnet-4.6"
  → forwards to GitHub Copilot
  → If rate limited (403 + x-endpoint-client-forbidden):
      → proxy returns: {"type":"error","error":{"type":"rate_limit_error","message":"⚠️ GitHub Copilot rate limit — wait ~60s and retry"}} ✅
```

## Files Changed
- `~/bin/model-open` — Remove osascript block, call show_model_list() instead
- `~/.claude/statusline-command.sh` — Read active-model file for display
- `~/opencode-proxy-server.js` — Add 403/rate-limit friendly error handler

## Success Criteria
- `/model` shows grouped model list inline in Claude Code (no new window)
- Status bar shows current active model from `~/.claude/active-model`
- 403 from GitHub Copilot shows "rate limit — wait 60s" message instead of ToS link
