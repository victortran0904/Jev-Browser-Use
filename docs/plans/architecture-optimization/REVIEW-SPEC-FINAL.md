# Review stage 1 — reconciled specification compliance

Reviewer: implementing assistant in a separate self-review pass, under the explicit user waiver of subagents. This is not independent-agent or external approval.

Reviewed the eight-task plan, both divergent histories, unified boundary/observer/run controller, live harness and preserved behavioral tests.

Resolved findings: action-availability filtering; field identity in focused/direct-fill history without typed values; allowlisted model metadata; harmless wait across navigation while mutations remain guarded; current-readiness checks for Back/BFCache recovery; dated-itinerary acceptance that rejects unrelated cheap prices. Actual RED/GREEN evidence is recorded in TDD.md, cycles 47–52.

Causal popup ownership and original POST state are preserved without global-new-tab heuristics or URL replay. Run/session APIs, one-request kind/site/item planning, completion-evidence instructions, the 12-step limit, low-confidence stop, screenshot opt-in and initial-URL shortcut remain. Reference identity is separate from observation/document freshness. Caching reuses candidate membership; geometry, fields and bounded text are reread. Uncertain mutations cause full collection.

The old targetSource test asserted an obsolete option. Its replacement uses real Chromium to verify owned popup continuation, one destination request and survival of an unrelated session. This migration is not represented as a new product RED/GREEN fix.

## Actual acceptance

On the requested VPS: 65 Vitest tests, 22 additional Node checks, typecheck, build, six harness assertions and both ten-case real-relay deterministic suites passed. Native POST/delayed popups and concurrent-session ownership now pass through the actual extension transport.

## Scope precision

Direct fill is implemented; arbitrary compound submission is intentionally excluded. Full/incremental/focused describes collection, not stateful model deltas. Renderer/boundary/screenshot/payload and writer/browser/planner timings are exposed; relay-internal queue and provider compute time are not invented. Rich cross-origin iframe/shadow-root extraction remains outside this lightweight observer.

The exact flight prompt is preserved. Acceptance separately assumes December 2026 and CAD; those assumptions are not attributed to the ambiguous user text. Public testing requires dated itinerary evidence and permits no booking or CAPTCHA bypass. Live provider/public-site results must be reported from the exact Actions run, not inferred from fixture success.

Status: local architecture specification checks passed with these documented limits. External acceptance remains separately reported.
