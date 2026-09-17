# Architecture and ten-case browser validation

Implementation branch: `perf/browser-architecture-e2e-20260917`.
The user waived the unavailable subagent requirement and requested direct implementation, TDD, and two review stages. No independent-agent review is claimed.

A separate worktree was created after observing concurrent edits in the original worktree. Existing transport, password-redaction, and initial no-popup-wait changes were preserved as the starting point. The original worktree was not overwritten.

## Implemented and locally verified

- Persistent run-owned popup observation and continuation in the actual popup, preserving POST state instead of reloading its URL.
- Delayed popup capture and isolation between concurrent runs.
- Stable per-document element references and exact-node resolution; copied attributes do not authorize replacement nodes.
- Payment/verification field redaction and refusal to classify those fields as text-writing targets.
- Explicit DOMContentLoaded navigation, with real redirect and SPA fixtures.
- Closed-run tombstones and idempotent cleanup; closed runs cannot silently create new sessions.
- Neutral-page document identity that works before navigating to a secure origin.
- Ten real-Chromium end-to-end browser-boundary fixtures. A local adapter replaces only the external relay; CI separately exercises the actual extension/relay.

## Test-driven evidence

| Case | Initial observation | Subsequent result |
|---|---|---|
| Fast focus | Already passed with preserved initial optimization | PASS |
| POST popup | FAIL: popup state lost after GET replay | PASS: one POST, no GET replay |
| Delayed popup | Regression of persistent listener change | PASS |
| Dynamic control identity | FAIL: unchanged ref e2 became e3 | PASS |
| Sensitive fields | FAIL: synthetic payment value entered observation | PASS |
| Redirect and SPA | Regression of explicit readiness policy | PASS |
| Replaced target | FAIL: copied reference allowed wrong-node click | PASS |
| Multi-field flight form | Regression with exact externally submitted values | PASS; synthetic, not real airfare |
| Concurrent runs | Regression of run-owned popup tracking | PASS |
| Lifecycle | FAIL: closed run reopened a browser; additional blank-page failure found | PASS |

Actual local results: 10/10 browsing cases; 32 unit tests; typecheck passed. The two obsolete popup unit tests that asserted timeout/mirroring implementation strings were replaced by real popup/ownership cases, not rewritten to assert different implementation strings.

Extension-backed CI, the live flight-site prompt, final specification review and final code-quality review remain pending. This is not a claim that every item in the original architecture plan is complete. DOM caching, payload reduction, and detailed timing are the next implementation slice.
