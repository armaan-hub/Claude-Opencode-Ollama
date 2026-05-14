---
allowed-tools: Bash(python3 *)
description: List or set active LLM model. Usage: /model  or  /model <id>  or  /model clear
---

Run this Python script and show its output verbatim. Do NOT invoke any skills.

```bash
python3 - "$ARGUMENTS" <<'PYEOF'
import sys, json, os, urllib.request

ACTIVE = os.path.expanduser("~/.claude/active-model")
PROXY  = "http://localhost:4001"
arg    = sys.argv[1].strip() if len(sys.argv) > 1 else ""

def read_active():
    return open(ACTIVE).read().strip() if os.path.exists(ACTIVE) else "none"

def fetch_models():
    try:
        with urllib.request.urlopen(f"{PROXY}/v1/models", timeout=4) as r:
            return json.loads(r.read())
    except Exception:
        return None

# handle write actions
if arg == "clear":
    if os.path.exists(ACTIVE):
        os.remove(ACTIVE)
    print("✅ Model override cleared.")
    sys.exit(0)

if arg and arg != "status":
    os.makedirs(os.path.dirname(ACTIVE), exist_ok=True)
    with open(ACTIVE, "w") as f:
        f.write(arg)
    print(f"✅ Switched to: {arg}")
    print("   Active on your next message.")
    sys.exit(0)

# display model list
cur  = read_active()
data = fetch_models()

print(f"Active model: {cur}\n")

if not data:
    print(f"⚠️  Proxy unreachable at {PROXY}")
    print("   Start proxy: node ~/opencode-proxy-server.js &")
    sys.exit(1)

by_owner = {}
for m in data.get("data", []):
    mid   = m.get("id", "")
    owner = m.get("owned_by", "other")
    rate  = m.get("x_copilot_rate")
    if mid:
        by_owner.setdefault(owner, []).append((mid, rate))

for owner, models in by_owner.items():
    print(f"[{owner.upper()}]")
    for mid, rate in models:
        if rate == 0:
            rs = " [FREE]"
        elif rate is not None and rate != 1:
            rs = f" [{rate}x]"
        else:
            rs = ""
        marker = "  ← active" if mid == cur else ""
        print(f"  {mid}{rs}{marker}")
    print()

print("Usage:  /model <id>   to switch   |   /model clear   to remove override")
PYEOF
```
