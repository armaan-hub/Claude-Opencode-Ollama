# Provider Queuing & Exponential Backoff (OpenCode Proxy)

Summary
- Add per-provider request queues and exponential backoff so transient upstream 429s from free providers (e.g., opencode/minimax-m2.5-free) do not immediately surface to clients.
- Queueing limits concurrency per provider and retries failed requests with backoff using Retry-After when provided.

Goals
- Reduce visible 429 errors returned to clients by handling retries inside the proxy.
- Make limits configurable per-provider in opencode-proxy-config.json (providerLimits).
- Expose backoff / queue events in proxy logs and /api/stats for observability.

Design
- New runtime structures in opencode-proxy-server.js:
  - PROVIDER_QUEUES: { [providerId]: { inFlight, queue:[{sendFn,resolve,reject}] } }
  - DEFAULT_PROVIDER_LIMITS + CFG.providerLimits override
- send flow:
  - All outgoing provider requests go through enqueueProviderRequest(providerId, () => forwardToProvider(...))
  - enqueueProviderRequest enqueues and triggers processProviderQueue(providerId)
  - processProviderQueue dispatches up to `concurrency` tasks concurrently
  - runProviderTask performs attempts with exponential backoff and honors upstream Retry-After header
  - On final failure (after maxRetries) the proxy returns the upstream response/error to the client

Config
- Add optional `providerLimits` object to ~/opencode-proxy-config.json, example:
  {
    "providerLimits": {
      "opencode": { "concurrency": 2, "maxRetries": 3, "baseBackoffMs": 500 }
    }
  }
- Defaults used when not configured: opencode concurrency=2, maxRetries=3, baseBackoffMs=500

Observability
- Log backoff events with `[BACKOFF] provider ...` entries
- REQUEST_COUNTS continues to track per-provider request totals
- /api/stats continues to report counts; future work: include queue depths and retry counts

Files changed
- opencode-proxy-server.js — add queueing/backoff helpers and route upstream requests through them
- docs/superpowers/specs/2026-05-19-opencode-backoff-queue-design.md — this document

Test plan
1. Deploy patch locally, restart proxy
2. Simulate burst requests to opencode/minimax-m2.5-free and confirm proxy logs show BACKOFF events and that client 429s are reduced
3. Tune concurrency/backoff via opencode-proxy-config.json

