# Jarvis — AI Lab Launcher

**Date:** 2026-05-10  
**Status:** Draft

---

## Overview

Jarvis is a voice-activated AI workbench launcher for macOS. A single command (`jarvis`) or wake phrase ("Jarvis wake up" / "wake up Jarvis") opens a pre-configured split-screen layout: VS Code on the left, a Zellij terminal workspace on the right. A full dedicated screen hosts the **Jarvis Chat Interface** — a green-on-black conversational terminal where you control your entire AI stack with natural commands.

Speaking **"Jarvis wake up"** or **"wake up Jarvis"** activates the full setup, and a speaker verification layer ensures only you can trigger it. After activation, Jarvis responds with *"Yes, sir"*, *"Welcome back"*, or *"At your service"* via macOS TTS.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCREEN 1 (Primary)                      │
│  ┌───────────────────────────┬─────────────────────────────────┐ │
│  │                           │  pane 1: fastfetch              │ │
│  │                           ├─────────────────────────────────┤ │
│  │                           │  pane 2: (blank shell)           │ │
│  │      VS Code              │  pane 3: (blank shell)           │ │
│  │      (macOS app)          ├─────────────────────────────────┤ │
│  │      ~40% width           │  pane 4: btop                    │ │
│  │                           ├─────────────────────────────────┤ │
│  │                           │  pane 5: copilot --allow-all    │ │
│  │                           │  pane 6: claude                 │ │
│  │                           │  pane 7: ollama launch claude   │ │
│  │                           │  pane 8: gemini --approval-mode yolo │
│  └───────────────────────────┴─────────────────────────────────┘ │
│                                                                 ///
┌─────────────────────────────────────────────────────────────────┐
│                      SCREEN 2 (Dedicated)                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           JARVIS CHAT INTERFACE (green on black)            │ │
│  │                                                             │ │
│  │  [JARVIS v1.0] ──────────────────────────────────────────   │ │
│  │                                                             │ │
│  │  > Welcome back, sir. How may I serve you today?            │ │
│  │  [GPT-5 mini] ──────────────────────────────────────────    │ │
│  │                                                             │ │
│  │  User: switch Claude to minimax-m2.5-free                    │ │
│  │  [JARVIS]: Changing Claude model to minimax-m2.5-free...    │ │
│  │  [JARVIS]: Done. Claude is now using minimax-m2.5-free.    │ │
│  │                                                             │ │
│  │  [Skills: 3 active] [Model: GPT-5 mini] [System: admin]     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Ollama macOS app** and **LM Studio** also open on Screen 2 as separate windows, positioned by the launcher script.

---

## Component 1 — Jarvis Launcher (`jarvis`)

### What it does
A shell script that launches the full workbench in one command.

### How it works
1. Opens VS Code as a macOS app window on the left of Screen 1 (~40% width)
2. Opens Zellij with the `ai-lab` layout on the right of Screen 1 (~60% width)
3. Opens the Jarvis Chat Interface full-screen on Screen 2
4. Opens Ollama and LM Studio as macOS apps on Screen 2 (positioned alongside the chat)
5. Positions windows using `yabai` or `open` + AppleScript

### Launcher script location
`/Users/armaan/.local/bin/jarvis`

### Implementation
```sh
#!/bin/zsh
open -a "Visual Studio Code"
zellij attach -c -n jarvis 2>/dev/null || zellij -l ai-lab attach -c -n jarvis
open -a "Ollama"
open -a "LM Studio"
# Launch Jarvis Chat Interface
python3 ~/.jarvis/chat_interface.py &
```

---

## Component 2 — Zellij Layout (Right-side Terminal Workspace)

### Pane layout
```
┌─────────────────────────────────────┬────────────────────────┐
│                                     │  pane 1: fastfetch     │
│        VS Code (macOS app)          ├────────────────────────┤
│        ~40% width                   │  pane 2: blank shell   │
│                                     │  pane 3: blank shell   │
│                                     ├────────────────────────┤
│                                     │  pane 4: btop          │
│                                     ├────────────────────────┤
│                                     │  pane 5: copilot       │
│                                     │  pane 6: claude        │
│                                     │  pane 7: ollama        │
│                                     │  pane 8: gemini        │
└─────────────────────────────────────┴────────────────────────┘
```

### Individual pane commands
| Pane | Command | Purpose |
|------|---------|---------|
| 1 | `fastfetch` | System info display |
| 2 | (blank interactive shell) | Any command |
| 3 | (blank interactive shell) | Any command |
| 4 | `btop` | System monitor |
| 5 | `copilot --allow-all` | GitHub Copilot CLI |
| 6 | `claude --dangerously-skip-permission` | Claude CLI |
| 7 | `ollama launch claude --model qwen3.5:35b-a3b-coding-nvfp4 --dangerously-skip-permissions` | Ollama Claude |
| 8 | `gemini --approval-mode yolo` | Gemini CLI |

### Layout file location
`/Users/armaan/.config/zellij/layouts/ai-lab.kdl`

---

## Component 3 — Jarvis Chat Interface

### What it is
A full-screen, green-on-black terminal-style conversational interface running on Screen 2. This is the primary way you interact with Jarvis.

### Visual Design
- Background: pure black (`#000000`)
- Text: bright green (`#00FF41`) — Matrix / hacker terminal aesthetic
- Font: monospace (JetBrains Mono or system monospace)
- Prompt format: `User: ` for user input, `[JARVIS]: ` for Jarvis responses
- Status bar at bottom: `[Skills: N active] [Model: XXX] [System: admin]`
- Title bar: `[JARVIS v1.0]`

### Interface Modes
1. **Chat mode** (default) — conversational back-and-forth with the active model
2. **Skill creation mode** — triggered by "Jarvis, learn this skill" — guides through creating a new skill
3. **Model switching** — "Jarvis, switch to [model]" changes the active backend
4. **Admin mode** — any shell command, config read/write, system control

### Default Brain
- **GPT-5 mini** via Copilot CLI (`copilot --allow-all`) for all conversations by default
- Stays on GPT-5 mini until you explicitly ask to switch
- On switch command, Jarvis changes the active model and confirms

### Model Switching
Jarvis can detect and switch between:
| Tool | Example Models | How it switches |
|------|--------------|-----------------|
| Copilot | GPT-5 mini, GPT-5, GPT-4o | `copilot --model gpt-5` or env var |
| Claude | minimax-m2.5-free, claude-opus-4-7 | `--model` flag or config file |
| Ollama | qwen3.5:35b-a3b-coding-nvfp4, any local model | `ollama run [model]` |
| LM Studio | Any served model | API endpoint switch |

### Skills System
Users can create new skills for Jarvis via voice command.

**How skill creation works:**
1. You say: "Jarvis, learn this skill"
2. Jarvis enters skill creation mode — asks follow-up questions to understand the skill
3. You describe what the skill does in plain language
4. Jarvis writes the skill as a JSON/config file and a corresponding shell script
5. The skill is saved to `~/.jarvis/skills/[skill-name]/`

**Skill structure:**
```
~/.jarvis/skills/[skill-name]/
  metadata.json   # name, description, trigger phrases, model preference
  script.sh       # what to execute when the skill is invoked
  hook.py         # optional: Python hook for more complex logic
```

**Example skills:**
- `open-ai-studio` — opens all AI studio apps with one command
- `daily-backup` — runs your backup routine
- `meeting-setup` — opens calendar, notes, video call app

**How Jarvis uses skills:**
- Matches your input against skill trigger phrases
- If matched, runs the skill script instead of sending to the LLM
- Skills can also be invoked mid-conversation as subroutines

### Admin Access
Jarvis has full system control on your behalf:
- Reads/writes config files (`~/.claude/`, `~/.config/zellij/`, etc.)
- Runs shell commands with your permissions
- Modifies Claude Code settings, Zellij configs, shell configs
- Reads environment variables and knows your installed models
- Installs/uninstalls packages via `brew`, `npm`, `pip`

### How the chat works (technical)
1. User types or speaks input
2. Input goes to the active model (GPT-5 mini by default)
3. Model decides: should this trigger a skill? Should this switch models? Should this run a shell command?
4. Jarvis executes the action and responds in green text
5. All config changes are persisted — next session remembers your settings

### Interface file location
`/Users/armaan/.jarvis/chat_interface.py`

---

## Component 4 — Voice Wake System

### What it does
A background daemon that listens for "Jarvis wake up" or "wake up Jarvis". When recognized and verified as you, it triggers the full workbench launch.

### Step 1 — Voice Profile Enrollment (first run only)
- A Python/Swift script uses `SFSpeechSpeakerIdentification` to enroll your voice
- Takes ~30 seconds of speaking to build a voice profile
- Profile saved to `~/.jarvis/voice_profile/`
- macOS Speech Recognition permission required (one-time prompt)
- Enrollment UI shown automatically on first run

### Step 2 — Background Listener (always running after enrollment)
- A launchd agent starts on login
- Uses `SFSpeechRecognizer` + `SFSpeechSpeakerIdentification` to:
  1. Detect audio continuously in the background
  2. Match incoming speech against the enrolled voice profile
  3. Only trigger on both phrase match AND speaker match

### Step 3 — Trigger Action + TTS Response
- Runs `jarvis`
- Speaks back via macOS TTS (AVSpeechSynthesizer) — one of:
  - *"Yes, sir."*
  - *"Welcome back."*
  - *"At your service."*

### Speaker Recognition on macOS
- **SFSpeechSpeakerIdentification** is built into the `Speech` framework (macOS 13+)
- All processing is on-device — no internet required
- Speaker verification confirms "is this the same person who enrolled?"

### Security Note
- The system only responds to your voice after enrollment
- All audio processing is local, not sent anywhere

---

## Implementation Phases

### Phase 1 — Layout & Launcher
- [ ] Write Zellij layout `ai-lab.kdl`
- [ ] Write launcher script `jarvis`
- [ ] Add to PATH in `.zshrc`
- [ ] Test manually: `jarvis` opens VS Code + Zellij layout + Ollama + LM Studio
- [ ] Verify window positioning on Screen 1 and Screen 2

### Phase 2 — Jarvis Chat Interface
- [ ] Write terminal UI in Python (blessed / textual / curses)
- [ ] Implement chat loop with GPT-5 mini via Copilot
- [ ] Add model switching logic for Copilot, Claude, Ollama, LM Studio
- [ ] Add skills system (create, list, run skills)
- [ ] Add admin mode (shell command execution, config read/write)
- [ ] Style with green-on-black Matrix aesthetic
- [ ] Add status bar: skills count, active model, system mode
- [ ] Test full-screen on Screen 2

### Phase 3 — Voice Wake System
- [ ] Write voice enrollment script (first-run setup)
- [ ] Write background listener service
- [ ] Integrate speaker verification
- [ ] Configure launchd agent for auto-start on login
- [ ] Add TTS response ("Yes, sir" / "Welcome back" / "At your service")
- [ ] Full end-to-end test

### Phase 4 — Skill Hooks & Learning
- [ ] Implement skill creation mode (voice-guided skill building)
- [ ] Write skill storage and loading system
- [ ] Integrate skill matching into chat loop
- [ ] Add built-in starter skills

### Phase 5 — Polish & Integration
- [ ] End-to-end voice activation test
- [ ] Window positioning refinement with yabai or open scripts
- [ ] Performance: ensure all panes launch quickly
- [ ] Documentation: document skill creation for the user

---

## File Locations

| File | Path |
|------|------|
| Zellij layout | `~/.config/zellij/layouts/ai-lab.kdl` |
| Launcher script | `~/.local/bin/jarvis` |
| Chat interface | `~/.jarvis/chat_interface.py` |
| Voice listener | `~/.jarvis/listener.py` |
| Voice enrollment | `~/.jarvis/enroll.py` |
| Voice profile | `~/.jarvis/voice_profile/` |
| Skills directory | `~/.jarvis/skills/` |
| Launchd agent | `~/Library/LaunchAgents/com.armaan.jarvis.plist` |
| Config store | `~/.jarvis/config.json` |
| Session log | `~/.jarvis/logs/` |

---

## Dependencies

- **Zellij** (installed at `/opt/homebrew/bin/zellij`)
- **VS Code** (macOS app — standard install path)
- **Ollama** (macOS app)
- **LM Studio** (macOS app)
- **copilot CLI** (npm global install) — default brain
- **claude CLI** (npm global install)
- **gemini CLI** (npm global install)
- **fastfetch** (likely installed)
- **btop** (likely installed)
- **Python** with `blessed` or `textual` library for terminal UI
- **Speech framework** (built into macOS)
- **yabai** (optional — for precise window management, or use AppleScript)

---

## Out of Scope

- Multi-user support
- Remote activation
- Integration with cloud services beyond listed AI tools
- Automatic model selection (always manual by user command for now)
