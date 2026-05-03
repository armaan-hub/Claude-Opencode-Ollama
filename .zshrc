
. "$HOME/.local/bin/env"

# ── TERMINAL COLOR CAPABILITIES ────────────────────────────────────────────
# Set proper terminal capabilities for colors and special features
export TERM=xterm-256color
export COLORTERM=truecolor

# ── UTILITY SHORTCUTS FOR WORKSPACE ────────────────────────────────────────
# Add workspace utilities to PATH
export PATH="$HOME:$PATH"

# Helper functions for quick access
alias workspace-config="$HOME/workspace-config.sh"
alias font-size="$HOME/terminal-font-size.sh"
alias terminal-font-size="$HOME/terminal-font-size.sh"

# Enable verbose mode
alias debug='source ~/.terminal-env && echo "🔍 Debug mode: ON"'

# Green PS1 prompt inside AI workspace tmux session
# NOTE: This must remain AFTER any prompt framework (starship, oh-my-zsh, etc.)
if [[ -n "$TMUX" ]]; then
  _ws=$(tmux display-message -p '#S' 2>/dev/null)
  if [[ "$_ws" == (workspace|AI-Workspace) ]]; then
    PROMPT='%F{green}[%m]%f %F{green}%~%f %F{green}❯%f '
    RPROMPT=''
  fi
  unset _ws
fi

# ── AI WORKSPACE AUTO-LAUNCH ──────────────────────────────────────────────────
# When opening Ghostty (not already in tmux), launch the full workspace
if [[ "$TERM_PROGRAM" == "ghostty" ]] && [[ -z "$TMUX" ]] && [[ $- == *i* ]]; then
  exec /Users/armaan/setup_workspace.sh
fi
# ─────────────────────────────────────────────────────────────────────────────

# ═══════════════════════════════════════════════════════════════════════════
# CLI DIRECTORY CONTEXT AWARENESS
# Automatically detects project context and passes CWD to CLI tools
# ═══════════════════════════════════════════════════════════════════════════

# Detect project root by looking for common markers
_detect_project_root() {
    local current_dir="$1"
    local markers=(".git" "package.json" "pyproject.toml" ".claude.json" "README.md" "Makefile" ".copilot-setup-steps.yml")
    
    while [[ "$current_dir" != "/" ]]; do
        for marker in "${markers[@]}"; do
            if [[ -e "$current_dir/$marker" ]]; then
                echo "$current_dir"
                return 0
            fi
        done
        current_dir=$(dirname "$current_dir")
    done
    
    # Fallback to current directory if no marker found
    echo "$(pwd)"
}

# Export environment variables for current session
_export_cli_context() {
    export CLI_CWD="$(pwd)"
    export CLI_PROJECT_ROOT="$(_detect_project_root "$(pwd)")"
    export CLI_GIT_ROOT=""
    [[ -d "$CLI_PROJECT_ROOT/.git" ]] && export CLI_GIT_ROOT="$CLI_PROJECT_ROOT"
}

# ─── Claude CLI ────────────────────────────────────────────────────────────
# Wrapper function: auto-detect CWD and project root
claude() {
    _export_cli_context
    command claude "$@"
}

# ─── Copilot CLI ───────────────────────────────────────────────────────────
# Wrapper function: auto-detect CWD and project root
copilot() {
    _export_cli_context
    command copilot "$@"
}

# ─── Gemini CLI ────────────────────────────────────────────────────────────
# Wrapper function: auto-detect CWD and project root
gemini() {
    _export_cli_context
    command gemini "$@"
}

# Optional: Convenience function to show current CLI context
cli-info() {
    _export_cli_context
    echo "╭─ CLI Context Information ──────────────────────────────────────╮"
    echo "│ Current Working Directory : $CLI_CWD"
    echo "│ Detected Project Root     : $CLI_PROJECT_ROOT"
    echo "│ Git Root                  : ${CLI_GIT_ROOT:-"(none detected)"}"
    echo "│ PWD Environment Variable  : $PWD"
    echo "╰────────────────────────────────────────────────────────────────╯"
}

# ═══════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════
# CLI DIRECTORY CONTEXT AWARENESS
# Automatically detects project context and passes CWD to CLI tools
# ═══════════════════════════════════════════════════════════════════════════

# Detect project root by looking for common markers
_detect_project_root() {
    local current_dir="$1"
    local markers=(".git" "package.json" "pyproject.toml" ".claude.json" "README.md" "Makefile" ".copilot-setup-steps.yml")
    
    while [[ "$current_dir" != "/" ]]; do
        for marker in "${markers[@]}"; do
            if [[ -e "$current_dir/$marker" ]]; then
                echo "$current_dir"
                return 0
            fi
        done
        current_dir=$(dirname "$current_dir")
    done
    
    # Fallback to current directory if no marker found
    echo "$(pwd)"
}

# Export environment variables for current session
_export_cli_context() {
    export CLI_CWD="$(pwd)"
    export CLI_PROJECT_ROOT="$(_detect_project_root "$(pwd)")"
    export CLI_GIT_ROOT=""
    [[ -d "$CLI_PROJECT_ROOT/.git" ]] && export CLI_GIT_ROOT="$CLI_PROJECT_ROOT"
}

# ─── Claude CLI ────────────────────────────────────────────────────────────
# Wrapper function: auto-detect CWD and project root
claude() {
    _export_cli_context
    command claude "$@"
}

# ─── Copilot CLI ───────────────────────────────────────────────────────────
# Wrapper function: auto-detect CWD and project root
copilot() {
    _export_cli_context
    command copilot "$@"
}

# ─── Gemini CLI ────────────────────────────────────────────────────────────
# Wrapper function: auto-detect CWD and project root
gemini() {
    _export_cli_context
    command gemini "$@"
}

# Optional: Convenience function to show current CLI context
cli-info() {
    _export_cli_context
    echo "╭─ CLI Context Information ──────────────────────────────────────╮"
    echo "│ Current Working Directory : $CLI_CWD"
    echo "│ Detected Project Root     : $CLI_PROJECT_ROOT"
    echo "│ Git Root                  : ${CLI_GIT_ROOT:-"(none detected)"}"
    echo "│ PWD Environment Variable  : $PWD"
    echo "╰────────────────────────────────────────────────────────────────╯"
}

# ═══════════════════════════════════════════════════════════════════════════

# Workstation command
alias workstation="~/workstation"

# File Organization System
export CHAT_FILES_PATH="/Users/armaan/Chat Files"

# Function: Save file to Chat Files
function save_to_chat_files() {
  local file=$1
  local subdir=${2:-documentation}

  if [ -f "$file" ]; then
    mv "$file" "$CHAT_FILES_PATH/$subdir/"
    echo "✓ Saved: $CHAT_FILES_PATH/$subdir/$(basename $file)"
  fi
}

# Alias for quick access
alias chat-files='cd "$CHAT_FILES_PATH"'
alias chat-summaries='cd "$CHAT_FILES_PATH/summaries"'
