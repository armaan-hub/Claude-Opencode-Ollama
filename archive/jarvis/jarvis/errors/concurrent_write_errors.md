# Concurrent Write Errors

| Error Code | Description | Cause | Resolution |
|---|---|---|---|
| ERR_LOCK_TIMEOUT | Config write operation exceeded lock wait threshold | Too many concurrent writes contending for the same file lock | Retry with exponential backoff and increase lock timeout where safe |
| ERR_PARTIAL_WRITE | Incomplete JSON/config content was persisted | Process terminated during write before flush/rename completed | Use atomic write flow (write temp file, fsync, atomic rename) |
| ERR_FILE_LOCKED | Target file remained locked by another process | Another Jarvis instance or external process held an exclusive lock | Wait for lock release (up to 5s), then retry safely |
| ERR_WRITE_CONFLICT | New write detected stale in-memory state | Concurrent updates raced and last writer overwrote newer data | Re-read latest file state before retrying merge/write |
| ERR_CORRUPTED_CONFIG | File content unreadable after concurrent updates | Interleaved writes or interrupted write cycle corrupted payload | Restore from backup, validate schema, then rewrite atomically |
