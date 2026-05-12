---
allowed-tools: Bash(cat *), Bash(curl *), Bash(echo *), Bash(gh *)
description: Manage LLM providers — connect, disconnect, status. Usage: /provider [status]
---

## Your Task

The user typed: **$ARGUMENTS**

**STEP 1 — Run this Bash command NOW:**

`curl -s --max-time 4 http://localhost:4001/api/providers 2>/dev/null || echo '{"error":"proxy unreachable on port 4001 — run: launchctl start com.opencode.proxy"}'`

**STEP 2 — Display provider status** (parse the JSON from step 1):

For each provider in the `providers` array, show one line:
- Connected: `✅ [name] — [username OR "API key"] — [modelCount] models — [requestCount] requests this session`
- Not connected: `❌ [name] — not connected`
- Auth type none: `🟢 [name] — [note]`

Group them:
```
🔐 Provider Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ GitHub Copilot — armaan-hub — 11 models — 5 requests
❌ Google Gemini  — not connected
...

💡 To connect providers: open http://localhost:4001/providers
```

**STEP 3 — Handle $ARGUMENTS:**

- **Empty or "status"** → Show step 2 output. Done.
- **"open"** → Show: "Open http://localhost:4001/providers in your browser to manage providers."
- **Anything else** → Show step 2 output and explain available sub-commands.

Keep response under 20 lines.
