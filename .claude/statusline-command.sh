#!/bin/sh
# Claude Code status line — based on Oh My Zsh robbyrussell theme
input=$(cat)
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd')
dir=$(basename "$cwd")

# Git info (skip optional locks to avoid contention)
branch=$(git -C "$cwd" -c gc.auto=0 symbolic-ref --short HEAD 2>/dev/null \
      || git -C "$cwd" -c gc.auto=0 rev-parse --short HEAD 2>/dev/null)

# Current directory in cyan
printf "\033[1;36m%s\033[0m" "$dir"

# Git branch and dirty indicator
if [ -n "$branch" ]; then
  if git -C "$cwd" -c gc.auto=0 status --porcelain 2>/dev/null | grep -q .; then
    printf " \033[1;34mgit:(\033[0;31m%s\033[1;34m) \033[0;33m✗\033[0m" "$branch"
  else
    printf " \033[1;34mgit:(\033[0;31m%s\033[1;34m)\033[0m" "$branch"
  fi
fi

# Model name — prefer ~/.claude/active-model (proxy override), fall back to Claude's reported model
override=$(cat ~/.claude/active-model 2>/dev/null | tr -d '\n' | tr -d ' ')
if [ -n "$override" ]; then
  model="$override"
else
  model=$(echo "$input" | jq -r '.model.display_name // empty')
fi
[ -n "$model" ] && printf " \033[2m%s\033[0m" "$model"

# Context usage percentage (dimmed)
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
[ -n "$used" ] && printf " \033[2mctx:$(printf '%.0f' "$used")%%\033[0m"

printf "\n"
