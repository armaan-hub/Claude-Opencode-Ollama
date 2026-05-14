# If you come from bash you might have to change your $PATH.
export PATH=$HOME/bin:$HOME/.local/bin:/usr/local/bin:$PATH

# Path to your Oh My Zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Set name of the theme to load --- if set to "random", it will
# load a random theme each time Oh My Zsh is loaded, in which case,
# to know which specific one was loaded, run: echo $RANDOM_THEME
# See https://github.com/ohmyzsh/ohmyzsh/wiki/Themes
ZSH_THEME="robbyrussell"

# Set list of themes to pick from when loading at random
# Setting this variable when ZSH_THEME=random will cause zsh to load
# a theme from this variable instead of looking in $ZSH/themes/
# If set to an empty array, this variable will have no effect.
# ZSH_THEME_RANDOM_CANDIDATES=( "robbyrussell" "agnoster" )

# Uncomment the following line to use case-sensitive completion.
# CASE_SENSITIVE="true"

# Uncomment the following line to use hyphen-insensitive completion.
# Case-sensitive completion must be off. _ and - will be interchangeable.
# HYPHEN_INSENSITIVE="true"

# Uncomment one of the following lines to change the auto-update behavior
# zstyle ':omz:update' mode disabled  # disable automatic updates
# zstyle ':omz:update' mode auto      # update automatically without asking
# zstyle ':omz:update' mode reminder  # just remind me to update when it's time

# Uncomment the following line to change how often to auto-update (in days).
# zstyle ':omz:update' frequency 13

# Uncomment the following line if pasting URLs and other text is messed up.
# DISABLE_MAGIC_FUNCTIONS="true"

# Uncomment the following line to disable colors in ls.
# DISABLE_LS_COLORS="true"

# Uncomment the following line to disable auto-setting terminal title.
# DISABLE_AUTO_TITLE="true"

# Uncomment the following line to enable command auto-correction.
# ENABLE_CORRECTION="true"

# Uncomment the following line to display red dots whilst waiting for completion.
# You can also set it to another string to have that shown instead of the default red dots.
# e.g. COMPLETION_WAITING_DOTS="%F{yellow}waiting...%f"
# Caution: this setting can cause issues with multiline prompts in zsh < 5.7.1 (see #5765)
# COMPLETION_WAITING_DOTS="true"

# Uncomment the following line if you want to disable marking untracked files
# under VCS as dirty. This makes repository status check for large repositories
# much, much faster.
# DISABLE_UNTRACKED_FILES_DIRTY="true"

# Uncomment the following line if you want to change the command execution time
# stamp shown in the history command output.
# You can set one of the optional three formats:
# "mm/dd/yyyy"|"dd.mm.yyyy"|"yyyy-mm-dd"
# or set a custom format using the strftime function format specifications,
# see 'man strftime' for details.
# HIST_STAMPS="mm/dd/yyyy"

# Would you like to use another custom folder than $ZSH/custom?
# ZSH_CUSTOM=/path/to/new-custom-folder

# Which plugins would you like to load?
# Standard plugins can be found in $ZSH/plugins/
# Custom plugins may be added to $ZSH_CUSTOM/plugins/
# Example format: plugins=(rails git textmate ruby lighthouse)
# Add wisely, as too many plugins slow down shell startup.
plugins=(git)

source $ZSH/oh-my-zsh.sh

# User configuration

# export MANPATH="/usr/local/man:$MANPATH"

# You may need to manually set your language environment
# export LANG=en_US.UTF-8

# Preferred editor for local and remote sessions
# if [[ -n $SSH_CONNECTION ]]; then
#   export EDITOR='vim'
# else
#   export EDITOR='nvim'
# fi

# Compilation flags
# export ARCHFLAGS="-arch $(uname -m)"

# Set personal aliases, overriding those provided by Oh My Zsh libs,
# plugins, and themes. Aliases can be placed here, though Oh My Zsh
# users are encouraged to define aliases within a top-level file in
# the $ZSH_CUSTOM folder, with .zsh extension. Examples:
# - $ZSH_CUSTOM/aliases.zsh
# - $ZSH_CUSTOM/macos.zsh
# For a full list of active aliases, run `alias`.
#
# Example aliases
# alias zshconfig="mate ~/.zshrc"
# alias ohmyzsh="mate ~/.oh-my-zsh"
alias python='python3'
alias pip='pip3'


# Added by LM Studio CLI tool (lms)
export PATH="$PATH:/Users/armaan/.lmstudio/bin"
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# bun completions
[ -s "/Users/armaan/.bun/_bun" ] && source "/Users/armaan/.bun/_bun"

# opencode
export PATH=/Users/armaan/.opencode/bin:$PATH

# LiteLLM proxy for Claude Code (OpenCode Go models)
export ANTHROPIC_API_KEY="sk-claude-code"
export ANTHROPIC_BASE_URL="http://localhost:4000"

# run-claude-opencode — pick mode + model, launch Claude Code
# Usage: run-claude-opencode
#   Step 1: pick  normal (trust prompt) or full (no prompts)
#   Step 2: pick  any OpenCode / Zen-free / Ollama model
run-claude-opencode() {
  local PROXY="http://127.0.0.1:4001"
  # ── Step 1: mode ──────────────────────────────────────────────
  local mode
  mode=$(printf '%s\n' \
    "normal  →  Safe mode (shows trust prompt)" \
    "full    →  Full permissions (no prompts)" \
    | fzf --prompt="⚡ Mode > " --height=6 --border --reverse \
          --header="↑↓ navigate  Enter select  Esc cancel" \
    | awk '{print $1}')
  [[ -z "$mode" ]] && return 0

  # ── Step 2: model ─────────────────────────────────────────────
  local model
  local _model_list
  _model_list=$(curl -s --max-time 5 "$PROXY/v1/models" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for m in data.get('data', []):
        mid = m.get('id', '')
        if mid:
            print(mid)
except (json.JSONDecodeError, KeyError, TypeError, ValueError):
    pass
" 2>/dev/null)
  if [[ -z "$_model_list" ]]; then
    echo "⚠️  Could not reach proxy at $PROXY"
    echo "   Start it with: node ~/opencode-proxy-server.js &"
    return 1
  fi
  model=$(echo "$_model_list" \
    | fzf --prompt="🤖 Model > " --height=30 --border --reverse \
          --header="↑↓ navigate  Enter select  Esc cancel")
  [[ -z "$model" ]] && return 0

  # ── Step 2b: GitHub Copilot auth check ────────────────────────
  if [[ "$model" == copilot/* ]]; then
    local copilot_token
    copilot_token=$(gh auth token 2>/dev/null)
    if [[ -z "$copilot_token" ]]; then
      echo ""
      echo "⚠️  GitHub Copilot requires authentication."
      echo "   You are not logged in to GitHub."
      echo ""
      echo "   Fix: run  gh auth login  in a terminal, then try again."
      return 1
    fi
    echo "🐙 GitHub Copilot: authenticated ✅ ($(gh auth whoami 2>/dev/null || echo 'logged in'))"
  fi

  if [[ "$model" == gemini/* ]]; then
    local gemini_key
    gemini_key=$(curl -s --max-time 5 --retry 2 --retry-delay 1 "$PROXY/api/providers" 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); p=[x for x in d['providers'] if x['id']=='gemini'][0]; print('ok' if p['connected'] else '')" 2>/dev/null)
    if [[ -z "$gemini_key" ]]; then
      echo ""
      echo "⚠️  Google Gemini requires an API key."
      echo "   Connect it at: $PROXY/providers"
      return 1
    fi
  fi

  if [[ "$model" == openai/* ]]; then
    local openai_key
    openai_key=$(curl -s --max-time 5 --retry 2 --retry-delay 1 "$PROXY/api/providers" 2>/dev/null \
      | python3 -c "import sys,json; d=json.load(sys.stdin); p=[x for x in d['providers'] if x['id']=='openai'][0]; print('ok' if p['connected'] else '')" 2>/dev/null)
    if [[ -z "$openai_key" ]]; then
      echo ""
      echo "⚠️  OpenAI requires an API key."
      echo "   Connect it at: $PROXY/providers"
      return 1
    fi
  fi

  # ── Step 3: launch ────────────────────────────────────────────
  echo "🚀 Launching Claude Code [$mode] → $model"
  mkdir -p "$HOME/.claude"
  printf '%s\n' "$model" > "$HOME/.claude/active-model"
  if [[ "$mode" == "full" ]]; then
    ANTHROPIC_BASE_URL="$PROXY" \
      claude --model "$model" --dangerously-skip-permissions
  else
    ANTHROPIC_BASE_URL="$PROXY" \
      claude --model "$model"
  fi
}

# set-model — quick model override from terminal (works during active Claude Code session)
# Usage:
#   set-model                  → show current model
#   set-model <model-name>     → switch to model
#   set-model clear            → remove override
#   set-model list             → show all available models
set-model() {
  local PROXY="http://127.0.0.1:4001"
  local ACTIVE_MODEL_FILE="$HOME/.claude/active-model"

  case "$1" in
    "")
      local current
      current=$(cat "$ACTIVE_MODEL_FILE" 2>/dev/null || echo "none (using session default)")
      echo "🤖 Current model: $current"
      ;;
    "clear")
      rm -f "$ACTIVE_MODEL_FILE"
      echo "✅ Model override cleared"
      ;;
    "list")
      echo "📋 Available models:"
      curl -s "$PROXY/v1/models" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    by_provider = {}
    for m in data.get('data', []):
        mid = m.get('id', '')
        if mid:
            by_provider.setdefault(m.get('owned_by', 'opencode'), []).append(mid)
    for provider, ids in sorted(by_provider.items()):
        print(f'  [{provider.upper()}]')
        for mid in ids:
            print(f'    {mid}')
except Exception as e:
    print(f'  Error: {e}')
    print('  Could not reach proxy at localhost:4001')
"
      ;;
    *)
      mkdir -p "$(dirname "$ACTIVE_MODEL_FILE")"
      echo "$1" > "$ACTIVE_MODEL_FILE"
      echo "✅ Model set to: $1"
      echo "   (Takes effect on your next Claude Code message)"
      ;;
  esac
}

# switch-model — like set-model but with fzf picker when called with no args
# Usage:
#   switch-model               → fzf picker to choose a model
#   switch-model <model-name>  → switch directly (like set-model)
#   switch-model clear         → remove model override
switch-model() {
  local PROXY="http://127.0.0.1:4001"
  local ACTIVE_MODEL_FILE="$HOME/.claude/active-model"

  if [[ -z "$1" || "$1" == "list" ]]; then
    local _model_list
    _model_list=$(curl -s --max-time 5 "$PROXY/v1/models" 2>/dev/null \
      | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for m in data.get('data', []):
        mid = m.get('id', '')
        if mid:
            print(mid)
except (json.JSONDecodeError, KeyError, TypeError, ValueError):
    pass
" 2>/dev/null)
    if [[ -z "$_model_list" ]]; then
      echo "⚠️  Could not reach proxy at $PROXY"
      return 1
    fi
    local chosen
    chosen=$(echo "$_model_list" \
      | fzf --prompt="🤖 Switch Model > " --height=30 --border --reverse \
            --header="↑↓ navigate  Enter select  Esc cancel  (takes effect on next message)")
    [[ -z "$chosen" ]] && return 0
    mkdir -p "$(dirname "$ACTIVE_MODEL_FILE")"
    # Auth validation (same as run-claude-opencode)
    if [[ "$chosen" == copilot/* ]]; then
      local copilot_token
      copilot_token=$(gh auth token 2>/dev/null)
      if [[ -z "$copilot_token" ]]; then
        echo ""
        echo "⚠️  GitHub Copilot requires authentication."
        echo "   Run: gh auth login"
        return 1
      fi
      echo "🐙 GitHub Copilot: authenticated ✅ ($(gh auth whoami 2>/dev/null || echo 'logged in'))"
    fi
    if [[ "$chosen" == gemini/* ]]; then
      local gemini_key
      gemini_key=$(curl -s --max-time 5 http://127.0.0.1:4001/api/providers 2>/dev/null \
        | python3 -c "import sys,json; d=json.load(sys.stdin); p=[x for x in d['providers'] if x['id']=='gemini'][0]; print('ok' if p['connected'] else '')" 2>/dev/null)
      if [[ -z "$gemini_key" ]]; then
        echo "⚠️  Google Gemini requires an API key. Connect it at: http://127.0.0.1:4001/providers"
        return 1
      fi
    fi
    if [[ "$chosen" == openai/* ]]; then
      local openai_key
      openai_key=$(curl -s --max-time 5 http://127.0.0.1:4001/api/providers 2>/dev/null \
        | python3 -c "import sys,json; d=json.load(sys.stdin); p=[x for x in d['providers'] if x['id']=='openai'][0]; print('ok' if p['connected'] else '')" 2>/dev/null)
      if [[ -z "$openai_key" ]]; then
        echo "⚠️  OpenAI requires an API key. Connect it at: http://127.0.0.1:4001/providers"
        return 1
      fi
    fi
    echo "$chosen" > "$ACTIVE_MODEL_FILE"
    echo "✅ Model switched to: $chosen"
    echo "   (Takes effect on your next Claude Code message)"
  else
    set-model "$@"
  fi
}
