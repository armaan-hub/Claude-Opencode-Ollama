# Jarvis v1.1 Error Catalog

This directory documents common error types identified during Jarvis v1.1 fixes.

| Category | Summary | Document |
|---|---|---|
| Concurrent Write Errors | File lock contention, partial writes, and config corruption scenarios | [concurrent_write_errors.md](./concurrent_write_errors.md) |
| launchd Errors | Service startup, plist validation, and runtime environment issues | [launchd_errors.md](./launchd_errors.md) |
| Skills Errors | Skill loading, reloading, dependency, and registration failures | [skills_errors.md](./skills_errors.md) |
| Listener Errors | Port binding, connectivity, timeout, and signal/shutdown failures | [listener_errors.md](./listener_errors.md) |

## Required Table Fields

Each catalog entry includes:
- Error code
- Description
- Cause
- Resolution
