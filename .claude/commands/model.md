---
allowed-tools: Bash(python3 *), Bash(osascript *)
description: Open interactive model picker (zero-token TUI). Usage: /model  or  /model <id>  or  /model clear
---

Run this and show its output verbatim. Do NOT invoke any skills or superpowers.

```bash
python3 - "$ARGUMENTS" <<'PYEOF'
import sys, os, subprocess

ACTIVE = os.path.expanduser("~/.claude/active-model")
arg = sys.argv[1].strip() if len(sys.argv) > 1 else ""

# Handle direct switch or clear
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
    print("   Takes effect on your next message.")
    sys.exit(0)

# No arg — show current and open interactive picker in new Terminal window
cur = open(ACTIVE).read().strip() if os.path.exists(ACTIVE) else "none"
print(f"Active model: {cur}")
print()
print("🪟  Opening interactive model picker in a new Terminal window...")
print("   Select a model with arrow keys, press Enter to confirm, Esc to cancel.")

# Open ~/bin/model in a new macOS Terminal window
script = '''tell application "Terminal"
    set newTab to do script "source ~/.zshrc 2>/dev/null; ~/bin/model; sleep 0.5; exit"
    set frontmost to true
end tell'''

result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True)
if result.returncode != 0:
    print()
    print("Could not open Terminal automatically.")
    print("Run manually in a terminal:  model")
PYEOF
```
