# graphify
- **graphify** (`~/.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else.

## Utility Command Exceptions

For these slash commands, do NOT invoke any skills, do NOT run the superpowers workflow, and do NOT call the Skill tool at any point. Just run the bash command and show its output verbatim:

- `/model`
- `/switch-model`
- `/provider`

