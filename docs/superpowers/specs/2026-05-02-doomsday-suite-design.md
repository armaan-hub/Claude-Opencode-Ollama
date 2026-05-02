# Spec: Avengers: Doomsday Suite

**Date:** 2026-05-02  
**Target Event:** Avengers: Doomsday Premiere (December 18, 2026)  
**Primary Asset:** `~/Downloads/avengers-doomsday-7680x4320-17768.jpg`

## Overview
A multi-platform countdown suite designed with a "Marvel Doomsday" aesthetic (metallic textures, neon green accents, cinematic glitch effects). The suite consists of three distinct components to provide coverage across the user's desktop, browser, and developer environment.

---

## 1. Web Portal (Cinematic Experience)
**Tech Stack:** React, Three.js (for shaders/effects), Tailwind CSS.

### Features:
- **Cinematic Background:** Uses the provided 8K wallpaper with a subtle "pulse" animation.
- **Glitch Countdown:** A high-fidelity timer with "digital glitch" transitions on second changes.
- **Visual Effects:** 
  - GLSL Scanline overlay.
  - Interactive mouse-parallax on the logo.
  - Glowing neon green glow (#58cc02) synchronized with the countdown pulse.
- **Deployment:** A standalone HTML/JS bundle that can be run locally.

---

## 2. Native macOS App (System Integration)
**Tech Stack:** Swift, SwiftUI.

### Features:
- **Menu Bar Status:** A compact "Time to Doomsday" string in the macOS menu bar (e.g., `07d 15h`).
- **Desktop HUD:** A semi-transparent, floating "Heads-Up Display" window that can be toggled.
- **Notifications:** Milestone alerts (e.g., "100 Days to Doomsday").
- **Persistence:** Runs as a lightweight background agent.

---

## 3. Terminal Dashboard (Developer Workflow)
**Tech Stack:** Python, `rich` library.

### Features:
- **Tmux Compatibility:** Designed to fit perfectly in a small tmux pane.
- **ASCII Art:** Renders "DOOMSDAY" in a stylized ASCII font.
- **OS Simulation:** Text-based interface mimicking a "secure terminal" boot sequence.
- **Integration:** A simple `doomsday` command added to the user's path.

---

## Design Constraints & Style
- **Color Palette:** Deep Black (#000000), Gunmetal Gray (#2c3e50), Marvel Doomsday Green (#58cc02).
- **Typography:** Heavy, condensed sans-serif (resembling the Avengers logo) for titles; Monospace for the Terminal and HUD elements.
- **Behavior:** All timers must sync to the system clock and handle timezone offsets correctly relative to Dec 18, 2026.

---

## Spec Self-Review
1. **Placeholders:** None. All target dates and assets are defined.
2. **Consistency:** All three platforms share the same green/metallic theme.
3. **Scope:** Focused on read-only countdowns and visual flair. No complex backend or user accounts required.
4. **Ambiguity:** Defined specific hex codes and assets to ensure visual parity.
