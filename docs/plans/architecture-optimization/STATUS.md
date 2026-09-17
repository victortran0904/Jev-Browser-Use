# Architecture implementation status — September 17, 2026

The architecture code is implemented and tested on the requested Oracle VPS (`free`, Oracle Linux ARM64). Both divergent implementation histories are retained via a normal merge. No application change has been merged to `main`.

The user explicitly waived subagents. TDD was followed, and specification review preceded a separate quality self-review. No independent-agent or Greptile approval is claimed. The former missing-Codex blocker no longer applies.

## Actual local acceptance

65 regression tests in 13 Vitest files: PASS. 22 additional Node checks: PASS. Typecheck/build: PASS. Six harness assertions: PASS. Ten canonical and ten additional merged browsing journeys: PASS through actual Chromium, extension and relay.

Back recovery was observed RED at 8,112 ms and GREEN at 146 ms after replacing an absent-event wait with current document readiness. The final complete suite measured 209 ms. This is fixture evidence, not a universal website speedup.

See TDD.md, RECONCILIATION.md, REVIEW-SPEC-FINAL.md and REVIEW-QUALITY-FINAL.md for progression, review findings and limits. Historical review files are not current approval of a different implementation.

## Secret-backed VPS acceptance

A private, unique-label, one-job Actions runner lets GitHub inject `GEMINI_KEY` and `TYPESAFE_API_KEY` into only the live test steps on this VPS. Credentials are not extracted or printed. No persistent runner service is installed; its private work directory must be removed after completion.

The job reruns deterministic acceptance before live-model journeys and the exact public-flight prompt. Results are recorded in PR #1 against the exact tested head; this file does not anticipate a pass. No real fare is inferred from a synthetic fixture. No booking or CAPTCHA bypass is allowed.

## Installation and remaining limits

Run `npm ci`, reload the bundled Browser Control extension, and restart the relay before using this branch in an existing browser. Native-popup compatibility is pinned to Browser Control 0.7.1, idempotently patched and re-review-required on upgrade. No arbitrary user tab is attached.

The observer remains lightweight rather than a complete iframe/shadow-root accessibility engine. Public-site and provider reliability are separate from deterministic architecture correctness. PR remains open; no automatic merge or external review score is claimed.

## Final hardening follow-through

`FINAL-HARDENING.md` records four additional genuine RED/GREEN safety fixes (redaction boundaries/overlap and stale form click/Enter), five added regression tests, and a separate specification then quality self-review. Current local regression totals are 70 Vitest tests in 15 files and 24 Node checks; typecheck, build and six harness assertions passed. Exact-head native-relay and secret-backed results are reported separately in PR #1; earlier failed CI attempts remain visible. No independent reviewer or Greptile score is claimed.
