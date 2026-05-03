#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# SETUP_WORKSPACE.SH — 7-Pane AI Terminal Workspace Launcher
# ═══════════════════════════════════════════════════════════════════
# TOP ROW  (55%): fastfetch | yazi | btop
# BOTTOM ROW (45%): copilot | gemini | claude (blank AI shells)

WORKSPACE="workspace"

# ── 1. Check required tools ──────────────────────────────────────
for tool in tmux fzf fastfetch yazi lazygit btop; do
  if ! command -v "$tool" &>/dev/null; then
    echo "❌ Missing tool: $tool. Run: brew install $tool"
    exit 1
  fi
done

# ── 2. fzf project folder picker ────────────────────────────────
_dirs=""
for base in "$HOME/Documents" "$HOME/Desktop" "$HOME/Downloads" \
            "$HOME/doomsday-cli" "$HOME/doomsday-web" "$HOME/doomsday-native" \
            "$HOME/chatbot_local" "$HOME/Chat Files"; do
  if [ -d "$base" ]; then
    _dirs="$_dirs"$'\n'"$base"
    _dirs="$_dirs"$'\n'"$(find "$base" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | sort)"
  fi
done
_dirs="$_dirs"$'\n'"$HOME"
_dirs=$(echo "$_dirs" | sed '/^$/d' | sort -u)

PROJECT_DIR=$(echo "$_dirs" | fzf \
  --prompt="📁 Select project folder: " \
  --height=50% \
  --border=rounded \
  --preview='ls -lA {} 2>/dev/null | head -20' \
  --preview-window=right:45% \
  --header="↑↓ navigate  Enter select  Ctrl-C cancel")

if [ -z "$PROJECT_DIR" ]; then
  echo "No folder selected. Workspace not started."
  exit 0
fi

echo "🚀 Starting workspace in: $PROJECT_DIR"

# ── 3. Kill any existing workspace session ───────────────────────
tmux kill-session -t "$WORKSPACE" 2>/dev/null || true
sleep 0.2

# ── 4. Create session (detached) — first pane = fastfetch ────────
COLS=$(tput cols 2>/dev/null || echo 220)
ROWS=$(tput lines 2>/dev/null || echo 50)
tmux new-session -d -s "$WORKSPACE" -c "$PROJECT_DIR" -x "$COLS" -y "$ROWS"

# Capture pane IDs with -P -F to guarantee correct tracking
PANE_FASTFETCH=$(tmux display-message -p -t "$WORKSPACE" '#{pane_id}')

# ── 5. BOTTOM ROW: vertical split from fastfetch (45% height) ────
PANE_COPILOT=$(tmux split-window -t "$PANE_FASTFETCH" -v -p 45 \
  -c "$PROJECT_DIR" -P -F '#{pane_id}')
PANE_GEMINI=$(tmux split-window -t "$PANE_COPILOT" -h \
  -c "$PROJECT_DIR" -P -F '#{pane_id}')
PANE_CLAUDE=$(tmux split-window -t "$PANE_GEMINI" -h \
  -c "$PROJECT_DIR" -P -F '#{pane_id}')

# ── 6. TOP ROW: horizontal splits from fastfetch ─────────────────
PANE_YAZI=$(tmux split-window -t "$PANE_FASTFETCH" -h \
  -c "$PROJECT_DIR" -P -F '#{pane_id}')
PANE_BTOP=$(tmux split-window -t "$PANE_YAZI" -h \
  -c "$PROJECT_DIR" -P -F '#{pane_id}')

# ── 7. Assign pane border titles ─────────────────────────────────
tmux select-pane -t "$PANE_FASTFETCH" -T "fastfetch"
tmux select-pane -t "$PANE_YAZI"      -T "yazi"
tmux select-pane -t "$PANE_BTOP"      -T "btop"
tmux select-pane -t "$PANE_COPILOT"   -T "copilot"
tmux select-pane -t "$PANE_GEMINI"    -T "gemini"
tmux select-pane -t "$PANE_CLAUDE"    -T "claude"

# ── 8. Launch tools in top row ────────────────────────────────────
tmux send-keys -t "$PANE_FASTFETCH" "cd '$PROJECT_DIR' && fastfetch --config \"$HOME/.config/fastfetch/config.jsonc\"; exec zsh" Enter
tmux send-keys -t "$PANE_YAZI"      "cd '$PROJECT_DIR' && yazi ." Enter
tmux send-keys -t "$PANE_BTOP"      "cd '$PROJECT_DIR' && btop" Enter

# ── 9. CD into project for AI shell panes (blank — user runs CLIs) ──
tmux send-keys -t "$PANE_COPILOT" "cd '$PROJECT_DIR'" Enter
tmux send-keys -t "$PANE_GEMINI"  "cd '$PROJECT_DIR'" Enter
tmux send-keys -t "$PANE_CLAUDE"  "cd '$PROJECT_DIR'" Enter

# ── 10. Focus copilot shell (bottom-left) ────────────────────────
tmux select-pane -t "$PANE_COPILOT"

# ── 11. Attach ───────────────────────────────────────────────────
tmux attach-session -t "$WORKSPACE"
