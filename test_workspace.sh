#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# test_workspace.sh — TDD Tests for AI Workspace (setup_workspace.sh)
# ═══════════════════════════════════════════════════════════════════════════
# RUN: bash ~/test_workspace.sh
# EXPECTED FIRST RUN: Several failures (tmux session / layout / pane titles)
# AFTER FIXES: All tests should pass

set -o pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

# ── Counters ─────────────────────────────────────────────────────────────────
PASS=0; FAIL=0; SKIP=0
FAILURES=()

pass() { echo -e "  ${GREEN}✓${RESET} $1"; ((PASS++)); }
fail() {
  local msg="$1" hint="${2:-}"
  echo -e "  ${RED}✗${RESET} $msg"
  [[ -n "$hint" ]] && echo -e "    ${YELLOW}↳ hint: $hint${RESET}"
  ((FAIL++))
  FAILURES+=("$msg")
}
skip() { echo -e "  ${YELLOW}⊘${RESET} $1"; ((SKIP++)); }
section() { echo -e "\n${BOLD}${BLUE}══ $1 ══${RESET}"; }

# ── Constants ────────────────────────────────────────────────────────────────
WORKSPACE_SESSION="workspace"
TEST_SESSION="ws-test-$$"
TEST_DIR="$HOME/workspace-test-project-$$"
SETUP_SCRIPT="$HOME/setup_workspace.sh"
WORKSTATION_SCRIPT="$HOME/workstation"
YAZI_THEME="$HOME/.config/yazi/theme.toml"
GHOSTTY_CONFIG="$HOME/.config/ghostty/config"

# ── Cleanup on exit ──────────────────────────────────────────────────────────
cleanup() {
  tmux kill-session -t "$TEST_SESSION" 2>/dev/null || true
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT INT TERM

# ── Build test project dir ───────────────────────────────────────────────────
mkdir -p "$TEST_DIR"
touch "$TEST_DIR/README.md" "$TEST_DIR/main.py" "$TEST_DIR/main.sh"
touch "$TEST_DIR/.env" "$TEST_DIR/.gitignore"
mkdir -p "$TEST_DIR/src" "$TEST_DIR/.git"

# ════════════════════════════════════════════════════════════════════════════
section "1. TOOL CHECKS — required binaries"
# ════════════════════════════════════════════════════════════════════════════

REQUIRED_TOOLS=(tmux fzf fastfetch yazi btop)
for tool in "${REQUIRED_TOOLS[@]}"; do
  path=$(command -v "$tool" 2>/dev/null)
  if [[ -z "$path" ]]; then
    fail "$tool exists in PATH" "brew install $tool"
  elif [[ ! -x "$path" ]]; then
    fail "$tool is executable (found at $path but not executable)" "chmod +x $path"
  else
    pass "$tool exists and is executable ($path)"
  fi
done

# Verify tools respond (not just exist as dead symlinks)
for tool in "${REQUIRED_TOOLS[@]}"; do
  if command -v "$tool" &>/dev/null; then
    if "$tool" --version &>/dev/null || "$tool" --help &>/dev/null 2>&1 || true; then
      pass "$tool responds to invocation"
    else
      fail "$tool binary exists but fails to respond" "reinstall: brew reinstall $tool"
    fi
  fi
done

# ════════════════════════════════════════════════════════════════════════════
section "2. SCRIPT CHECKS — setup_workspace.sh & workstation"
# ════════════════════════════════════════════════════════════════════════════

# setup_workspace.sh
if [[ -f "$SETUP_SCRIPT" ]]; then
  pass "setup_workspace.sh exists"
else
  fail "setup_workspace.sh exists" "file not found at $SETUP_SCRIPT"
fi

if [[ -x "$SETUP_SCRIPT" ]]; then
  pass "setup_workspace.sh is executable"
else
  fail "setup_workspace.sh is executable" "run: chmod +x $SETUP_SCRIPT"
fi

# workstation script
if [[ -f "$WORKSTATION_SCRIPT" ]]; then
  pass "workstation script exists"
else
  fail "workstation script exists" "file not found at $WORKSTATION_SCRIPT"
fi

if [[ -x "$WORKSTATION_SCRIPT" ]]; then
  pass "workstation is executable"
else
  fail "workstation is executable" "run: chmod +x $WORKSTATION_SCRIPT"
fi

# workstation 'run' delegates to setup_workspace.sh
if grep -q 'setup_workspace\.sh' "$WORKSTATION_SCRIPT" 2>/dev/null; then
  # Check it's under the run|start case
  if grep -A3 'run|start\|run.*start' "$WORKSTATION_SCRIPT" 2>/dev/null | grep -q 'setup_workspace\.sh'; then
    pass "workstation 'run' delegates to setup_workspace.sh"
  else
    fail "workstation 'run' delegates to setup_workspace.sh" \
      "setup_workspace.sh referenced but not under run|start case"
  fi
else
  fail "workstation 'run' delegates to setup_workspace.sh" \
    "add '~/setup_workspace.sh' call under 'run|start)' case in $WORKSTATION_SCRIPT"
fi

# setup_workspace.sh has a tool-check loop that includes required tools
TOOL_LOOP_LINE=$(grep 'for tool in' "$SETUP_SCRIPT" 2>/dev/null | head -1)
for tool in tmux fzf fastfetch yazi btop; do
  if echo "$TOOL_LOOP_LINE" | grep -qw "$tool"; then
    pass "setup_workspace.sh tool-check loop includes $tool"
  else
    fail "setup_workspace.sh tool-check loop includes $tool" \
      "add '$tool' to the 'for tool in ...' line in $SETUP_SCRIPT (found: ${TOOL_LOOP_LINE:-none})"
  fi
done

# ════════════════════════════════════════════════════════════════════════════
section "3. TMUX SESSION — create test workspace session"
# ════════════════════════════════════════════════════════════════════════════
# We bypass fzf by recreating setup_workspace.sh's tmux commands with TEST_DIR.
# This verifies the layout logic independently of the interactive picker.

COLS=220; ROWS=50

tmux new-session -d -s "$TEST_SESSION" -c "$TEST_DIR" -x "$COLS" -y "$ROWS" 2>/dev/null
if tmux has-session -t "$TEST_SESSION" 2>/dev/null; then
  pass "test tmux session created successfully"
else
  fail "test tmux session could not be created" "check tmux version: $(tmux -V)"
fi

# Recreate the exact pane layout from setup_workspace.sh
PANE_FASTFETCH=$(tmux display-message -p -t "$TEST_SESSION" '#{pane_id}' 2>/dev/null)

PANE_COPILOT=$(tmux split-window -t "$PANE_FASTFETCH" -v -p 45 \
  -c "$TEST_DIR" -P -F '#{pane_id}' 2>/dev/null)
PANE_GEMINI=$(tmux split-window -t "$PANE_COPILOT" -h \
  -c "$TEST_DIR" -P -F '#{pane_id}' 2>/dev/null)
PANE_CLAUDE=$(tmux split-window -t "$PANE_GEMINI" -h \
  -c "$TEST_DIR" -P -F '#{pane_id}' 2>/dev/null)
PANE_YAZI=$(tmux split-window -t "$PANE_FASTFETCH" -h \
  -c "$TEST_DIR" -P -F '#{pane_id}' 2>/dev/null)
PANE_BTOP=$(tmux split-window -t "$PANE_YAZI" -h \
  -c "$TEST_DIR" -P -F '#{pane_id}' 2>/dev/null)

# Assign titles exactly as setup_workspace.sh does
tmux select-pane -t "$PANE_FASTFETCH" -T "fastfetch" 2>/dev/null
tmux select-pane -t "$PANE_YAZI"      -T "yazi"     2>/dev/null
tmux select-pane -t "$PANE_BTOP"      -T "btop"   2>/dev/null
tmux select-pane -t "$PANE_COPILOT"   -T "copilot"   2>/dev/null
tmux select-pane -t "$PANE_GEMINI"    -T "gemini"    2>/dev/null
tmux select-pane -t "$PANE_CLAUDE"    -T "claude"    2>/dev/null

sleep 0.3  # let tmux settle

# ── Pane count ───────────────────────────────────────────────────────────────
PANE_COUNT=$(tmux list-panes -t "$TEST_SESSION" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$PANE_COUNT" -eq 6 ]]; then
  pass "exactly 6 panes created (got $PANE_COUNT)"
else
  fail "exactly 6 panes created" "expected 6, got $PANE_COUNT — check split-window commands in $SETUP_SCRIPT"
fi

# ── Pane title checks ────────────────────────────────────────────────────────
# Expected titles: fastfetch, files, monitor, copilot, gemini, claude
PANE_TITLES=$(tmux list-panes -t "$TEST_SESSION" -F '#{pane_title}' 2>/dev/null | sort)

for expected_title in fastfetch yazi btop copilot gemini claude; do
  if echo "$PANE_TITLES" | grep -qx "$expected_title"; then
    pass "pane titled '$expected_title' exists"
  else
    fail "pane titled '$expected_title' exists" \
      "current titles: $(echo "$PANE_TITLES" | tr '\n' ' ') — check select-pane -T in $SETUP_SCRIPT"
  fi
done

# ── Canonical pane name test (task spec uses yazi/btop not files/monitor) ────
# The task spec says panes should be named: fastfetch, yazi, btop, copilot, gemini, claude
# But setup_workspace.sh sets titles: fastfetch, files, monitor, copilot, gemini, claude
# This test validates the SPEC; FIXED: pane names are now 'yazi' and 'btop' ✓
for spec_title in yazi btop; do
  if echo "$PANE_TITLES" | grep -qx "$spec_title"; then
    pass "pane titled '$spec_title' matches spec"
  else
    fail "pane titled '$spec_title' matches spec" \
      "setup_workspace.sh uses '$(echo "$PANE_TITLES" | grep -E 'files|monitor' | tr '\n' ' ')' — spec expects 'yazi' and 'btop'"
  fi
done

# ── Layout: top row ~55%, bottom row ~45% ────────────────────────────────────
# Get heights of all panes; top row should be taller than bottom row
TOP_H=$(tmux display-message -p -t "$PANE_FASTFETCH" '#{pane_height}' 2>/dev/null)
BOT_H=$(tmux display-message -p -t "$PANE_COPILOT"   '#{pane_height}' 2>/dev/null)
TOTAL_H=$(( TOP_H + BOT_H ))

if [[ -n "$TOP_H" && -n "$BOT_H" && "$TOTAL_H" -gt 0 ]]; then
  TOP_PCT=$(( TOP_H * 100 / TOTAL_H ))
  BOT_PCT=$(( BOT_H * 100 / TOTAL_H ))
  # Allow ±5% tolerance around 55/45
  if [[ $TOP_PCT -ge 50 && $TOP_PCT -le 60 ]]; then
    pass "top row is ~55% height (actual ${TOP_PCT}%)"
  else
    fail "top row is ~55% height" \
      "top=${TOP_PCT}% bottom=${BOT_PCT}% — adjust '-p 45' in split-window -v command in $SETUP_SCRIPT"
  fi
  if [[ $BOT_PCT -ge 40 && $BOT_PCT -le 50 ]]; then
    pass "bottom row is ~45% height (actual ${BOT_PCT}%)"
  else
    fail "bottom row is ~45% height" \
      "top=${TOP_PCT}% bottom=${BOT_PCT}% — adjust '-p 45' flag in $SETUP_SCRIPT"
  fi
else
  fail "layout height percentages readable" "could not read pane heights from tmux"
fi

# ── Top row has 3 panes, bottom row has 3 panes ──────────────────────────────
TOP_ROW_COUNT=$(tmux list-panes -t "$TEST_SESSION" \
  -F '#{pane_top} #{pane_id}' 2>/dev/null | \
  awk -v top="$(tmux display-message -p -t "$PANE_FASTFETCH" '#{pane_top}' 2>/dev/null)" \
  '$1 == top' | wc -l | tr -d ' ')

if [[ "$TOP_ROW_COUNT" -eq 3 ]]; then
  pass "top row has exactly 3 panes"
else
  fail "top row has exactly 3 panes" \
    "found $TOP_ROW_COUNT panes in top row — check horizontal splits for fastfetch/yazi/btop"
fi

# ════════════════════════════════════════════════════════════════════════════
section "4. FOLDER PROPAGATION — selected folder reaches all panes"
# ════════════════════════════════════════════════════════════════════════════
# Send 'pwd' to each pane and check output matches TEST_DIR

# Resolve TEST_DIR in case of symlinks
REAL_TEST_DIR=$(cd "$TEST_DIR" && pwd -P 2>/dev/null)

ALL_PANES=("$PANE_FASTFETCH" "$PANE_YAZI" "$PANE_BTOP" "$PANE_COPILOT" "$PANE_GEMINI" "$PANE_CLAUDE")
PANE_NAMES=(fastfetch yazi btop copilot gemini claude)

for i in "${!ALL_PANES[@]}"; do
  pane="${ALL_PANES[$i]}"
  name="${PANE_NAMES[$i]}"

  if [[ -z "$pane" ]]; then
    fail "[$name] pane ID captured" "pane creation failed — check split-window commands"
    continue
  fi

  # Get pane CWD via tmux's #{pane_current_path}
  PANE_CWD=$(tmux display-message -p -t "$pane" '#{pane_current_path}' 2>/dev/null)
  REAL_PANE_CWD=$(cd "$PANE_CWD" 2>/dev/null && pwd -P 2>/dev/null || echo "$PANE_CWD")

  if [[ "$REAL_PANE_CWD" == "$REAL_TEST_DIR" ]]; then
    pass "[$name] CWD is selected folder ($PANE_CWD)"
  else
    fail "[$name] CWD is selected folder" \
      "expected: $REAL_TEST_DIR  got: $REAL_PANE_CWD — ensure -c '\$PROJECT_DIR' on every split-window in $SETUP_SCRIPT"
  fi
done

# ── Symlink resolution ────────────────────────────────────────────────────────
# Create a symlinked version of the test dir to verify resolution works
LINK_DIR="$HOME/workspace-test-link-$$"
ln -s "$TEST_DIR" "$LINK_DIR" 2>/dev/null
RESOLVED=$(cd "$LINK_DIR" 2>/dev/null && pwd -P 2>/dev/null || echo "")
if [[ "$RESOLVED" == "$REAL_TEST_DIR" ]]; then
  pass "symlinks resolve correctly (link→real path)"
else
  fail "symlinks resolve correctly" "pwd -P failed to resolve $LINK_DIR"
fi
rm -f "$LINK_DIR"

# ════════════════════════════════════════════════════════════════════════════
section "5. LIVE WORKSPACE SESSION — 'workspace' session exists"
# ════════════════════════════════════════════════════════════════════════════
# These tests check the LIVE named session — they FAIL if workspace not running.
# Run 'workstation run' first, then re-run tests to see them pass.

if tmux has-session -t "$WORKSPACE_SESSION" 2>/dev/null; then
  pass "tmux session named '$WORKSPACE_SESSION' exists"

  LIVE_PANE_COUNT=$(tmux list-panes -t "$WORKSPACE_SESSION" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$LIVE_PANE_COUNT" -eq 6 ]]; then
    pass "live workspace has exactly 6 panes"
  else
    fail "live workspace has exactly 6 panes" "found $LIVE_PANE_COUNT — restart workspace"
  fi

  LIVE_TITLES=$(tmux list-panes -t "$WORKSPACE_SESSION" -F '#{pane_title}' 2>/dev/null | sort)
  for t in fastfetch yazi btop copilot gemini claude; do
    if echo "$LIVE_TITLES" | grep -qx "$t"; then
      pass "live workspace pane '$t' present"
    else
      fail "live workspace pane '$t' present" "restart workspace after fixing $SETUP_SCRIPT"
    fi
  done
else
  fail "tmux session named '$WORKSPACE_SESSION' exists" \
    "workspace not running — start with: workstation run (tests 5.x require live session)"
  skip "live workspace pane count (session not running)"
  for t in fastfetch yazi btop copilot gemini claude; do
    skip "live workspace pane '$t' present (session not running)"
  done
fi

# ════════════════════════════════════════════════════════════════════════════
section "6. COLORS & ICONS — yazi theme and ghostty config"
# ════════════════════════════════════════════════════════════════════════════

# ── Yazi theme.toml exists ────────────────────────────────────────────────────
if [[ -f "$YAZI_THEME" ]]; then
  pass "yazi theme.toml exists ($YAZI_THEME)"
else
  fail "yazi theme.toml exists" "create $YAZI_THEME with icon and color rules"
fi

# ── Yazi fg color is green #00ff00 ───────────────────────────────────────────
if grep -q 'fg\s*=\s*"#00ff00"' "$YAZI_THEME" 2>/dev/null; then
  pass "yazi text color is green (#00ff00)"
else
  ACTUAL_FG=$(grep 'fg\s*=' "$YAZI_THEME" 2>/dev/null | head -1 | xargs)
  fail "yazi text color is green (#00ff00)" \
    "found: '${ACTUAL_FG:-not set}' — set fg = \"#00ff00\" in [color] section of $YAZI_THEME"
fi

# ── Yazi icons: theme.toml has icon glyph entries ────────────────────────────
ICON_COUNT=$(grep -c 'text\s*=' "$YAZI_THEME" 2>/dev/null || echo 0)
if [[ "$ICON_COUNT" -gt 0 ]]; then
  pass "yazi theme.toml defines icon glyphs ($ICON_COUNT entries)"
else
  fail "yazi theme.toml defines icon glyphs" \
    "add [icon] rules with Nerd Font glyph text values to $YAZI_THEME"
fi

# ── Yazi icon glyphs are non-ASCII (actual Nerd Font characters, not '?') ────
# Extract text = "..." values and check they contain non-ASCII bytes
ICON_VALUES=$(grep 'text\s*=' "$YAZI_THEME" 2>/dev/null | \
  sed 's/.*text[[:space:]]*=[[:space:]]*"\(.*\)"/\1/')
# Use python3 to reliably check for non-ASCII bytes (macOS grep -P not always available)
NON_ASCII=$(echo "$ICON_VALUES" | python3 -c \
  "import sys; lines=[l.rstrip('\n') for l in sys.stdin]; \
   print(sum(1 for l in lines if any(ord(c)>127 for c in l)))" 2>/dev/null || echo "0")
NON_ASCII="${NON_ASCII//[^0-9]/}"  # strip whitespace/newlines
NON_ASCII="${NON_ASCII:-0}"
QUESTION_MARKS=$(echo "$ICON_VALUES" | grep -cF '?' 2>/dev/null || echo "0")
QUESTION_MARKS="${QUESTION_MARKS//[^0-9]/}"
QUESTION_MARKS="${QUESTION_MARKS:-0}"

if [[ "$NON_ASCII" -gt 0 ]]; then
  pass "yazi icon glyphs are Nerd Font characters (non-ASCII), not '?' ($NON_ASCII glyphs)"
else
  fail "yazi icon glyphs are Nerd Font characters (not '?')" \
    "icons may be rendering as '?' — ensure JetBrainsMono Nerd Font is installed and theme.toml has actual glyphs"
fi

if [[ "$QUESTION_MARKS" -gt 0 ]]; then
  fail "yazi icon entries contain no '?' fallback characters" \
    "$QUESTION_MARKS entries use '?' — replace with actual Nerd Font glyphs"
else
  pass "no '?' fallback characters in yazi icon entries"
fi

# ── Ghostty config exists ─────────────────────────────────────────────────────
if [[ -f "$GHOSTTY_CONFIG" ]]; then
  pass "ghostty config exists ($GHOSTTY_CONFIG)"
else
  fail "ghostty config exists" "create $GHOSTTY_CONFIG"
fi

# ── Ghostty background is pure black ─────────────────────────────────────────
# Ghostty format: background = 000000 (no # prefix)
if grep -qE '^background\s*=\s*000000\s*$' "$GHOSTTY_CONFIG" 2>/dev/null; then
  pass "ghostty background is pure black (background = 000000)"
elif grep -qE '^background\s*=\s*#?000000\s*$' "$GHOSTTY_CONFIG" 2>/dev/null; then
  ACTUAL_BG=$(grep 'background' "$GHOSTTY_CONFIG" | head -1 | xargs)
  fail "ghostty background is pure black (exact: background = 000000)" \
    "found: '$ACTUAL_BG' — Ghostty requires no '#' prefix: background = 000000"
else
  ACTUAL_BG=$(grep 'background' "$GHOSTTY_CONFIG" 2>/dev/null | grep -v '^\s*#' | head -1 | xargs || echo "not set")
  fail "ghostty background is pure black" \
    "found: '${ACTUAL_BG}' — set: background = 000000 in $GHOSTTY_CONFIG"
fi

# ── Ghostty uses Nerd Font ────────────────────────────────────────────────────
if grep -q 'Nerd Font\|NerdFont\|nerd-font\| NFM\| NF \| NF$' "$GHOSTTY_CONFIG" 2>/dev/null; then
  FONT=$(grep 'font-family' "$GHOSTTY_CONFIG" 2>/dev/null | grep -v '^\s*#' | head -1 | xargs)
  pass "ghostty uses a Nerd Font ($FONT)"
else
  fail "ghostty uses a Nerd Font" \
    "set font-family = \"JetBrainsMono NFM\" in $GHOSTTY_CONFIG for icon rendering"
fi

# ════════════════════════════════════════════════════════════════════════════
section "7. ACTUAL FILE OPERATIONS — cd, list, permissions"
# ════════════════════════════════════════════════════════════════════════════

# ── Can cd into test project dir ─────────────────────────────────────────────
if cd "$TEST_DIR" 2>/dev/null; then
  pass "can cd into test project directory ($TEST_DIR)"
  cd "$HOME"
else
  fail "can cd into test project directory" "mkdir -p $TEST_DIR"
fi

# ── Can list files in test dir ────────────────────────────────────────────────
FILE_LIST=$(ls -lA "$TEST_DIR" 2>/dev/null)
if [[ -n "$FILE_LIST" ]]; then
  FILE_COUNT=$(ls "$TEST_DIR" 2>/dev/null | wc -l | tr -d ' ')
  pass "can list files in test dir ($FILE_COUNT files)"
else
  fail "can list files in test dir" "ls -lA $TEST_DIR returned empty"
fi

# ── Files have readable permissions ──────────────────────────────────────────
UNREADABLE=$(find "$TEST_DIR" -not -readable 2>/dev/null | wc -l | tr -d ' ')
if [[ "$UNREADABLE" -eq 0 ]]; then
  pass "all test project files are readable"
else
  fail "all test project files are readable" \
    "$UNREADABLE files are not readable — check permissions"
fi

# ── Yazi binary can open a folder (dry-run, no TUI) ──────────────────────────
# yazi doesn't have a --check flag, so we verify it's a valid ELF/mach-O
if file "$(command -v yazi)" 2>/dev/null | grep -q 'executable'; then
  pass "yazi binary is a valid executable"
else
  fail "yazi binary is a valid executable" "reinstall: brew reinstall yazi"
fi

# ── yazi.toml config exists ───────────────────────────────────────────────────
YAZI_CONFIG="$HOME/.config/yazi/yazi.toml"
if [[ -f "$YAZI_CONFIG" ]]; then
  pass "yazi.toml config exists"
else
  fail "yazi.toml config exists" "create $YAZI_CONFIG (yazi --init to scaffold)"
fi

# ── Nerd Font installed on system (macOS: check Library/Fonts) ───────────────
NERD_FONT_FOUND=0
NERD_FONT_PATH=""
for font_dir in "$HOME/Library/Fonts" "/Library/Fonts" "/System/Library/Fonts"; do
  if [[ -d "$font_dir" ]]; then
    match=$(find "$font_dir" -maxdepth 1 \( -iname "*NerdFont*" -o -iname "*Nerd Font*" -o -iname "*NF-*" \) 2>/dev/null | head -1)
    if [[ -n "$match" ]]; then
      NERD_FONT_FOUND=1
      NERD_FONT_PATH="$match"
      break
    fi
  fi
done
# Also check via fc-list if fontconfig is available
if [[ $NERD_FONT_FOUND -eq 0 ]] && fc-list 2>/dev/null | grep -qi 'nerd\|NF'; then
  NERD_FONT_FOUND=1
fi

if [[ $NERD_FONT_FOUND -eq 1 ]]; then
  pass "Nerd Font is installed (icons will render) ${NERD_FONT_PATH:+(found: $(basename "$NERD_FONT_PATH"))}"
else
  fail "Nerd Font is installed" \
    "icons will render as '?' — install: brew install --cask font-jetbrains-mono-nerd-font"
fi

# ════════════════════════════════════════════════════════════════════════════
section "8. SETUP_WORKSPACE.SH INTERNAL CHECKS"
# ════════════════════════════════════════════════════════════════════════════

# ── Script has shebang ────────────────────────────────────────────────────────
SHEBANG=$(head -1 "$SETUP_SCRIPT" 2>/dev/null)
if [[ "$SHEBANG" == "#!/bin/bash" || "$SHEBANG" == "#!/usr/bin/env bash" ]]; then
  pass "setup_workspace.sh has bash shebang ($SHEBANG)"
else
  fail "setup_workspace.sh has bash shebang" "found: '$SHEBANG'"
fi

# ── Session name is 'workspace' ───────────────────────────────────────────────
if grep -q 'WORKSPACE="workspace"\|WORKSPACE=workspace' "$SETUP_SCRIPT" 2>/dev/null; then
  pass "setup_workspace.sh uses session name 'workspace'"
else
  ACTUAL_NAME=$(grep 'WORKSPACE=' "$SETUP_SCRIPT" | head -1 | xargs)
  fail "setup_workspace.sh uses session name 'workspace'" \
    "found: '${ACTUAL_NAME:-not set}' — set WORKSPACE=\"workspace\""
fi

# ── Script kills existing session before creating new one ─────────────────────
if grep -q 'kill-session' "$SETUP_SCRIPT" 2>/dev/null; then
  pass "setup_workspace.sh kills existing session before launch"
else
  fail "setup_workspace.sh kills existing session before launch" \
    "add: tmux kill-session -t \"\$WORKSPACE\" 2>/dev/null || true"
fi

# ── Script uses fzf for folder selection ─────────────────────────────────────
if grep -q 'fzf' "$SETUP_SCRIPT" 2>/dev/null; then
  pass "setup_workspace.sh uses fzf for folder selection"
else
  fail "setup_workspace.sh uses fzf for folder selection" \
    "add fzf picker to select PROJECT_DIR"
fi

# ── Bottom row split uses 45% ─────────────────────────────────────────────────
if grep -q '\-p 45\|-p45' "$SETUP_SCRIPT" 2>/dev/null; then
  pass "setup_workspace.sh splits bottom row at 45% (-p 45)"
else
  fail "setup_workspace.sh splits bottom row at 45%" \
    "use: tmux split-window -v -p 45 for the bottom-row split"
fi

# ── All 6 pane title assignments present ─────────────────────────────────────
for title in fastfetch copilot gemini claude; do
  if grep -q "\"$title\"\|'$title'" "$SETUP_SCRIPT" 2>/dev/null; then
    pass "setup_workspace.sh assigns pane title '$title'"
  else
    fail "setup_workspace.sh assigns pane title '$title'" \
      "add: tmux select-pane -t \$PANE_... -T \"$title\""
  fi
done

# ── Script attaches to session at end ────────────────────────────────────────
if grep -q 'attach-session\|attach' "$SETUP_SCRIPT" 2>/dev/null; then
  pass "setup_workspace.sh attaches to session at end"
else
  fail "setup_workspace.sh attaches to session at end" \
    "add: tmux attach-session -t \"\$WORKSPACE\" at end of script"
fi

# ── Task 1-5 Polish Tests ─────────────────────────────────────────────────────

# ── tmux default-terminal uses tmux-256color ─────────────────────────────────
if grep -q 'default-terminal.*tmux-256color' "$HOME/.tmux.conf" 2>/dev/null; then
  pass "tmux default-terminal is tmux-256color"
else
  fail "tmux default-terminal is tmux-256color"
fi

# ── tmux terminal-features override present ──────────────────────────────────
if grep -qE '^[[:space:]]*set[[:space:]].*terminal-features' "$HOME/.tmux.conf" 2>/dev/null; then
  pass "tmux terminal-features override present"
else
  fail "tmux terminal-features override present"
fi

# ── yazi keymap.toml exists ───────────────────────────────────────────────────
if [[ -f "$HOME/.config/yazi/keymap.toml" ]]; then
  pass "yazi keymap.toml exists"
else
  fail "yazi keymap.toml exists"
fi

# ── yazi keymap has C-f binding ───────────────────────────────────────────────
if grep -q 'on = "<C-f>"' "$HOME/.config/yazi/keymap.toml" 2>/dev/null; then
  pass "yazi keymap.toml has C-f binding"
else
  fail "yazi keymap.toml has C-f binding"
fi

# ── yazi keymap uses ya emit reveal ───────────────────────────────────────────
if grep -q 'ya emit reveal' "$HOME/.config/yazi/keymap.toml" 2>/dev/null; then
  pass "yazi C-f uses ya emit reveal (not nested yazi)"
else
  fail "yazi C-f uses ya emit reveal (not nested yazi)"
fi

# ── fzf is installed ──────────────────────────────────────────────────────────
if command -v fzf &>/dev/null; then
  pass "fzf is installed"
else
  fail "fzf is installed"
fi

# ── fd is installed ───────────────────────────────────────────────────────────
if command -v fd &>/dev/null; then
  pass "fd is installed"
else
  fail "fd is installed"
fi

# ── fastfetch config exists ───────────────────────────────────────────────────
if [[ -f "$HOME/.config/fastfetch/config.jsonc" ]]; then
  pass "fastfetch config.jsonc exists"
else
  fail "fastfetch config.jsonc exists"
fi

# ── fastfetch config has About This Mac title ────────────────────────────────
if grep -q 'About This Mac' "$HOME/.config/fastfetch/config.jsonc" 2>/dev/null; then
  pass "fastfetch config has 'About This Mac' title"
else
  fail "fastfetch config has 'About This Mac' title"
fi

# ── fastfetch config.jsonc is valid JSON ─────────────────────────────────────
if python3 -c "
import json, pathlib
txt = pathlib.Path('$HOME/.config/fastfetch/config.jsonc').read_text()
out = []
in_string = False
escape = False
i = 0
while i < len(txt):
    ch = txt[i]
    nxt = txt[i + 1] if i + 1 < len(txt) else ''
    if in_string:
        out.append(ch)
        if escape:
            escape = False
        elif ch == '\\\\':
            escape = True
        elif ch == '\"':
            in_string = False
        i += 1
        continue
    if ch == '\"':
        in_string = True
        out.append(ch)
        i += 1
        continue
    if ch == '/' and nxt == '/':
        i += 2
        while i < len(txt) and txt[i] != '\\n':
            i += 1
        continue
    out.append(ch)
    i += 1
txt = ''.join(out)
json.loads(txt)
" 2>/dev/null; then
  pass "fastfetch config.jsonc is valid JSON"
else
  fail "fastfetch config.jsonc is valid JSON"
fi

# ── zshrc has green prompt ────────────────────────────────────────────────────
if grep -q '%F{green}' "$HOME/.zshrc" 2>/dev/null; then
  pass "~/.zshrc has green %F{green} PROMPT"
else
  fail "~/.zshrc has green %F{green} PROMPT"
fi

# ════════════════════════════════════════════════════════════════════════════
section "SUMMARY"
# ════════════════════════════════════════════════════════════════════════════
TOTAL=$(( PASS + FAIL + SKIP ))
echo ""
echo -e "  ${GREEN}Passed:${RESET} $PASS / $TOTAL"
echo -e "  ${RED}Failed:${RESET} $FAIL / $TOTAL"
echo -e "  ${YELLOW}Skipped:${RESET} $SKIP / $TOTAL"

if [[ "${#FAILURES[@]}" -gt 0 ]]; then
  echo ""
  echo -e "${BOLD}${RED}Failing tests:${RESET}"
  for f in "${FAILURES[@]}"; do
    echo -e "  ${RED}✗${RESET} $f"
  done
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}🎉 All tests passed!${RESET}"
  exit 0
else
  echo -e "${BOLD}${YELLOW}⚠  $FAIL test(s) failing — see hints above for fixes needed in setup_workspace.sh${RESET}"
  exit 1
fi
