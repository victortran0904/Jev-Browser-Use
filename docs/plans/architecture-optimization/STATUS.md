# Architecture status — September 17, 2026

Implementation branch: `perf/browser-architecture-20260917`; PR #1 targets `main`. Main is unchanged. The PR remains draft because real public-flight acceptance is not complete and no independent external approval is claimed.

## Implemented and recovered

The architecture changes include run-owned event-driven popup handling without URL replay; explicit navigation/Back readiness; bounded cached DOM membership with private stable references; dialog scope and declared editor readiness; document, target, focus and associated-form freshness; sensitive-value redaction; compact shared Jev control state; direct/unchanged fills; typed pre-dispatch recovery; and renderer/boundary/model phase metrics.

The previously interrupted local-only diagnostics, extra airport-option tests and review notes were reconciled and pushed in the recovery commits through `61e09bc`. The obsolete experimental collector is archived, not active. All original worktrees were clean and matched their intended branches when this final continuation began.

The final writer patch requests a native JSON output schema, rejects incorrectly typed model decisions instead of coercing strings to booleans, accepts omitted optional explanations, and retries a typed model timeout once on the same model. It never retries browser input and does not retry cancellation. See `COMPLETION-REVIEW.md` for actual RED/GREEN progression and both review stages.

## Completed Oracle VPS verification

| Gate | Result |
| --- | --- |
| Vitest | 108 tests across 27 files passed |
| Node integration checks | 27 passed |
| Typecheck and production build | Passed |
| Credential-free harness assertions | Six passed |
| Canonical real-extension browser journeys | 10/10 passed |
| Additional real-extension deterministic journeys | 10/10 passed |

All seven verification commands exited 0 on Oracle `free`. Controlled timings: focus click 112 ms median, redirect navigation 101 ms, Back recovery 143 ms. These are not a paired baseline comparison or a guarantee for arbitrary sites. Raw logs are retained outside source control under `evidence/final-completion/schema-final/`.

## Live acceptance and remaining limits

The completed hosted checkpoint `61e09bc` passed all ten live Jev/Gemini fixture journeys; its separate public flight attempt failed with a Gemini timeout. The final pushed head's fresh hosted results belong in PR #1, tied to the exact Actions run. Hosted inference results must not be presented as Oracle runs. No real qualifying flight is claimed from synthetic fixtures.

Original public prompt: `find me a flight from hanoi to vancouver in  december for less than 2,500$`. Acceptance separately assumes December 2026, CAD, one-way economy and one adult. No booking, payment/account entry or CAPTCHA bypass is permitted. The public-site task remains a separate acceptance gate, not an automatic pass when the agent stops.

An optional production per-attempt model-deadline experiment was blocked before implementation. Its failing test is explicitly archived in `archive/deferred-writer-deadline.test.ts.txt`; it is not counted among active passing tests. Existing harness request deadlines remain. The shipped retry bounds attempts, not total production request duration.

The observer remains lightweight rather than a complete cross-origin frame/shadow accessibility engine; field-sensitivity and modal-selection heuristics have documented limits. Arbitrary compound submissions were intentionally not introduced. A failed real-site task is not evidence of a successful fare search.

## Review, installation and cleanup

The user waived subagents. Specification self-review preceded code-quality/safety self-review, with evidence in `TDD.md`, `RECONNECTED-REVIEW.md`, `COMPLETION-REVIEW.md` and the earlier reconciliation records. No independent-agent, Copilot or Greptile score is claimed.

For an existing installation: `npm ci`, reload the bundled Browser Control extension and restart the relay. The popup compatibility patch is pinned to Browser Control 0.7.1 and must be re-reviewed on upgrade.

Model secrets stay in the existing GitHub Actions secret mechanism; no values were printed or extracted. Local Oracle tests did not use them. No temporary runner registration or runner directory remained at the final-continuation check; no new runner was provisioned. Final GitHub checks and any remaining public-site failures are reported in the PR, not hidden behind historical passing results.
