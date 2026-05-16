---
allowed-tools: Bash(curl *), Bash(python3 *)
description: Connect a provider. Usage: /connect-provider <name> [api-key]
---

## Your Task

The user typed: **$ARGUMENTS**

Run this script and show the output verbatim:

```bash
python3 - "$ARGUMENTS" <<'PYEOF'
import sys, json, urllib.request, urllib.error

PROXY = "http://127.0.0.1:4001"
args = (sys.argv[1].strip() if len(sys.argv) > 1 else "").split()

NAME_MAP = {
    "github": "github-copilot", "copilot": "github-copilot",
    "github-copilot": "github-copilot",
    "gemini": "gemini", "google": "gemini",
    "openai": "openai",
    "groq": "groq",
    "nvidia": "nvidia",
    "openrouter": "openrouter",
}
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

if not args:
    print("Usage: /connect-provider <name> [api-key]")
    print()
    print("Providers that need an API key:")
    print("  gemini <key>     → Google Gemini")
    print("  openai <key>     → OpenAI / Codex")
    print("  groq <key>       → Groq (fast free inference)")
    print("  nvidia <key>     → NVIDIA NIM")
    print("  openrouter <key> → OpenRouter (100+ models)")
    print()
    print("Providers using OAuth:")
    print("  github           → GitHub Copilot (opens browser)")
    sys.exit(0)

name = args[0].lower()
pid = NAME_MAP.get(name)
if not pid:
    print(f"❌ Unknown provider: {name}")
    print(f"   Valid: {', '.join(NAME_MAP.keys())}")
    sys.exit(1)

if pid == "github-copilot":
    print("🔗 Opening browser for GitHub Copilot authentication...")
    result, err = fetch("/api/copilot/login", method="POST", body={})
    if err:
        print(f"❌ Failed: {err.get('message', err)}")
    else:
        print(result.get("message", "Browser opened. Complete auth, then run /providers to verify."))

elif pid in API_KEY_PROVIDERS:
    if len(args) < 2:
        hints = {
            "gemini": "Get key: https://aistudio.google.com/apikey",
            "openai": "Get key: https://platform.openai.com/api-keys",
            "groq": "Get key: https://console.groq.com/keys",
            "nvidia": "Get key: https://build.nvidia.com",
            "openrouter": "Get key: https://openrouter.ai/keys",
        }
        print(f"Usage: /connect-provider {name} <api-key>")
        if pid in hints:
            print(f"  {hints[pid]}")
        sys.exit(1)
    api_key = args[1]
    result, err = fetch(f"/api/providers/{pid}/connect", method="POST", body={"apiKey": api_key})
    if err:
        print(f"❌ Connect failed: {err.get('message', str(err))}")
    else:
        print(f"✅ {pid} connected. Run /providers to see available models.")
else:
    print(f"ℹ️  {pid} is always available — no connection needed")
PYEOF
```
