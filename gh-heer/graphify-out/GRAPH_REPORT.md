# Graph Report - gh-heer  (2026-05-14)

## Corpus Check
- 13 files · ~3,296 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 120 nodes · 137 edges · 9 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `617611ca`
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

## God Nodes (most connected - your core abstractions)
1. `readConfig()` - 7 edges
2. `getProxyStatus()` - 6 edges
3. `appendAuditLog()` - 6 edges
4. `authCommand()` - 5 edges
5. `writeConfig()` - 4 edges
6. `ensureConfigDir()` - 3 edges
7. `switchCommand()` - 3 edges
8. `statusCommand()` - 3 edges
9. `getProvider()` - 2 edges
10. `ensureAuditDir()` - 2 edges

## Surprising Connections (you probably didn't know these)
- `switchCommand()` --calls--> `getProxyStatus()`  [EXTRACTED]
  commands/switch.js → lib/proxy-client.js
- `statusCommand()` --calls--> `readConfig()`  [EXTRACTED]
  commands/status.js → lib/config-manager.js
- `authCommand()` --calls--> `appendAuditLog()`  [EXTRACTED]
  commands/auth.js → lib/audit-logger.js
- `statusCommand()` --calls--> `getProxyStatus()`  [EXTRACTED]
  commands/status.js → lib/proxy-client.js
- `authCommand()` --calls--> `readConfig()`  [EXTRACTED]
  commands/auth.js → lib/config-manager.js

## Communities (9 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (17): ACTIVE_MODEL_FILE, chalk, fs, { getProxyStatus }, os, path, { readConfig }, statusCommand() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (15): config, existing, fs, { getProvider, CONFIG_DIR, CONFIG_FILE }, newConfig, oldConfig, os, path (+7 more)

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (15): { appendAuditLog }, authCommand(), chalk, { getOrgSecret }, PROVIDER_SECRETS, { readConfig, writeConfig }, CONFIG_DIR, CONFIG_FILE (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (15): ACTIVE_MODEL_FILE, { appendAuditLog }, chalk, fs, { getProxyStatus }, os, path, switchCommand() (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (12): appendSpy, auditLogger, { authCommand }, config, configFile, consoleSpy, fs, githubSecrets (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (10): { appendAuditLog }, { appendAuditLog, AUDIT_DIR, AUDIT_FILE }, { appendAuditLog, AUDIT_FILE }, assert, entry, fs, homeDir, lines (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.2
Nodes (9): auditSpy, claudeDir, consoleSpy, content, fs, os, path, switchModule (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (7): activeModelPath, fs, logSpy, os, path, { statusCommand }, TEST_HOME

## Knowledge Gaps
- **90 isolated node(s):** `EventEmitter`, `http`, `calls`, `res`, `req` (+85 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getProxyStatus()` connect `Community 0` to `Community 3`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `readConfig()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `appendAuditLog()` connect `Community 3` to `Community 2`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `EventEmitter`, `http`, `calls` to the rest of the system?**
  _90 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._