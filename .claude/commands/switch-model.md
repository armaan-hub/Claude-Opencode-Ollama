---
allowed-tools: Bash(~/bin/switch-model-chat), Bash(~/bin/switch-model-chat *)
description: "Switch model. Use: /switch-model [number] e.g. /switch-model 5"
---

Run exactly one command and paste ALL output. No explanation, no reasoning.

If $ARGUMENTS is set (user gave a number or name):
```bash
~/bin/switch-model-chat $ARGUMENTS
```

Otherwise:
```bash
~/bin/switch-model-chat
```

After printing output, stop. Do not add any other text.
