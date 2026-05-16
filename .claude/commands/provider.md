---
allowed-tools: Bash(curl *), Bash(python3 *), Bash(open *)
description: Manage providers — status, connect, disconnect. Usage: /provider [status|connect <name> <key>|disconnect <name>]
---

## Your Task

The user typed: **$ARGUMENTS**

Run this Python script and show output verbatim:

```bash
python3 - "$ARGUMENTS" <<'PYEOF'
import sys, json, urllib.request, urllib.error, subprocess

PROXY = "http://127.0.0.1:4001"
args = (sys.argv[1].strip() if len(sys.argv) > 1 else "").split()
cmd = args[0].lower() if args else "status"

# User-friendly name → proxy provider ID
NAME_MAP = {
    "github": "github-copilot", "copilot": "github-copilot",
    "github-copilot": "github-copilot",
    "gemini": "gemini", "google": "gemini",
    "openai": "openai",
    "groq": "groq",
    "nvidia": "nvidia",
    "openrouter": "openrouter",
    "ollama": "ollama",
    "opencode": "opencode",
}
# Only these accept POST /api/providers/<id>/connect with an API key
API_KEY_PROVIDERS = {"gemini", "openai", "groq", "nvidia", "openrouter"}

def fetch(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{PROXY}{path}", data=data,
        headers={"Content-Type": "application/json"} if data else {},
        method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read()), None
    except urllib.error.HTTPError as e:
        try:
            return None, json.loads(e.read().decode())
        except Exception:
            return None, {"message": str(e)}
    except Exception as ex:
        return None, {"message": str(ex)}

def show_status():
    result, err = fetch("/api/providers")
    if err:
        print(f"⚠️  Proxy not running at {PROXY}")
        print(f"   Start: cd ~/Claude-Opencode-Ollama && node opencode-proxy-server.js &")
        return
    providers = result.get("providers", [])
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
    print(f"\n  {len(connected)}/{len(providers)} providers connected")
    print("━" * 55)

if cmd in ("", "status"):
    show_status()

elif cmd == "connect":
    if len(args) < 2:
        print("Usage: /provider connect <name> [api-key]")
        print("Names: gemini, openai, groq, nvidia, openrouter, github")
        sys.exit(1)
    pid = NAME_MAP.get(args[1].lower())
    if not pid:
        print(f"❌ Unknown provider: {args[1]}")
        print(f"   Valid names: {', '.join(NAME_MAP)}")
        sys.exit(1)
    if pid == "github-copilot":
        print("🔗 Opening browser for GitHub Copilot authentication...")
        result, err = fetch("/api/copilot/login", method="POST", body={})
        if err:
            print(f"❌ Failed: {err.get('message', err)}")
        else:
            print(result.get("message", "Browser opened. Complete the login, then run /provider status"))
    elif pid in API_KEY_PROVIDERS:
        if len(args) < 3:
            print(f"Usage: /provider connect {args[1]} <api-key>")
            sys.exit(1)
        api_key = args[2]
        result, err = fetch(f"/api/providers/{pid}/connect", method="POST", body={"apiKey": api_key})
        if err:
            print(f"❌ Connect failed: {err.get('message', err)}")
        else:
            print(f"✅ {pid} connected successfully")
    else:
        print(f"ℹ️  {pid} is always available (no auth needed)")

elif cmd == "disconnect":
    if len(args) < 2:
        print("Usage: /provider disconnect <name>")
        sys.exit(1)
    pid = NAME_MAP.get(args[1].lower())
    if not pid:
        print(f"❌ Unknown provider: {args[1]}")
        sys.exit(1)
    if pid == "github-copilot":
        result, err = fetch("/api/copilot/logout", method="POST", body={})
        if err:
            print(f"❌ Disconnect failed: {err.get('message', err)}")
        else:
            print("✅ GitHub Copilot disconnected")
    elif pid in API_KEY_PROVIDERS:
        result, err = fetch(f"/api/providers/{pid}/disconnect", method="POST")
        if err:
            print(f"❌ Disconnect failed: {err.get('message', err)}")
        else:
            print(f"✅ {pid} disconnected")
    else:
        print(f"ℹ️  {pid} cannot be disconnected (always available)")

else:
    print(f"Unknown command: {cmd}")
    print("Usage: /provider [status | connect <name> <key> | disconnect <name>]")

PYEOF
```
