---
allowed-tools: Bash(curl *), Bash(python3 *)
description: Show all provider connection statuses. Usage: /providers
---

## Your Task

Run this script and show the output verbatim:

```bash
python3 - <<'PYEOF'
import json, sys, urllib.request

PROXY = "http://127.0.0.1:4001"

try:
    with urllib.request.urlopen(f"{PROXY}/api/providers", timeout=5) as r:
        data = json.loads(r.read())
except Exception as e:
    print(f"⚠️  Proxy not running at {PROXY}")
    print(f"   Start: cd ~/Claude-Opencode-Ollama && node opencode-proxy-server.js &")
    sys.exit(1)

providers = data.get("providers", [])
connected = [p for p in providers if p.get("connected")]
disconnected = [p for p in providers if not p.get("connected")]

print("━" * 55)
print("  🔐 Provider Status")
print("━" * 55)

if connected:
    print("\n  Connected:")
    for p in connected:
        note = p.get("username") or p.get("note") or "connected"
        count = p.get("modelCount", 0)
        models = f"  ({count} models)" if count else ""
        print(f"    ✅ {p['name']:<25} {note}{models}")

if disconnected:
    print("\n  Not connected:")
    for p in disconnected:
        pid = p["id"]
        if p.get("authType") == "api-key":
            hint = f"→ /connect-provider {pid} <api-key>"
        elif pid == "github-copilot":
            hint = "→ /connect-provider github"
        else:
            hint = "(always available)"
        print(f"    ❌ {p['name']:<25} {hint}")

total = len(providers)
ok = len(connected)
print(f"\n  {ok}/{total} providers connected")
print("━" * 55)
print("\nTo connect: /connect-provider <name> <api-key>")
print("Names: gemini, openai, groq, nvidia, openrouter, github")
PYEOF
```
