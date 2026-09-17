# Final follow-through: observed safety regressions

The user waived subagents; implementation and both review passes are performed by the implementing assistant, not independent agents. Work was isolated in a separate review worktree so the active acceptance branch was not overwritten.

## Actual vertical RED/GREEN progression

All commands ran on the Oracle Linux ARM64 VPS through real Chromium. Tests use the public BrowserBoundary interface; the external relay transport is replaced by the real-browser fixture for these focused regressions.

| Behavior | RED | Minimal correction | GREEN |
| --- | --- | --- | --- |
| Credential crossing page-text budget | `vitest run --maxWorkers=1 tests/review-redaction.browser.test.ts`: exit 1; leaked `KNOWNCRED` prefix | Redact each text node before normalization/truncation | Same command: exit 0 |
| Overlapping known credentials | Focused `-t overlapping`: exit 1; `[redacted]-PRIVATE-SUFFIX` | Match longer known values before their prefixes | Both redaction tests: exit 0 |
| Submit button after form destination changes | `vitest run --maxWorkers=1 tests/review-form.browser.test.ts`: exit 1; click resolved instead of rejecting | Include associated form action/method/target/encoding in target signature | Form plus redaction tests: exit 0 |
| Enter after focused field's form changes | Focused `-t "rejects Enter"`: exit 1; Enter resolved instead of rejecting | Record and verify focused element semantic signature | Eight new/existing freshness tests: exit 0; typecheck passed |

An additional redaction-expansion budget assertion passed on first execution. It is regression coverage, not a claimed RED/GREEN fix. Synthetic credential values and loopback/routed fixtures were used; no real credentials or external submissions were involved.

## Integration and review status

The latest remote pacing changes will be preserved through a normal merge. Final full-suite, specification-review, quality-review, and secret-backed acceptance results are recorded below only after their execution. An earlier green local suite does not predeclare a new head green.

## SSE harness readiness

Oracle acceptance run `35271191992` failed 1 of 65 regression tests: the SSE test sent an optional event before the effect installed its listener. The test now waits for listener readiness and dispatches non-optionally. No production UI code, test count, timeout or browser performance threshold is changed. This is a test-fixture race correction, not an invented product RED/GREEN cycle.

## Review stage 1: specification compliance

Performed as a separate pass after implementation. Reviewed the original eight-task plan, current browser/observer/planner/run-controller contracts, the new behavior tests, and the retained remote request-pacing changes.

The four reproduced safety regressions are fixed with narrow changes behind the existing boundary. Stable references remain private and document-scoped; form destination/method changes now invalidate both click and focused Enter actions. Redaction happens before a text budget can reveal a known-value prefix, and longer overlapping known values are considered first. Direct fill, optional versioned screenshots, conservative observation invalidation, the bounded agent loop, real completion evidence and one-request Jev classification remain intact. No source-language rewrite or unrelated UI redesign was introduced.

The final local regression run passed 70 tests across 15 Vitest files and 24 Node checks. Typecheck, production build and six harness-safety assertions passed. The SSE readiness correction preserves all original assertions. Browser/action test thresholds were not relaxed. These results do not predict a public-site or live-provider success.

Scope caveats remain explicit: collection caching is not stateful model deltas; rich cross-origin frame/shadow extraction is not implemented; sensitive-field heuristics are not universal PII detection; arbitrary compound submissions remain excluded. The flight prompt stays exact and its acceptance assumptions are separately labeled. Specification self-review: accepted for the stated architecture scope, with live acceptance separately required.

## Review stage 2: code quality and operational safety

Performed after the specification pass. Re-read the actual observer diff, resolved form ownership behavior, focus validation, fixture cleanup, test-event readiness, workflow secret scope, pinned compatibility patch and merged history.

The changes add no dependencies, public API break, DOM reference attributes or disabled actionability checks. Form signatures remain in a private browser closure; known sensitive values are never added to model packets. Every newly reproduced behavior failed before its minimal correction and passed afterward. The extra already-green budget assertion is not mislabeled as TDD evidence. The SSE fixture waits for the external listener instead of silently discarding its event.

Remote pacing and trace fixes were preserved via a normal merge. Pacing is confined to the verification harness and recorded separately from provider/browser latency; deterministic narration avoids unnecessary billed calls without replacing the real planner or writer. The one-job VPS runner is restricted to this repository, actor, branch and unique label. Only live steps receive model secrets; no credential value is fetched, printed or copied into artifacts. There is no persistent runner service or automatic main merge.

Code-quality self-review: accepted with the documented limits. This is a second self-review, not independent-agent, Copilot or Greptile approval. Exact-head live evidence and any residual failures belong in the PR, not a fabricated all-green declaration.

## Completed native-browser verification

After the combined regression/typecheck/build gates, both `npm run test:e2e:relay` and `node --import tsx .github/scripts/architecture-e2e.mjs --deterministic` exited 0 on the VPS: ten canonical plus ten additional journeys passed through actual Chromium, Browser Control extension and relay. The canonical fixture measured focus-click median 372 ms, redirect navigation 114 ms, and Back recovery 179 ms. These are small controlled-fixture measurements, not a same-run baseline comparison or arbitrary-site speedup claim. Live model and public-flight acceptance is still reported separately against the pushed SHA.

## Live acceptance follow-through: readiness and diagnostics

Exact-head VPS run `35272680392` passed all deterministic gates and 9/10 live journeys, including the multi-field flight fixture. The redirect journey selected six waits without progress. The public flight attempt reached a public page and all 11 provider requests returned HTTP 200, but no fare was verified. Those failures remain preserved; they are not authentication or machine-access failures.

Three further public-boundary tests were observed RED then GREEN: browser observations omitted document/busy readiness; planner requests omitted readiness plus consecutive-wait feedback; public-flight reports reduced low confidence to `browser-or-policy`. The changes add readiness metadata, allowlist it in model state, count trailing waits, and preserve safe diagnostic categories/confidence. The navigation instructions also no longer incorrectly forbid using visible links to navigate. This instruction correction is motivated by the actual live failure; a new model success is not inferred from unit tests.

### Specification review of this follow-through

The exact prompt, confidence threshold, 12-step guard, allowed public domains, no-booking policy, and dated-CAD fare evidence assertions are unchanged. Readiness is advisory, not proof that hydration or all asynchronous work has finished; `aria-busy` represents the page's declared busy state. Wait remains an available action. No action is automatically forced to make a benchmark pass. Public diagnostics expose finite confidence and static failure categories, not raw errors or model credentials. Specification self-review accepted pending verification.

### Subsequent quality review of this follow-through

Reviewed the actual diff after the specification pass. The new fields are optional for compatibility; model state copies only the public readiness fields and drops extra private metadata. Browser state is captured in the same evaluation as the observation. Failure classification reuses the existing helper instead of maintaining a divergent second classifier. Public-fare assertions and action guards were retained. No dependency, iframe privileges, timeout relaxation, or new purchases are introduced. Quality self-review accepted pending complete-suite and exact-head acceptance. Neither review is independent-agent or Greptile approval.

Complete local follow-through verification exited 0 on the VPS: **72 Vitest tests across 15 files**, **25 Node checks**, typecheck, production build, and six harness assertions passed. The two review passes above are accepted for the code change; exact-head live/model and public-fare outcomes remain separately reported, not inferred from these passing checks.

## Recovery and unchanged-fill follow-through

Run `35274185536` passed deterministic gates and 9/10 live journeys, including the formerly stalled redirect and the flight fixture. Its POST-popup trace included a placeholder target, and a real-browser reproduction separately confirmed that a popup arriving during planning was safely rejected but terminated the run. The public flight attempt repeated fills until its writer budget was exhausted; no fare was verified and no provider failed in that attempt.

Six additional vertical RED/GREEN cycles were executed on the VPS: typed pre-dispatch popup invalidation (generic error before, typed error after); controller re-observation (error before, fresh decision after); unchanged direct fill; unchanged focused fill; precise request-budget classification; and recovery from an unavailable placeholder target. The real-browser unchanged-fill tests require zero input events and no submission. An ambiguous-error negative test and a twelve-step recovery-limit test passed as preservation checks, not invented RED cycles.

### Specification review: recovery and unchanged fills

Recovery is permitted only for backend-generated `StaleObservationError` or `InvalidActionTargetError`, each proving no page action was dispatched. A stale document guard returns its structured marker before activation/input; a placeholder reference fails local validation before any browser command. The controller obtains a new observation and a new decision; it does not retry the old action. Physical-action exceptions, uncertain HTTP outcomes and arbitrary error strings remain terminal. Re-observation consumes the unchanged twelve-decision budget.

Unchanged fills compare exact live text after private element/focus validation, return informative no-op feedback, and never submit automatically. Changed values retain Playwright fill/actionability. Public flight budgets, exact user prompt and dated-CAD evidence checks remain unchanged. Specification self-review accepted for this scoped fix, with complete verification recorded separately.

### Code-quality review after specification review

Reviewed both structured boundary outcomes and the narrow controller catch. Error classes are shared in one small module without a circular dependency. No string-matching recovery or trust in page-authored reference attributes was introduced. Handles are disposed on both changed and unchanged fill paths. Static no-op messages omit entered text. Existing invalid-target messages remain descriptive; unsupported actions are not silently converted into another action.

Reviewed cleanup, stop checks, bounded retry decisions, no-op accounting, and the real-browser plus controller regression tests. Request-budget classification reuses the existing safe diagnostic helper. No dependencies, credentials, actionability bypass or raised budgets were introduced. Quality self-review accepted for the patch, pending final complete-suite and exact-head live acceptance; no independent reviewer approval is claimed.
