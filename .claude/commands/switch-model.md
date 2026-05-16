---
allowed-tools: Bash(~/bin/switch-model-chat), Bash(~/bin/switch-model-chat *)
description: List all models and switch. Usage: /switch-model
---

Run this command IMMEDIATELY with no other steps first:

```bash
~/bin/switch-model-chat
```

Print the FULL output exactly as returned — do not summarize or shorten it.

Then ask the user: **"Which model? Type a number or the full model name."**

When the user replies with a number or name, run:

```bash
~/bin/switch-model-chat <their_answer>
```

Print the exact output. Done.

RULES (must follow exactly):
- The ONLY commands you may run are `~/bin/switch-model-chat` (no args) and `~/bin/switch-model-chat <arg>`
- Never run `~/bin/switch-model` — that script hangs
- Never generate a model list from memory
- Never open a terminal window or use osascript
