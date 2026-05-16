# graphify
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

## Utility Command Exceptions

For these slash commands, do NOT invoke any skills, do NOT run the superpowers workflow, and do NOT call the Skill tool at any point. Run the bash command shown and display its output verbatim:

- `/model` → run `model-open` (shows models; use arrow-key picker: run `model` in terminal)
- `/model <id>` → run `model-open <id>` (sets model by ID)
- `/switch-model` → run `model-open` (same as /model)
- `/provider` → run `provider-status`
- `/providers` → run `provider-status`
- `/connect-provider` → run `provider-status`

**Mode awareness**: `model-open` and `model` automatically detect whether you're in official Claude PRO mode or OpenCode Proxy mode based on environment. In official mode they show Claude PRO models; in proxy mode they show OpenCode models.

## Provider Management

When the user asks which AI providers are available, or if a request fails due to missing credentials:
1. Call the `list_providers` MCP tool to check current status
2. If the needed provider is disconnected, suggest: `/connect-provider <name> <key>`
3. Do NOT open browser or external URLs for provider management — use the CLI commands
