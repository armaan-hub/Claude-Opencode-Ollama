---
allowed-tools: Bash(python3 *)
description: Switch active LLM model. Usage: /switch-model [name|clear|status]
---

Run this command and show its output verbatim:

```bash
python3 - "$ARGUMENTS" <<'PYEOF'
import subprocess, sys, json, os, urllib.request

args = sys.argv[1].strip() if len(sys.argv) > 1 else ""
ACTIVE = os.path.expanduser("~/.claude/active-model")
PROXY  = "http://localhost:4001"

current = open(ACTIVE).read().strip() if os.path.exists(ACTIVE) else "none"

models_data = None
try:
    with urllib.request.urlopen(f"{PROXY}/v1/models", timeout=4) as r:
        models_data = json.loads(r.read())
except Exception:
    pass

def get_models():
    if not models_data or "data" not in models_data:
        return []
    return [m["id"] for m in models_data["data"] if m.get("id")]

def get_by_provider():
    if not models_data or "data" not in models_data:
        return {}
    result = {}
    for m in models_data["data"]:
        mid, owner = m.get("id",""), m.get("owned_by","other")
        if mid:
            result.setdefault(owner, []).append(mid)
    return result

if args in ("", "status"):
    print(f"📍 Active model: {current}")
    if not models_data:
        print(f"\n⚠️  Proxy unreachable at {PROXY}")
        print("   Start: launchctl start com.opencode.proxy")
    else:
        by_provider = get_by_provider()
        print()
        for owner, ids in by_provider.items():
            print(f"[{owner.upper()}]")
            for mid in ids:
                marker = " ← active" if mid == current else ""
                print(f"  {mid}{marker}")
        print(f"\nUsage: /switch-model <id>  or  /switch-model clear")

elif args == "clear":
    if os.path.exists(ACTIVE):
        os.remove(ACTIVE)
    print("✅ Model override cleared.")

else:
    model_id = args
    all_models = get_models()
    if not all_models:
        print(f"⚠️  Proxy unreachable — writing '{model_id}' unvalidated.")
    elif model_id not in all_models:
        print(f"❌ Unknown model: {model_id}")
        print("   Run /switch-model to see the list.")
        sys.exit(1)

    if model_id.startswith("copilot/"):
        result = subprocess.run(["gh","auth","status"], capture_output=True, text=True)
        if result.returncode != 0:
            print("❌ GitHub Copilot requires login.")
            print("   Run: gh auth login")
            sys.exit(1)

    os.makedirs(os.path.dirname(ACTIVE), exist_ok=True)
    with open(ACTIVE, "w") as f:
        f.write(model_id + "\n")
    print(f"✅ Switched to {model_id}")
    print("   (Takes effect on your next message. Use /switch-model clear to undo.)")

PYEOF
```
