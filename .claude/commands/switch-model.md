---
allowed-tools: Bash(osascript *), Bash(cat *), Bash(sleep *), Bash(echo *)
description: Open interactive model picker in a Terminal window. Pick with arrow keys, live switch — no restart needed.
---

## Your Task

Run EXACTLY these bash commands in sequence. Do NOT generate text about models from memory. Do NOT summarize. Do NOT run any other commands.

**Step 1 — Show current model:**

```bash
echo "Current model: $(cat ~/.claude/active-model 2>/dev/null || echo 'unknown')"
```

**Step 2 — Open the model picker in a Terminal window:**

```bash
osascript -e 'tell application "Terminal" to activate' -e 'tell application "Terminal" to do script "source ~/.zprofile 2>/dev/null; source ~/.zshrc 2>/dev/null; ~/bin/switch-model; echo; echo \"Done — you can close this window\""'
```

Say verbatim: "✅ **Model picker opened in Terminal window.** Use ↑↓ arrows to browse, type to search, Enter to select. Come back here after you have picked."

**Step 3 — After the user says they picked a model, run:**

```bash
echo "Active model is now: $(cat ~/.claude/active-model 2>/dev/null || echo 'unknown')"
```

Say: "Your **next message** will use that model."
