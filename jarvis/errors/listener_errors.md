# Listener Errors

| Error Code | Description | Cause | Resolution |
|---|---|---|---|
| ERR_PORT_BIND_FAILED | Listener could not bind to configured port | Port already in use or insufficient privileges | Free/change port, then restart listener with valid permissions |
| ERR_NETWORK_UNREACHABLE | Listener failed to reach upstream/downstream endpoint | DNS, route, firewall, or interface outage | Verify network route, DNS resolution, and firewall rules |
| ERR_SOCKET_TIMEOUT | Connection/session timed out during request handling | Slow client/upstream or timeout too aggressive | Tune timeout values and add retry/backoff strategy |
| ERR_SIGNAL_HANDLER_FAILURE | Graceful shutdown hooks failed on SIGTERM/SIGINT | Signal handler threw exception or cleanup path broken | Harden signal handlers and ensure idempotent cleanup |
| ERR_CONNECTION_RESET | Peer closed connection unexpectedly | Remote endpoint crashed, restarted, or dropped idle socket | Add reconnect logic and improve keepalive/health checks |
