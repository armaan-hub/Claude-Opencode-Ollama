---
allowed-tools: Bash(curl *), Bash(python3 *), Bash(echo *)
description: Switch proxy model — lists all 57 models (OpenCode + GitHub Copilot). Usage: /model [number or name]
---

## Your Task

The user typed: **$ARGUMENTS**

Run this Python script and follow the logic it defines:

```bash
python3 - "$ARGUMENTS" <<'PYEOF'
import sys, json, urllib.request, os, re

PROXY = "http://127.0.0.1:4001"
SETTINGS = os.path.expanduser("~/.claude-proxy/settings.json")
arg = (sys.argv[1].strip() if len(sys.argv) > 1 else "").strip()

# Fetch models
try:
    with urllib.request.urlopen(f"{PROXY}/v1/models", timeout=5) as r:
        data = json.load(r)
    models = [m["id"] for m in data.get("data", [])]
except Exception as e:
    print(f"❌ Cannot reach proxy at {PROXY}")
    print("   Make sure proxy is running: run-claude-opencode")
    sys.exit(0)

# Check if arg is a number or model name selection
selected = None
if arg:
    if arg.isdigit():
        idx = int(arg) - 1
        if 0 <= idx < len(models):
            selected = models[idx]
        else:
            print(f"❌ Number {arg} is out of range (1-{len(models)})")
            arg = ""
    else:
        # Try matching by name (exact or partial)
        matches = [m for m in models if arg.lower() in m.lower()]
        if len(matches) == 1:
            selected = matches[0]
        elif len(matches) > 1:
            print(f"⚠️  Multiple matches for '{arg}':")
            for i, m in enumerate(matches, 1):
                print(f"   {i}. {m}")
            print("\nBe more specific or use a number from the full list below.")
            arg = ""
        else:
            print(f"❌ No model matching '{arg}'")
            arg = ""

# Apply selection
if selected:
    try:
        with open(SETTINGS) as f:
            settings = json.load(f)
        settings["model"] = selected
        with open(SETTINGS, "w") as f:
            json.dump(settings, f, indent=2)
        print(f"✅ Model updated to: {selected}")
        print(f"   Settings: {SETTINGS}")
        print()
        print("🔄 To apply: restart with  run-claude-opencode")
    except Exception as e:
        print(f"❌ Could not update settings: {e}")
    sys.exit(0)

# No valid selection — show full list
opencode = [m for m in models if not m.startswith("gh-copilot/")]
copilot  = [m for m in models if m.startswith("gh-copilot/")]

print(f"📋 {len(models)} available proxy models\n")
print("── OpenCode / Zen ──────────────────────────────")
for i, m in enumerate(opencode, 1):
    print(f"  {i:2}. {m}")
print()
print("── GitHub Copilot ──────────────────────────────")
for i, m in enumerate(copilot, len(opencode) + 1):
    print(f"  {i:2}. {m}")
print()
print("Usage:")
print("  /model 5              → select by number")
print("  /model gpt-5.5        → select by name")
print("  /model gh-copilot/gpt → partial name match")
PYEOF
```

Show the output exactly as-is. No extra commentary.

If the output says "✅ Model updated", also tell the user:
> **Current session is not affected.** The next time you run `run-claude-opencode` it will start with the new model.
