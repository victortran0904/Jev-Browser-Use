# Completion review — September 17, 2026

Resumed from `61e09bcdefc1fc16a8b17ce78acbfaf8574f09d4`. Oracle `free` command access was verified. Both active worktrees matched the published head and were clean; earlier local-only recovery work had already been reconciled and pushed. The old experimental worktree is also clean, and its superseded prototype is archived rather than used in production.

## Stage 1 — specification self-review

The user waived subagents, not test-first changes or either review stage. This is a separate self-review, not independent approval.

Reviewed the approved architecture plan, recovered changes, latest hosted acceptance report, and actual writer/retry patch. The latest completed hosted checkpoint passed all ten live-model fixture journeys; its public flight task ended on a Gemini timeout. Fixture success is not a real fare.

Three new vertical RED/GREEN cycles exercise the public writer through the real Google SDK with only HTTP mocked:

| Behavior | RED evidence | Minimal change | GREEN evidence |
| --- | --- | --- | --- |
| String-valued `fill: "false"` must not authorize input | `writer-schema-RED.txt`, exit 1; unsafe true returned | Validate decision and payload types | `writer-schema-GREEN.txt`, exit 0 |
| String-valued `ok: "false"` must not authorize navigation | `url-schema-RED.txt`, exit 1; URL returned | Validate URL response types | `url-schema-GREEN.txt`, exit 0 |
| One typed model timeout can recover without switching model | `model-timeout-RED.txt`, exit 1 | One same-model inference retry | `model-timeout-GREEN.txt`, exit 0 |

Raw command output is under the VPS's `evidence/final-completion/` outside source control. Additional tests preserve correctly typed decisions, verify at most two requests for repeated timeouts, and verify cancellation is not retried. They passed initially and are not claimed as additional RED/GREEN cycles.

No browser mutation is retried. The original browser action limit, confidence threshold, stale-state bounds, model selections, flight prompt, fare acceptance and request ceilings are unchanged. Invalid structured decisions fail closed instead of being coerced. Specification self-review accepts this scoped patch, subject to full verification.

## Explicitly deferred experiment

A new experimental test for a production per-attempt writer deadline failed as expected. The implementation command was blocked by a tool safety check before execution and was not retried through another route. No deadline implementation was applied. Its test is preserved as `archive/deferred-writer-deadline.test.ts.txt`, explicitly NOT an active passing test. The real RED log is `writer-deadline-RED.txt`. Existing harness deadlines remain; do not claim production model requests now have a new elapsed-time bound.

## Stage 2 — code-quality and safety self-review

Performed after the specification pass. Re-read both changed production files and the new external-HTTP tests, and checked every caller of `withGeminiFallback` (writer and narrator only). Neither caller executes browser actions inside the retry callback. The second inference attempt is returned directly, so a second failure cannot recursively retry or cascade through another fallback. Cancellation and authentication failures remain terminal; the pre-existing availability fallback and environment model overrides remain covered.

Writer decisions now require actual booleans and string payloads. Correctly typed `false` stays false. This changes no public method signature, dependency, browser privilege or field-eligibility check. The tests use synthetic credentials and intercept the HTTP boundary; they do not contact a model service. No model response, credential or page profile is added to logs.

A timed-out inference may still have consumed provider resources; a retry can incur another charge. Attempt counts, rather than a new production wall-clock guarantee, are bounded here. The explicitly deferred deadline experiment is not included in passing-test totals. It was preserved with its failure evidence rather than silently called complete.

Both review stages are self-reviews under the user's waiver. GitHub currently has no independent PR reviews; no Greptile score or merge-ready approval is claimed. Full Oracle verification and exact-head hosted secret-backed results are recorded below only after execution.

## Completed Oracle verification

All seven verification commands completed with exit 0 on `free` after the applied patch and both review passes:

- `npm test -- --maxWorkers=1`: **105 tests in 27 files passed**.
- `node --import tsx --test --test-concurrency=1 integration/*.checks.mjs`: **27 checks passed**.
- `npm run typecheck` and `npm run build`: passed.
- `node --import tsx .github/scripts/live-validation.mjs --self-test`: six assertions passed.
- `npm run test:e2e:relay`: all ten canonical journeys passed using actual Chromium, extension and relay.
- `node --import tsx .github/scripts/architecture-e2e.mjs --deterministic`: all ten additional journeys passed through the same browser stack.

Controlled fixture timings were **152 ms focus-click median**, **76 ms redirect navigation**, and **134 ms Back recovery**. These are not paired before/after comparisons or universal website latency claims. Raw results remain in `evidence/final-completion/`. No model secrets were used in these Oracle checks.

The hosted secret-backed run for the final pushed head is recorded in PR #1 after execution. Its outcome must not be inferred from the local suite. No temporary self-hosted runner was provisioned during this continuation; earlier provisioning restrictions were not bypassed. No runner registration or temporary runner directory remained when checked.

## Follow-through: optional explanations and provider output schema

The exact-head hosted run at `501cc43` completed with artifacts. Regression/build/invariants and deterministic journeys passed. Live fixtures passed 7/10: two writer-stage runtime failures and one low-confidence stop; the public flight attempt stopped at confidence 0.28. These failures remain recorded in run `35286464623`. Raw provider bodies were not logged, so missing explanations are not asserted to explain every live failure.

Code review found the new runtime validation unnecessarily required the optional `reason` explanation. Two additional public-writer tests reproduced rejection of valid text and URL decisions with that field omitted. Minimal fixes keep decision booleans and payload strings strict while defaulting a missing explanation to empty text. Each test was observed RED then GREEN (`optional-reason-*` and `optional-url-reason-*`).

A third RED/GREEN test verifies the actual provider HTTP contract for both writer methods: the SDK now sends `responseJsonSchema` with a boolean decision, string payload and optional explanation. Runtime validation remains as a separate safeguard. This uses the existing installed Google SDK, adds no dependency and does not change model selection, generation limits or browser actions. Evidence: `provider-schema-RED.txt` and `provider-schema-GREEN.txt`.

### Follow-through stage 1 — specification review

Reviewed the exact writer/test diff against the existing public contract. Missing optional explanations no longer invalidate otherwise usable decisions. Malformed decision flags still cannot become permission through truthiness coercion. Native output schemas request the intended structure from the provider rather than relying solely on a prose instruction. The exact flight prompt, acceptance checks, 12 decisions, two pre-dispatch refreshes, confidence threshold and provider budgets remain unchanged. Specification self-review accepts these compatibility and output-format corrections.

### Follow-through stage 2 — code-quality and safety review

After the specification pass, reviewed schema construction, SDK request serialization, default handling and preserved negative tests. The schema fields are static internal choices, not page-controlled data. Both methods keep their existing API. Explanations remain optional in the TypeScript type and external schema. No raw error/response content is added to logs; only synthetic credentials are used by tests. The output schema is not treated as proof of semantic correctness, and action-time browser validation remains mandatory. The only GREEN refactor tightens the HTTP packet test's type instead of using `any`. Quality self-review accepts the patch, pending fresh complete-suite and exact-head acceptance results. Neither pass is independent-agent or Greptile approval.

The corrected implementation passed all seven local verification commands on Oracle `free`: **108 Vitest tests in 27 files**, **27 Node checks**, typecheck, build, six harness assertions, and both ten-journey real-extension suites. Evidence is under `evidence/final-completion/schema-final/`. Small-fixture results: **112 ms focus-click median**, **101 ms redirect navigation**, **143 ms Back recovery**. No assertion or confidence threshold was relaxed. These local results do not predeclare a new hosted live/public-flight pass.
