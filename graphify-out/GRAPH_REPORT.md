# Graph Report - universal-llm-v1.1  (2026-05-10)

## Corpus Check
- 13 files · ~4,406 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 140 nodes · 163 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8b4eade3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]

## God Nodes (most connected - your core abstractions)
1. `Config` - 15 edges
2. `Jarvis — AI Lab Launcher` - 11 edges
3. `TestConcurrentWrites` - 10 edges
4. `compute_llm_params()` - 10 edges
5. `Component 3 — Jarvis Chat Interface` - 10 edges
6. `decompose_query()` - 8 edges
7. `Spec: Avengers: Doomsday Suite` - 7 edges
8. `Component 4 — Voice Wake System` - 7 edges
9. `LockTimeoutError` - 6 edges
10. `Implementation Phases` - 6 edges

## Surprising Connections (you probably didn't know these)
- `test_compute_llm_params_fast_query()` --calls--> `compute_llm_params()`  [INFERRED]
  tests/test_llm_params.py → universal_llm/llm_compute.py
- `test_compute_llm_params_research_query()` --calls--> `compute_llm_params()`  [INFERRED]
  tests/test_llm_params.py → universal_llm/llm_compute.py
- `test_analysis_mode_params()` --calls--> `compute_llm_params()`  [INFERRED]
  tests/test_llm_params.py → universal_llm/llm_compute.py
- `test_unknown_mode_raises_error()` --calls--> `compute_llm_params()`  [INFERRED]
  tests/test_llm_params.py → universal_llm/llm_compute.py
- `test_empty_query_string()` --calls--> `compute_llm_params()`  [INFERRED]
  tests/test_llm_params.py → universal_llm/llm_compute.py

## Communities (13 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (13): Config, Get a configuration value., Get a configuration value., Configuration manager with concurrent write protection., Configuration manager with concurrent write protection., Concurrent write tests for Config management. Tests that multiple threads can sa, RED: Stress test with 10 threads each calling save 5 times.         - 50 total s, CRITICAL: Verify that no data is lost even with concurrent writes.         - Eac (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (18): code:block1 (┌───────────────────────────────────────────────────────────), code:block3 (┌─────────────────────────────────────┬─────────────────────), Component 2 — Zellij Layout (Right-side Terminal Workspace), Dependencies, File Locations, Implementation Phases, Individual pane commands, Jarvis — AI Lab Launcher (+10 more)

### Community 2 - "Community 2"
Cohesion: 0.24
Nodes (10): test_analysis_mode_params(), test_case_insensitive_mode_lookup(), test_compute_llm_params_fast_query(), test_compute_llm_params_research_query(), test_empty_query_string(), test_unknown_mode_raises_error(), test_whitespace_only_query(), compute_llm_params() (+2 more)

### Community 3 - "Community 3"
Cohesion: 0.24
Nodes (10): Set a configuration value., Set a configuration value., test_decompose_complex_query(), test_decompose_returns_list_of_strings(), _compose_suffix(), decompose_query(), _extract_jurisdictions(), _extract_time_ranges() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (9): Exception, LockTimeoutError, Config management for Jarvis with concurrent write safety.  Handles reading and, Raised when lock acquisition times out., Raised when lock acquisition times out., Acquire exclusive lock with timeout.                  Args:             lock_fil, Acquire exclusive lock with timeout.                  Args:             lock_fil, Save configuration to file with fcntl locking.                  Acquires an excl (+1 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (10): 1. Web Portal (Cinematic Experience), 2. Native macOS App (System Integration), 3. Terminal Dashboard (Developer Workflow), Design Constraints & Style, Features:, Features:, Features:, Overview (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (11): Admin Access, code:block4 (~/.jarvis/skills/[skill-name]/), Component 3 — Jarvis Chat Interface, Default Brain, How the chat works (technical), Interface file location, Interface Modes, Model Switching (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.27
Nodes (8): test_detect_analytical_query(), test_detect_complex_research_query(), test_detect_simple_query(), test_route_to_llm(), detect_query_complexity(), Returns 'fast', 'deep_research', or 'analysis'., Select best model from available models based on query requirements., route_query_to_llm()

### Community 8 - "Community 8"
Cohesion: 0.29
Nodes (4): Universal LLM settings package., LLMParamsRegistry, load(), ModeConfig

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (7): Component 4 — Voice Wake System, Security Note, Speaker Recognition on macOS, Step 1 — Voice Profile Enrollment (first run only), Step 2 — Background Listener (always running after enrollment), Step 3 — Trigger Action + TTS Response, What it does

### Community 10 - "Community 10"
Cohesion: 0.33
Nodes (4): Load configuration from file., Load configuration from file., Initialize Config manager.          Args:             path: Optional path to con, Initialize Config manager.          Args:             path: Optional path to con

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (6): code:sh (#!/bin/zsh), Component 1 — Jarvis Launcher (`jarvis`), How it works, Implementation, Launcher script location, What it does

## Knowledge Gaps
- **68 isolated node(s):** `Concurrent write tests for Config management. Tests that multiple threads can sa`, `Test suite for concurrent config write operations.`, `RED: Multiple concurrent writes should all succeed.         - Spawn 5 threads, e`, `RED: If lock is held for too long, should raise LockTimeoutError.         - Acqu`, `Verify Config API is backward compatible.         - Config should be instantiabl` (+63 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Config` connect `Community 0` to `Community 10`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.230) - this node is a cross-community bridge._
- **Why does `Jarvis — AI Lab Launcher` connect `Community 1` to `Community 9`, `Community 11`, `Community 6`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `Config` (e.g. with `TestConcurrentWrites` and `.test_concurrent_writes_serialized()`) actually correct?**
  _`Config` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `TestConcurrentWrites` (e.g. with `Config` and `LockTimeoutError`) actually correct?**
  _`TestConcurrentWrites` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 7 inferred relationships involving `compute_llm_params()` (e.g. with `test_compute_llm_params_fast_query()` and `test_compute_llm_params_research_query()`) actually correct?**
  _`compute_llm_params()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Concurrent write tests for Config management. Tests that multiple threads can sa`, `Test suite for concurrent config write operations.`, `RED: Multiple concurrent writes should all succeed.         - Spawn 5 threads, e` to the rest of the system?**
  _68 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._