---
allowed-tools: Bash(cat *), Bash(printf *), Bash(mkdir *), Bash(rm *), Bash(curl *), Bash(gh *), Bash(echo *)
description: Switch LLM model/provider with auth status. Usage: /model [name|clear|status]
---

## Your Task

The user typed: **$ARGUMENTS**

**STEP 1 — Run these three Bash tool calls RIGHT NOW before doing anything else:**

1. `cat ~/.claude/active-model 2>/dev/null || echo "none"`
2. `curl -s --max-time 4 http://localhost:4001/v1/models 2>/dev/null || echo '{"error":"proxy unreachable on port 4001"}'`
3. `gh auth whoami 2>/dev/null || echo "not-authenticated"`

**STEP 2 — Always display this status block first (using results from Step 1):**

```
🔐 Provider Authentication Status
  GitHub Copilot : [if gh auth whoami returned a username → "✅ logged in as USERNAME"
                    else → "❌ not logged in — run: gh auth login"]
  Groq / NVIDIA / OpenRouter : API key (configured in proxy — no login needed)
  Ollama         : local service — no auth needed
  OpenCode       : free tier — no auth needed

📍 Active model: [value from command 1, or "none — using session default"]
```

**STEP 3 — Display the model list** (parse the JSON from command 2):

Group models by their `owned_by` field, shown in this order:
`github-copilot` → `groq` → `nvidia` → `openrouter` → `ollama` → everything else

Format each group:
```
[GITHUB-COPILOT]  (requires: gh auth login)
  copilot/claude-opus-4.7
  copilot/gpt-5.4  ...

[GROQ]  (requires: Groq API key — already configured)
  groq/llama-4-scout  ...
```

If proxy returned `{"error":"..."}` → show:
```
⚠️  Proxy is not running. Start it:
    launchctl start com.opencode.proxy
    — or — node ~/opencode-proxy-server.js
```

**STEP 4 — Handle $ARGUMENTS:**

- **Empty** → After showing steps 2+3, ask: "Which model? Type the exact ID (e.g. `copilot/gpt-5.4`) or `clear` to remove override."
  When they reply with a model name → treat as a model name below.

- **"status"** → Show steps 2+3 only. Done.

- **"clear"** → Run: `rm -f ~/.claude/active-model` → Reply: "✅ Override cleared."

- **A model name** (anything else):
  1. Check the name appears in the curl JSON. If not found → "❌ Unknown model. Check the list with `/model`."
  2. **Auth check**: If the name starts with `copilot/` AND gh auth returned "not-authenticated":
     → Reply: "❌ GitHub Copilot requires login. Run `gh auth login` in your terminal, then try again." STOP — do NOT write the file.
  3. If valid and auth OK:
     - Run: `mkdir -p ~/.claude`
     - Run: `printf '%s\n' 'MODELNAME' > ~/.claude/active-model`  (replace MODELNAME with the exact model ID)
     - Reply: "✅ Switched to **MODELNAME**. Next message will use this model. (`/model clear` to undo)"

Keep all replies concise. Do not suggest restarting the session.
