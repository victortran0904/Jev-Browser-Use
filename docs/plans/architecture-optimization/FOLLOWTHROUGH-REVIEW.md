# Follow-through review: shared model state and bounded recovery

Base reviewed: `d7514789cdc7755883a9e6ab24b0e58d7958db70` plus this commit's changes.
The user explicitly waived subagents. These are separate self-review passes by the implementing assistant, not independent-agent or Greptile approvals.

## Stage 1 — specification compliance

Reviewed the approved architecture plan, current observer/browser/planner/controller contracts, the latest live failures, and the new public-interface regressions.

TypeSafe evaluates questions independently against shared state. Control descriptions previously lived only in the sibling item question. The planner now places safe control semantics once in `page.controls`; item criteria contain only refs with SDK-supported null descriptions. Kind, site and item remain one request. The existing assertion that a candidate label appears once still passes. Navigation readiness and consecutive-wait feedback from the newer remote commit are retained.

A document/focus guard may now return a structured pre-input rejection. The boundary turns only that explicit result into `StaleObservationError`. The run controller can reobserve and replan at most twice, consuming the unchanged step budget. It does not repeat the old action. Other target-resolution errors, transport errors and uncertain outcomes still fail closed.

Specification self-review: accepted for these changes. The live/public-flight tests still require fresh execution; passing deterministic fixtures is not proof of a real fare or universal agent reliability.

## Stage 2 — code quality and safety

Re-read the actual patch after the specification pass, including session prelude, transport fallback, the structured result conversion, control serialization, event emission and all new tests.

The typed rejection is produced before target activation or browser input, and is not inferred from error-message text. An error containing the word `stale` is explicitly tested to stop without retry. A third genuine pre-input rejection stops the run. Stop guards and the twelve-step limit are unchanged. Only allowlisted control metadata reaches the models; private DOM signatures remain in the observer closure.

No dependency, skill, UI, verification threshold, flight-evidence assertion or secret-handling policy is changed. The newer remote readiness commit was preserved by a fast-forward plus resolved local patch, with the original patch/stash retained outside committed source. No force push or main-branch mutation occurred.

Code-quality self-review: accepted with the existing documented limitations. Two new already-green defensive cases are regression coverage, not claimed RED/GREEN cycles. A fresh exact-head live run is required before making any live-acceptance claim.

## Actual vertical TDD evidence on Oracle VPS

| Public behavior | RED | Minimal correction | GREEN |
| --- | --- | --- | --- |
| Independent action question can see the observed navigation control | `tests/planner.test.ts` failed: returned `wait` instead of `click_item` | Move control semantics into shared state without duplicating descriptions | Same test file passed; existing compactness/privacy cases preserved |
| Stale document before input has an explicit safe-to-refresh outcome | `tests/state-recovery.browser.test.ts` failed: generic `Error` | Structured pre-input guard result becomes typed boundary error | Same real-Chromium case plus four freshness cases passed |
| Controller reobserves/replans after proven pre-input rejection | `tests/state-recovery.test.ts` failed: run ended in error | Bounded typed recovery, fresh observation and new plan | Same case passed with one actual activation and visible completion |

Each RED command exited 1 and each corresponding GREEN command exited 0. Raw local command output is retained in `evidence/followthrough/` outside the repository. The null-criteria compacting refinement occurred after the first GREEN cycle. Additional unknown-outcome and repeated-staleness cases passed initially and are recorded only as regression coverage.

## Completed local verification

- `npm test -- --maxWorkers=1`: 77 tests in 17 files passed.
- `node --import tsx --test --test-concurrency=1 integration/*.checks.mjs`: 25 checks passed.
- Typecheck, production build, and six credential-free harness checks passed.
- `npm run test:e2e:relay`: ten canonical journeys passed through actual Chromium, extension and relay.
- `architecture-e2e.mjs --deterministic`: ten additional journeys passed through the same actual browser stack.
- Small-fixture measurements: focus-click median 103 ms, redirect navigation 72 ms, Back recovery 136 ms. These are local controlled-fixture results, not an original/optimized same-run comparison or arbitrary-site speedup claim.

All seven final verification commands completed with exit code 0. Public-flight acceptance, live model outcomes and their exact pushed SHA are reported separately in the PR after execution.
