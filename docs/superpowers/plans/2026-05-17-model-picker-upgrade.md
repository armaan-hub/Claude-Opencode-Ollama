# Model Picker Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the numbered startup picker in `run-claude-opencode` with an fzf arrow-key UI, fix `model` command auto-detection, add a `switch-model` command, and add a `/switch-model` Claude Code slash command — all enabling live model switching without restarting Claude Code.

**Architecture:** The proxy already hot-swaps models on every request by reading `~/.claude/active-model`. We simply improve the surfaces that write to that file: (1) fzf at startup, (2) `~/bin/model` works even without `ANTHROPIC_BASE_URL` set (auto-detect proxy), (3) new `~/bin/switch-model` script for non-interactive listing + direct switching, (4) `~/.claude/commands/switch-model.md` slash command that Claude executes via bash tool inside the chat.

**Tech Stack:** bash, fzf (`/opt/homebrew/bin/fzf` v0.72.0), python3, curl, node proxy on port 4001.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `~/bin/run-claude-opencode` | Modify lines 74–123 | Replace numbered picker with fzf |
| `~/bin/model` | Modify line 19–20 | Auto-detect proxy mode via nc |
| `~/bin/switch-model` | Create | Non-interactive list + direct set + fzf picker |
| `~/.claude/commands/switch-model.md` | Create | Slash command Claude executes from chat |

---

## Task 1: fzf Startup Picker in `run-claude-opencode`

**Files:**
- Modify: `~/bin/run-claude-opencode` lines 74–123 (the `if [[ -z "$MODEL_ARG" ]]; then ... fi` block)

### What to change

Replace the current numbered-list picker block (lines 74–123) with the fzf block below.

The current block starts at:
```bash
# If no model specified, show interactive picker
if [[ -z "$MODEL_ARG" ]]; then
  echo ""
  echo "╔══════...
```

And ends at:
```bash
  fi
fi
```

- [ ] **Step 1: Open `~/bin/run-claude-opencode` and find the picker block (lines 74–123)**

Read the file to confirm the exact boundaries before editing.

- [ ] **Step 2: Replace the entire picker block with the fzf version**

Replace from `# If no model specified, show interactive picker` through the closing `fi` of that block with:

```bash
# If no model specified, show interactive picker
if [[ -z "$MODEL_ARG" ]]; then
  echo ""
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║      Claude Code — PROXY MODE                                  ║"
  echo "║      Proxy: http://127.0.0.1:4001                              ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo ""

  # Fetch models from proxy
  MODELS_JSON=$(curl -sf --max-time 5 "$PROXY_URL/v1/models" 2>/dev/null)

  if [[ -z "$MODELS_JSON" ]]; then
    echo "⚠️  Could not fetch models from proxy. Using default: gpt-4o"
    MODEL_ARG="gpt-4o"
  else
    # Read current active model for pre-selection indicator
    CURRENT_MODEL=""
    if [[ -f "$HOME/.claude/active-model" ]]; then
      _content=$(cat "$HOME/.claude/active-model" | tr -d '\n')
      if [[ "$_content" == "{"* ]]; then
        CURRENT_MODEL=$(echo "$_content" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('model',''))" 2>/dev/null || echo "")
      else
        CURRENT_MODEL="$_content"
      fi
    fi

    # Build display lines for fzf
    LINES=$(echo "$MODELS_JSON" | "$PYTHON_BIN" -c "
import sys, json
cur = '$CURRENT_MODEL'
data = json.load(sys.stdin)
for m in data.get('data', []):
    mid   = m.get('id', '')
    owner = m.get('owned_by', 'other')
    rate  = m.get('x_copilot_rate')
    if not mid: continue
    if rate == 0:          rate_str = '0x'
    elif rate is not None: rate_str = f'{rate}x'
    else:                  rate_str = '  '
    active = '✓' if mid == cur else ' '
    print(f'{active}  {mid:<42} {rate_str:<7}  {owner}')
")

    MODEL_COUNT=$(echo "$LINES" | grep -c . || echo "0")
    FZF_BIN=$(which fzf 2>/dev/null || echo "")

    if [[ -n "$FZF_BIN" ]]; then
      # Interactive fzf arrow-key picker
      SELECTED=$( echo "$LINES" | "$FZF_BIN" \
        --ansi \
        --prompt="  Search models... " \
        --pointer="▶" \
        --marker="✓" \
        --height=50% \
        --layout=reverse \
        --border=rounded \
        --border-label=" ⚡ Select Model " \
        --border-label-pos=3 \
        --info=inline \
        --header="  ↑↓ arrows · type to search · Enter to select   ✓ = last used   0x=FREE
  Active: ${CURRENT_MODEL:-none}   ($MODEL_COUNT models available)" \
        --header-first \
        --bind "ctrl-c:abort,esc:abort" \
        --no-preview \
        < /dev/tty > /dev/tty 2>/dev/null ) || true

      if [[ -z "$SELECTED" ]]; then
        echo "Cancelled."
        exit 0
      fi
      MODEL_ARG=$(echo "$SELECTED" | awk '{print $2}')
    else
      # Fallback: numbered list (fzf not installed)
      declare -a model_array
      index=0
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        mid=$(echo "$line" | awk '{print $2}')
        model_array[$index]="$mid"
        printf "  %2d. %s\n" $((index + 1)) "$line"
        index=$((index + 1))
      done <<< "$LINES"

      TOTAL=${#model_array[@]}
      echo ""
      read -r -p "Choice (1-${TOTAL}) or model name [Enter = ${CURRENT_MODEL:-gpt-4o}]: " choice

      if [[ -z "$choice" ]]; then
        MODEL_ARG="${CURRENT_MODEL:-gpt-4o}"
      elif [[ "$choice" =~ ^[0-9]+$ ]] && [[ $choice -ge 1 && $choice -le $TOTAL ]]; then
        MODEL_ARG="${model_array[$((choice - 1))]}"
      else
        MODEL_ARG="$choice"
      fi
    fi
  fi
fi
```

- [ ] **Step 3: Also fix the mktemp line (line ~132)**

The current `mktemp` call:
```bash
TEMP_SETTINGS=$(mktemp /tmp/claude-proxy-settings.XXXXXX)
```
On macOS the template must end with X's. This version is correct (`.XXXXXX` ends the path). But verify it doesn't have any other form by grepping:
```bash
grep -n mktemp ~/bin/run-claude-opencode
```
If you find any variant with `.json` after the X's (e.g. `-XXXXXX.json`), change it to:
```bash
TEMP_SETTINGS=$(mktemp /tmp/claude-proxy-settings-XXXXXX)
```

- [ ] **Step 4: Test the fzf picker manually**

```bash
# In a new terminal (proxy must be running)
run-claude-opencode
```
Expected: fzf UI appears with arrow-key selection. Selecting a model proceeds to launch Claude with that model.

- [ ] **Step 5: Commit**

```bash
cd ~/Claude-Opencode-Ollama
git add ~/bin/run-claude-opencode
git commit -m "feat: replace numbered picker with fzf arrow-key UI at startup

- Arrow keys + type-to-search replaces numbered list
- Pre-selects last-used model with ✓ marker
- Shows model rate (0x=FREE, 1x, 15x etc.)
- Falls back to numbered list if fzf not installed
- Cancelled/Esc exits cleanly

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2: Fix `~/bin/model` — Auto-Detect Proxy Mode

**Files:**
- Modify: `~/bin/model` lines 19–20 (mode detection block)

**Problem:** `~/bin/model` currently only enters proxy mode if `ANTHROPIC_BASE_URL` env var is set to the proxy URL. When the user runs `model` from a new terminal (without that env var), it shows official Claude models instead of proxy models — even if the proxy is running.

**Fix:** Also check if the proxy is reachable at `127.0.0.1:4001` and, if so, default to proxy mode.

- [ ] **Step 1: Locate the mode detection lines in `~/bin/model`**

```bash
grep -n "IS_PROXY_MODE" ~/bin/model | head -5
```
Expected lines:
```
19: IS_PROXY_MODE=0
20: [[ "${ANTHROPIC_BASE_URL:-}" == "$PROXY_URL"* ]] && IS_PROXY_MODE=1
```

- [ ] **Step 2: Replace the two-line detection block with a three-condition check**

Replace:
```bash
IS_PROXY_MODE=0
[[ "${ANTHROPIC_BASE_URL:-}" == "$PROXY_URL"* ]] && IS_PROXY_MODE=1
```

With:
```bash
IS_PROXY_MODE=0
if [[ "${ANTHROPIC_BASE_URL:-}" == "$PROXY_URL"* ]]; then
  IS_PROXY_MODE=1
elif nc -z 127.0.0.1 4001 2>/dev/null; then
  IS_PROXY_MODE=1
fi
```

- [ ] **Step 3: Test from a fresh terminal (no ANTHROPIC_BASE_URL set)**

```bash
env -i HOME="$HOME" PATH="$PATH" ~/bin/model list
```
Expected: Shows proxy models (opencode/*, gh-copilot/*), NOT the four Claude PRO models.

- [ ] **Step 4: Commit**

```bash
cd ~/Claude-Opencode-Ollama
git add ~/bin/model
git commit -m "fix: model command auto-detects proxy mode via nc

Previously required ANTHROPIC_BASE_URL env var to detect proxy mode.
Now also checks if proxy is reachable at 127.0.0.1:4001.
Allows running 'model' from any terminal while proxy is running.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3: Create `~/bin/switch-model` Command

**Files:**
- Create: `~/bin/switch-model`

**Purpose:** A standalone command for fast model switching that works in three modes:
1. **No args, TTY present** → launches fzf picker (same as `model` in proxy mode)
2. **`switch-model list`** → non-interactive numbered list (works inside Claude Code bash tool, no TTY needed)
3. **`switch-model <model-name>`** → directly writes model to `~/.claude/active-model`

- [ ] **Step 1: Create `~/bin/switch-model`**

```bash
cat > ~/bin/switch-model << 'SCRIPT'
#!/bin/bash
# switch-model — Live model switcher for Claude Code proxy
#
# Usage:
#   switch-model              → fzf arrow-key picker (needs terminal TTY)
#   switch-model list         → numbered list (safe inside Claude Code bash tool)
#   switch-model <model-name> → switch directly (e.g. switch-model opencode/gpt-4o)
#   switch-model status       → show current active model
#
# The proxy reads ~/.claude/active-model on EVERY request — no restart needed.
# Your NEXT message to Claude will use the new model.

ACTIVE="$HOME/.claude/active-model"
PROXY_URL="http://127.0.0.1:4001"

_current_model() {
  if [[ ! -f "$ACTIVE" ]]; then echo "none"; return; fi
  local c; c=$(cat "$ACTIVE" | tr -d '\n')
  if [[ "$c" == "{"* ]]; then
    echo "$c" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('model','none'))" 2>/dev/null || echo "none"
  else
    echo "${c:-none}"
  fi
}

_fetch_models() {
  local data; data=$(curl -sf --max-time 5 "$PROXY_URL/v1/models" 2>/dev/null)
  if [[ -z "$data" ]]; then
    echo "⚠️  Proxy not running at $PROXY_URL" >&2
    echo "   Start it: cd ~/Claude-Opencode-Ollama && node opencode-proxy-server.js &" >&2
    return 1
  fi
  echo "$data"
}

_set_model() {
  local id="$1"
  [[ -z "$id" ]] && echo "Usage: switch-model <model-id>" && exit 1
  mkdir -p "$(dirname "$ACTIVE")"
  printf "%s" "$id" > "$ACTIVE"
  echo "✅ Switched to: $id"
  echo "   → Your NEXT message will use this model"
}

cmd_list() {
  local data; data=$(_fetch_models) || exit 1
  local cur; cur=$(_current_model)
  echo "$data" | python3 -c "
import sys, json
cur = '$cur'
data = json.load(sys.stdin)
print(f'Active model: {cur}\n')
idx = 1
for m in data.get('data', []):
    mid  = m.get('id', '')
    rate = m.get('x_copilot_rate')
    if not mid: continue
    if rate == 0:          rate_str = 'FREE'
    elif rate is not None: rate_str = f'{rate}x'
    else:                  rate_str = ''
    mark = '✓' if mid == cur else ' '
    print(f'  {mark} {idx:>2}. {mid:<44}  {rate_str}')
    idx += 1
print(f'\nTo switch: switch-model <model-name>  OR  switch-model <number>')
"
  # Store count for direct number selection
  _LAST_LIST_DATA="$data"
}

cmd_pick_fzf() {
  local data; data=$(_fetch_models) || exit 1
  local cur; cur=$(_current_model)
  local lines
  lines=$(echo "$data" | python3 -c "
import sys, json
cur = sys.argv[1]
data = json.load(sys.stdin)
for m in data.get('data', []):
    mid   = m.get('id', '')
    owner = m.get('owned_by', 'other')
    rate  = m.get('x_copilot_rate')
    if not mid: continue
    if rate == 0:          rate_str = '0x'
    elif rate is not None: rate_str = f'{rate}x'
    else:                  rate_str = '  '
    active = '✓' if mid == cur else ' '
    print(f'{active}  {mid:<42} {rate_str:<7}  {owner}')
" "$cur")

  [[ -z "$lines" ]] && echo "No models returned." && exit 1
  local count; count=$(echo "$lines" | grep -c . || echo 0)
  local selected
  selected=$(echo "$lines" | fzf \
    --ansi \
    --prompt="  Search models... " \
    --pointer="▶" \
    --marker="✓" \
    --height=100% \
    --layout=reverse \
    --border=rounded \
    --border-label=" ⚡ Switch Model (live — no restart needed) " \
    --border-label-pos=3 \
    --info=inline \
    --header="  ↑↓ arrows · type to search · Enter to select · Esc to cancel
  ✓ = currently active                   Rate: 0x=FREE  0.33x  1x  7.5x  15x
  ──────────────────────────────────────────────────────────────────────────
  Active: $cur   ($count models)" \
    --header-first \
    --bind "ctrl-c:abort,esc:abort" \
    --no-preview \
    < /dev/tty > /dev/tty 2>/dev/null) || true

  if [[ -z "$selected" ]]; then echo "Cancelled — no change."; exit 0; fi
  local model_id; model_id=$(echo "$selected" | awk '{print $2}')
  _set_model "$model_id"
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "${1:-}" in
  list|ls|-l)
    cmd_list
    ;;
  status|-s)
    echo "Active model: $(_current_model)"
    ;;
  "")
    # No args: use fzf if TTY available, else show list
    if [[ -t 0 ]] && command -v fzf &>/dev/null; then
      cmd_pick_fzf
    else
      echo "⚠️  No TTY or fzf not found — showing list instead. Use: switch-model <name>"
      cmd_list
    fi
    ;;
  *)
    # Could be a direct model name OR a number from a previous list
    if [[ "$1" =~ ^[0-9]+$ ]]; then
      # Numeric — fetch models and pick by index
      data=$(_fetch_models) || exit 1
      model_id=$(echo "$data" | python3 -c "
import sys, json
idx = int(sys.argv[1]) - 1
data = json.load(sys.stdin)
models = [m['id'] for m in data.get('data', []) if m.get('id')]
if 0 <= idx < len(models):
    print(models[idx])
" "$1")
      if [[ -z "$model_id" ]]; then
        echo "⚠️  No model at index $1. Run: switch-model list"
        exit 1
      fi
      _set_model "$model_id"
    else
      _set_model "$1"
    fi
    ;;
esac
SCRIPT
chmod +x ~/bin/switch-model
```

- [ ] **Step 2: Verify script was created and is executable**

```bash
ls -la ~/bin/switch-model
head -5 ~/bin/switch-model
```
Expected: file exists, starts with `#!/bin/bash`, has execute permission.

- [ ] **Step 3: Test non-interactive list (simulates Claude Code bash tool usage)**

```bash
~/bin/switch-model list
```
Expected: Numbered list of all proxy models with active one marked ✓, rate info, and instructions.

- [ ] **Step 4: Test direct switch**

```bash
~/bin/switch-model opencode/minimax-m2.5-free
cat ~/.claude/active-model
```
Expected:
```
✅ Switched to: opencode/minimax-m2.5-free
   → Your NEXT message will use this model
opencode/minimax-m2.5-free
```

- [ ] **Step 5: Test numeric switch**

```bash
~/bin/switch-model 1
cat ~/.claude/active-model
```
Expected: Switches to whichever model is at index 1, prints confirmation.

- [ ] **Step 6: Test status**

```bash
~/bin/switch-model status
```
Expected: `Active model: opencode/minimax-m2.5-free` (or whatever was set).

- [ ] **Step 7: Commit**

```bash
cd ~/Claude-Opencode-Ollama
git add ~/bin/switch-model
git commit -m "feat: add switch-model command for live model hot-swap

- 'switch-model list'   → numbered list (works inside Claude Code chat)
- 'switch-model <name>' → switch directly by model ID
- 'switch-model <num>'  → switch by number from list
- 'switch-model'        → fzf arrow-key picker (TTY)
- 'switch-model status' → show current active model
- Proxy hot-swaps on next request, no Claude restart needed

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4: Create `/switch-model` Claude Code Slash Command

**Files:**
- Create: `~/.claude/commands/switch-model.md`

**Purpose:** A custom slash command for use inside Claude Code's chat. When the user types `/switch-model`, Claude Code loads these instructions and Claude (AI) executes the bash commands to list models and perform the switch — no terminal or restart needed.

**How Claude Code slash commands work:**
- Files in `~/.claude/commands/<name>.md` become `/name` slash commands
- When invoked, the file content is the instruction set Claude follows
- Claude can execute bash via its bash tool
- `$ARGUMENTS` is replaced with anything typed after the command name (e.g. `/switch-model gpt-4o` → `$ARGUMENTS = gpt-4o`)

- [ ] **Step 1: Create `~/.claude/commands/switch-model.md`**

```bash
cat > ~/.claude/commands/switch-model.md << 'EOF'
Switch the active AI model for this Claude Code session.

If the user provided a model name or number, use it directly.
Otherwise, first run this bash command to show available models:

```bash
~/bin/switch-model list
```

Show the output to the user. Then ask: "Which model would you like to switch to? (type a number or model name)"

Wait for their reply. Then switch to their chosen model:

```bash
~/bin/switch-model $ARGUMENTS
```

If $ARGUMENTS is empty, wait for user input after showing the list before running switch-model.

After switching, confirm: "✅ Switched to [model-name]. Your NEXT message will use this model."

Note: No restart required — the proxy reads the active model file on every request.
EOF
```

- [ ] **Step 2: Verify the file was created**

```bash
cat ~/.claude/commands/switch-model.md
```
Expected: File content as written above.

- [ ] **Step 3: Test the slash command**

Open Claude Code (via `run-claude-opencode`). In the chat type:
```
/switch-model
```
Expected: Claude runs `~/bin/switch-model list`, shows the numbered model list, asks which one to switch to.

Then type a model number or name. Expected: Claude runs `~/bin/switch-model <choice>`, confirms the switch, and the next message uses the new model.

- [ ] **Step 4: Test with direct model name**

In Claude Code chat:
```
/switch-model opencode/minimax-m2.5-free
```
Expected: Claude switches directly without showing the list.

- [ ] **Step 5: Commit**

```bash
cd ~/Claude-Opencode-Ollama
git add ~/.claude/commands/switch-model.md
git commit -m "feat: add /switch-model slash command for Claude Code

Type /switch-model in Claude Code chat to:
- See a numbered list of all proxy models
- Pick by number or name
- Switch the active model without restarting Claude

Works via proxy hot-swap (active-model file). No restart needed.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Final Verification Checklist

After all four tasks are complete:

- [ ] `run-claude-opencode` shows fzf picker with arrow-key navigation at startup
- [ ] `model` command works from a new terminal (no `ANTHROPIC_BASE_URL` needed) — shows proxy models
- [ ] `switch-model list` prints numbered list without requiring TTY
- [ ] `switch-model <name>` writes to `~/.claude/active-model` and shows confirmation
- [ ] `switch-model <number>` switches by index number
- [ ] `/switch-model` in Claude Code chat shows model list and performs the switch
- [ ] All proxy models appear in the list (verify count ≥ 30 in `switch-model list`)
- [ ] After switching, next Claude message uses the new model (check proxy log or `/switch-model status`)

```bash
# Quick sanity check — run all at once
echo "=== switch-model status ===" && switch-model status
echo "=== switch-model list (first 5) ===" && switch-model list | head -10
echo "=== model list (proxy mode) ===" && ~/bin/model list 2>&1 | head -10
```

---

## Troubleshooting Notes

**fzf not found at startup:** The numbered-list fallback activates. Install fzf: `brew install fzf`.

**Proxy not running:** `switch-model list` will print `⚠️ Proxy not running at http://127.0.0.1:4001`. Start proxy: `cd ~/Claude-Opencode-Ollama && node opencode-proxy-server.js &`

**`model` still shows official mode:** Verify nc is available and proxy is running: `nc -z 127.0.0.1 4001 && echo "proxy up"`.

**Active model file has JSON:** The proxy's `readActiveModel()` (in `opencode-proxy-server.js`) handles JSON format — already fixed in commit 6af18eb. `switch-model` also handles JSON in `_current_model()`.
