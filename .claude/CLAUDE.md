# graphify
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

## Utility Command Exceptions

For these slash commands, do NOT invoke any skills, do NOT run the superpowers workflow, and do NOT call the Skill tool at any point. Run the bash command shown and display its output verbatim:

- `/model` → run `~/bin/model` (opens interactive fzf model picker in the terminal)
- `/model <id>` → run `~/bin/model <id>` (switches to that model directly)
- `/switch-model` → run `~/bin/model` (same as /model)
- `/provider` → run `provider-status`
- `/providers` → run `provider-status`
- `/connect-provider` → run `provider-status`

**Mode awareness**: `model` auto-detects official Claude PRO mode vs OpenCode Proxy mode based on environment. In official mode it shows Claude PRO models; in proxy mode it shows OpenCode models.

## Provider Management

When the user asks which AI providers are available, or if a request fails due to missing credentials:
1. Call the `list_providers` MCP tool to check current status
2. If the needed provider is disconnected, suggest: `/connect-provider <name> <key>`
3. Do NOT open browser or external URLs for provider management — use the CLI commands
