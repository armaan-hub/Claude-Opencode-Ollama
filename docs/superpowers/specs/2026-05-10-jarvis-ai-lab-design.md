# Jarvis — AI Lab Launcher

**Date:** 2026-05-10  
**Status:** Draft

---

## Overview

Jarvis is a voice-activated AI workbench launcher for macOS. A single command (`jarvis`) opens a pre-configured split-screen layout: VS Code on the left, a Zellij terminal workspace on the right containing all AI tools ready to use. Speaking **"Jarvis wake up"** or **"wake up Jarvis"** activates the full setup, and a speaker verification layer ensures only you can trigger it. After activation, Jarvis responds with a confirmation like *"Yes, sir"* or *"Welcome back"* via macOS text-to-speech.

---

## Component 1 — Jarvis Launcher (`jarvis`)

### What it does
A shell script that launches the full workbench in one command.

### How it works
1. **Launches VS Code** as a macOS app window on the left (full height, ~40% width)
2. **Launches Zellij** with a pre-built layout on the right (full height, ~60% width)
3. The two run as separate processes so VS Code is a normal macOS window

### Launcher script location
`/Users/armaan/.local/bin/jarvis` (added to PATH via `.zshrc`)

### Implementation
```sh
#!/bin/zsh
open -a "Visual Studio Code"
zellij attach -c -n jarvis 2>/dev/null || zellij -l ai-lab attach -c -n jarvis
```
(Attach to existing session if already running, create new one otherwise.)

---

## Component 2 — Zellij Layout (Right-side Terminal Workspace)

### Pane layout (top to bottom, right side only)
```
┌─────────────────────────────────────┬────────────────────────┐
│                                     │  pane 1: fastfetch     │
│                                     ├────────────────────────┤
│        VS Code (macOS app)          │  pane 2: blank         │
│        ~40% width                   │  pane 3: blank         │
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
| 2 | (blank, interactive shell) | Any command |
| 3 | (blank, interactive shell) | Any command |
| 4 | `btop` | System monitor |
| 5 | `copilot --allow-all` | GitHub Copilot CLI |
| 6 | `claude --dangerously-skip-permission` | Claude CLI |
| 7 | `ollama launch claude --model qwen3.5:35b-a3b-coding-nvfp4 --dangerously-skip-permissions` | Ollama with Claude |
| 8 | `gemini --approval-mode yolo` | Gemini CLI |

### Layout file location
`/Users/armaan/.config/zellij/layouts/ai-lab.kdl`

### Ollama & LM Studio
These open as separate **macOS app windows on their own dedicated screen**, not in the Zellij workspace. The script opens them via `open -a`.

---

## Component 3 — Voice Wake System

### What it does
A background daemon that listens for the phrases **"Jarvis wake up"** or **"wake up Jarvis"**. When recognized and verified as you, it triggers `jarvis` and responds with a confirmation.

### How it works

**Step 1 — Voice Profile Enrollment (first run only)**
- A Swift/Python script uses `SFSpeechSpeakerIdentification` to enroll your voice
- Takes ~30 seconds of speaking to build a voice profile
- Profile saved to `~/.jarvis/voice_profile/`
- macOS Speech Recognition permission required (one-time prompt)
- The enrollment UI is shown automatically on first run

**Step 2 — Background Listener (always running)**
- A launchd agent or background process starts on login
- Uses `SFSpeechRecognizer` + `SFSpeechSpeakerIdentification` to:
  1. Detect audio continuously in the background
  2. Match incoming speech against the enrolled voice profile
  3. Only trigger on both phrase match AND speaker match

**Step 3 — Trigger Action + Response**
- Runs `jarvis`
- Speaks back via macOS TTS (say / AVSpeechSynthesizer) — one of:
  - *"Yes, sir."*
  - *"Welcome back."*
  - *"At your service."*
- Optionally also opens: Notes, Safari, Ollama app, LM Studio app

### Speaker Recognition on macOS
- **SFSpeechSpeakerIdentification** is built into the `Speech` framework (available on macOS 13+)
- Works with the built-in microphone
- No internet required — all processing is on-device
- Speaker verification is separate from speech-to-text — it confirms "is this the same person who enrolled?"

### Wake phrase
| Phrase | Notes |
|--------|-------|
| "Jarvis wake up" | Primary — natural invocation |
| "wake up Jarvis" | Alternative — same recognition |

No hot word service needed — the phrase is recognized via full speech-to-text + speaker verification.

### Security note
- The system only responds to your voice after enrollment
- Background audio is processed locally, not sent anywhere

---

## Implementation Phases

### Phase 1 — Layout & Launcher
- [ ] Write Zellij layout `ai-lab.kdl`
- [ ] Write launcher script `jarvis`
- [ ] Add to PATH in `.zshrc`
- [ ] Test manually: `jarvis` opens VS Code + Zellij layout

### Phase 2 — Screen Automation (Ollama & LM Studio)
- [ ] Script to position Ollama window on Screen 2
- [ ] Script to position LM Studio window on Screen 2
- [ ] Integrate into launcher

### Phase 3 — Voice Wake System
- [ ] Write voice enrollment script (first-run setup)
- [ ] Write background listener service
- [ ] Integrate speaker verification
- [ ] Configure launchd agent for auto-start on login
- [ ] Add TTS response ("Yes, sir" / "Welcome back" / "At your service")
- [ ] Full end-to-end test

---

## File Locations

| File | Path |
|------|------|
| Zellij layout | `~/.config/zellij/layouts/ai-lab.kdl` |
| Launcher script | `~/.local/bin/jarvis` |
| Voice listener | `~/.jarvis/listener.py` |
| Voice enrollment | `~/.jarvis/enroll.py` |
| Voice profile | `~/.jarvis/voice_profile/` |
| Launchd agent | `~/Library/LaunchAgents/com.armaan.jarvis.plist` |

---

## Dependencies

- **Zellij** (installed at `/opt/homebrew/bin/zellij`)
- **VS Code** (macOS app — standard install path)
- **Ollama** (macOS app)
- **LM Studio** (macOS app)
- **copilot CLI** (npm global install)
- **claude CLI** (npm global install)
- **gemini CLI** (npm global install)
- **fastfetch** (likely installed)
- **btop** (likely installed)
- **Speech framework** (built into macOS — no install needed)

---

## Out of Scope (for now)

- Multi-user support (single user, single voice profile)
- Remote activation
- Custom wake phrases beyond the enrolled phrase
- Integration with other AI tools beyond the listed ones
