# Launchd Errors

| Error Code | Description | Cause | Resolution |
|---|---|---|---|
| ERR_PYTHON_PATH_NOT_FOUND | launchd could not execute configured Python interpreter | plist ProgramArguments references missing or moved Python path | Update plist to valid interpreter path and reload launch agent |
| ERR_PLIST_SYNTAX | launch agent plist failed validation/parsing | Invalid XML structure, malformed keys, or bad value types | Validate with `plutil -lint`, correct syntax, then reload |
| ERR_LAUNCHD_LOAD_FAILED | Agent failed to load via launchctl | Incorrect plist permissions, ownership, or invalid label | Fix file permissions/ownership and ensure unique label |
| ERR_WORKING_DIR_INVALID | Service start failed due to bad WorkingDirectory | Directory in plist does not exist or is inaccessible | Set WorkingDirectory to existing readable path |
| ERR_ENV_MISSING | Runtime env vars unavailable in launchd context | Shell profile vars are not inherited by launchd processes | Define required env vars in plist EnvironmentVariables |
