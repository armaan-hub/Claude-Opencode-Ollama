---
allowed-tools: Bash(echo *), Bash(mkdir *), Bash(cat *), Bash(rm *), Bash(curl *), Bash(python3 *)
description: Hot-swap LLM model without restarting. Usage: /model [name|list|clear|status]
---

## Current Active Model
!`cat ~/.claude/active-model 2>/dev/null || echo "none (using session default)"`

## Available Models
!`curl -s http://localhost:4001/v1/models 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    models = data.get('data', [])
    by_provider = {}
    for m in models:
        owner = m.get('owned_by', 'opencode')
        by_provider.setdefault(owner, []).append(m['id'])
    for provider, ids in by_provider.items():
        print(f'  [{provider.upper()}]')
        for mid in ids:
            print(f'    {mid}')
except Exception as e:
    print(f'  Could not fetch models: {e}')
    print('  Make sure proxy is running: node ~/opencode-proxy-server.js')
" 2>/dev/null`

## Your Task

The user typed: **$ARGUMENTS**

Handle exactly one case:

**CASE A — $ARGUMENTS is empty:**
Show the current model and list above. Ask: "Which model would you like? Type the name exactly as shown, or type 'clear' to remove the override."
When they reply with a name, handle it as CASE B.

**CASE B — $ARGUMENTS is a model name (not list/clear/status):**
Run these bash commands in sequence:
1. `mkdir -p ~/.claude`
2. `echo "MODELNAME" > ~/.claude/active-model`  ← replace MODELNAME with the exact model from $ARGUMENTS
Then reply: "✅ Switched to **MODELNAME**. Your next message will use this model. To undo: `/model clear`"

**CASE C — $ARGUMENTS is "clear":**
Run: `rm -f ~/.claude/active-model`
Reply: "✅ Model override cleared. Using your session's default model."

**CASE D — $ARGUMENTS is "list":**
Show only the available models list (already shown above). No action needed.

**CASE E — $ARGUMENTS is "status":**
Run: `cat ~/.claude/active-model 2>/dev/null || echo "none (using session default)"`
Reply with: "Active model: [result]"

Keep responses to 1-2 lines. Do not start a new session or suggest restarting.
