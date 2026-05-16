---
allowed-tools: Bash(~/bin/switch-model list), Bash(~/bin/switch-model *)
description: Show all models and switch to one. Usage: /switch-model
---

## Your Task

**Step 1 — Run this exact command and paste the FULL output verbatim:**

```bash
~/bin/switch-model list
```

Do NOT summarize, shorten, or reformat the output. Paste it exactly as-is.

**Step 2 — Ask:**

"Which model do you want? Type a **number** (e.g. `5`) or the full model name."

**Step 3 — When the user replies, run:**

```bash
~/bin/switch-model <their_answer>
```

Paste the exact output. Then say: "✅ Done. Your **next message** will use that model."

---
**Rules:**
- ONLY run `~/bin/switch-model list` in Step 1 — nothing else
- NEVER run `~/bin/switch-model` without arguments
- NEVER generate your own model list from memory
