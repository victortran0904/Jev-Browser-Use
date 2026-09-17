# Review stage 2 — reconciled code quality and operational safety

Performed by the implementing assistant after the separate specification review. The user waived subagents; this is a second self-review, not an independent or Greptile approval.

## Review findings and resolutions

- Preserved both divergent commit histories with a normal two-parent merge and checkpoints, rather than force-pushing over remote work.
- Consolidated on the real-relay-tested typed observer; removed the unused alternative collector. Moved legacy read-only target diagnostics out of production server code into integration tests.
- Integrated remote action-availability and model-state allowlisting improvements with the canonical direct-fill path; preserved behavioral regression coverage instead of obsolete internal interfaces.
- Fixed the observed Back/BFCache event-wait delay using current document readiness. Harmless waits no longer require a stale document, but keyboard/input actions do.
- Retained private handles, action-time semantic/focus checks, one physical-input queue, unknown-outcome rejection and child-environment credential isolation.
- Avoided copying the already cached candidate array after tests were green; reran both real-relay suites after this refactor.
- Verified the Browser Control 0.7.1 popup patch twice for idempotence; it remains version-checked and fails closed when the expected source contract changes. No broader extension permissions or arbitrary user-tab attachment.
- Tightened flight acceptance: a hotel price, generic currency, undated month or configured search budget cannot pass as a dated flight. The original prompt remains exact; acceptance assumptions are reported separately.
- Reviewed the VPS workflow: exact repository/actor/branch gating, unique non-default runner label, one-job registration, read-only checkout, no credential persistence, model keys scoped only to live test steps, selected metadata artifacts only. No persistent runner service was installed. Remove its private directory after completion.
- Hosted paid runs require explicit opt-in so the VPS acceptance run does not silently duplicate provider usage.

## Verification

65 Vitest tests and 22 additional Node checks passed, as did typechecking, build and six harness assertions. Both ten-case deterministic suites passed through the actual extension/relay on Oracle Linux ARM64. Diff whitespace and harness syntax checks passed. This document does not predeclare live providers or public-site verification successful.

## Known limits

Field sensitivity detection is heuristic, not universal PII detection. Rich iframe/shadow-root extraction is not added. The patch requires extension reload and relay restart in an existing installation and re-review on dependency upgrade. Exact-head provider and public-flight outcomes are recorded in the PR; a CAPTCHA, model failure or missing dated fare remains a failed exploration. No automatic merge or external review score is claimed.

## First exact-head Actions attempt

Oracle run 35270000518 stopped at regression: 59/65 passed, with concurrent browser startup/test timeouts and a timing threshold failure. No provider secrets were used. The follow-up schedules Vitest with one worker on this shared VPS only; no test is removed and no explicit timing/assertion threshold is relaxed. The same exact clean checkout passed all 65 tests with one worker, with the 800 ms focus and 1,200 ms navigation thresholds unchanged. Both review stages accept this scheduling-only change; the original failed run remains visible. This is a harness scheduling adjustment, not a claimed application RED/GREEN fix.
