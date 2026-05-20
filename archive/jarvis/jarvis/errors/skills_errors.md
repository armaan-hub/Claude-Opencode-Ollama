# Skills Errors

| Error Code | Description | Cause | Resolution |
|---|---|---|---|
| ERR_SKILL_IMPORT_FAILED | Skill module failed to import at load time | Missing dependency, bad path, or module initialization error | Install dependencies, verify module path, and retry load |
| ERR_SKILL_RELOAD_TIMEOUT | Skill reload did not complete within timeout | Blocking initialization or deadlock during reload | Increase timeout, profile init path, remove blocking I/O |
| ERR_CIRCULAR_DEPENDENCY | Skill load halted due to circular imports | Two or more skill modules import each other recursively | Refactor shared logic into neutral module and break cycle |
| ERR_SKILL_REGISTRATION_MISSING | Expected skill not present in registry | Registration hook did not run or metadata invalid | Verify manifest/registration function and restart loader |
| ERR_SKILL_VERSION_MISMATCH | Skill API contract mismatch across versions | Runtime and skill package versions are incompatible | Pin compatible versions and upgrade/downgrade consistently |
