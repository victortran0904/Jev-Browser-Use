# Reconnected completion — September 17, 2026

Base: `9775bbb3e6d8e9b6b3829ef2620074b502ec70f6`. The user waived subagents, not TDD or either review stage. All work below used the requested Oracle `free` VPS.

## Recovery

The uncommitted `final-review` patch was preserved in a named stash plus evidence copies. The worktree fast-forwarded to the published branch; the already-published option selector was not reimplemented. The extra hidden-option regression, numeric flight diagnostics and review notes were recovered. Their focused tests passed. An orphaned disposable Chromium from the interrupted job was stopped only after matching its exact temporary profile path. Previous allowlisted JSON reports were recovered before any runner cleanup.

## New vertical TDD cycles

Each RED was an actual exit 1 before the minimal code change; each GREEN was an exit 0 afterward. Tests exercise the public BrowserBoundary with real Chromium and an external relay fixture.

| Behavior | RED/GREEN evidence under `evidence/reconnected/` |
| --- | --- |
| Select-only combobox can be observed and selected, not filled | `combobox-RED.txt`, `combobox-GREEN.txt` |
| Active modal excludes background controls, dismissal restores them | `modal-RED.txt`, `modal-GREEN.txt` |
| Dialog name supplies context for a field named “Where else?” | `modal-context-RED.txt`, `modal-context-GREEN.txt` |
| A modal opening after planning prevents an old background fill | `modal-freshness-RED.txt`, `modal-freshness-GREEN.txt` |

Real public-page inspection reproduced non-input trip-type comboboxes, a modal named “Enter your origin,” and background fields still represented while that modal was open. These observations motivated generic control support and scope handling, not flight-specific scripted actions or fabricated prices. The initial implementation used `findLast`; typechecking caught the older configured library target, so the equivalent ES2022-compatible lookup was used instead.

## Stage 1 — specification self-review

Compared the recovered patch and new collector changes with the approved architecture plan. The public boundary, model APIs, candidate bound, private identities, semantic checks and existing input actionability remain. Select-only dropdowns are clickable, not incorrectly advertised as editable. Declared active modals constrain the candidate set; live action resolution rechecks that scope. The dialog name is redacted before truncation. Flight diagnostics contain counts and indices rather than labels, input contents or raw model responses. Original prompt, fare checks, confidence threshold and request/decision budgets are unchanged.

The harness now starts with a reproducible 1280×900 window. A manual `public-flight` scope avoids rebilling the entire live suite during diagnosis; full verification remains the default and is required for final acceptance. This is configuration, not a claimed RED/GREEN application fix. Repository, actor, branch, one-job runner and secret-scoping restrictions remain intact.

## Stage 2 — code-quality and safety self-review

Performed after the specification pass. Re-read the actual collector, action-time resolution, diagnostic serialization and workflow diff. No dependency, UI, model substitution, forced action, raised action budget, or weakened fare-evidence assertion was introduced. Modal discovery uses native modal dialogs or explicitly modal ARIA dialogs that have visible geometry, preferring the one containing focus. Non-modal dialogs do not unnecessarily remove other controls. Resolution rechecks scope rather than trusting a previously collected candidate. Existing element-handle disposal and sensitive-field checks remain intact.

The recovered extra airport test is retained rather than duplicating the already-shipped implementation. The four new behaviors have real RED/GREEN evidence; recovered historical cycles are not claimed as newly performed. TypeScript compatibility was fixed without changing the compiler target. Diagnostics use numeric counts/indices only. Public-only runs are diagnostic checkpoints, not substitutes for a final full run. The actual browser window changes only the disposable test environment, not the user's browser.

Known limits: arbitrary unannotated overlays and complete cross-origin frame/shadow accessibility are not implemented. Multiple declared modals use focus and DOM ordering, not a universal z-index solver. Both stages are self-reviews under the user's waiver, not independent-agent or Greptile approval. Specification and quality review accept this scoped patch; exact-commit external results must still be recorded from execution.

## Completed local verification

The reconciled code passed 92 Vitest tests in 24 files, 27 Node integration checks, typechecking, production build and six harness-safety assertions on the VPS. No test or performance assertion was removed or relaxed. The first self-test invocation omitted the TypeScript loader and failed module resolution; rerunning the documented entry point with `node --import tsx` passed. That command mistake is not represented as a product regression or hidden behind an all-green first attempt. Both review stages accept the patch for publication; final live/public-site results remain separate.

## Live follow-through: pre-input target-resolution races

The full VPS run at `440e43b` passed every regression/build check, all twenty deterministic browser journeys and all ten live Jev/Gemini fixture journeys. Its separate public flight attempt stopped on stale state after a dialog changed during model writing. All provider requests in that run succeeded; a successful fixture is still not a verified public fare.

Three further vertical RED/GREEN cycles verify that a changed direct-fill field, changed focused field, and replaced click target return a typed non-dispatched rejection. Each test first failed with a generic boundary error, then passed after narrowing recovery to the read-only handle-resolution phase. Logs are `field-resolution-*`, `focus-resolution-*`, and `click-resolution-*` under the reconnection evidence directory. Existing uncertain-outcome and maximum-two-refresh tests also passed.

### Follow-through stage 1 — specification review

The previous guard covered document changes but not a field/modal/target change detected during subsequent private element resolution. Only that pre-input resolution is now converted into the existing structured non-dispatched result. The controller must obtain a new observation and decision; it does not replay a previous action or reuse its generated text. The original two-refresh, twelve-decision, confidence and provider-budget limits remain unchanged. No exception from the actual click/fill or its disposal is classified as safe to replay. Specification self-review accepts this bounded recovery correction.

### Follow-through stage 2 — code-quality and safety review

After the specification pass, reviewed both fill scripts and the click script. The recoverable catch encloses only private element resolution; actual click/fill and handle disposal are outside it. A transport failure that prevents the boundary from receiving a valid structured outcome still remains uncertain and terminal. No error-message matching, automatic input replay or reuse of stale generated text was added. The controller's existing two-refresh cap and stop checks are preserved. Shared-error identity, JSON serialization, live sensitivity checks, unchanged-value detection and handle disposal remain intact. Code-quality self-review accepts the scoped change; this is not external reviewer approval.

The full local suite passed **95 tests in 25 files** and **27 Node checks**. Typechecking caught a test fixture's missing HTMLInputElement annotation; after correcting only that annotation, all three focused browser regressions, typecheck, build and six harness assertions passed. Raw command logs preserve both the failed typecheck and corrected run.

The older dirty `e2e-worktree` was also inspected and archived: its superseded page-global whole-snapshot cache is preserved as an explicitly non-production patch under `archive/`. Its useful behaviors already exist in the selected private-reference/membership-cache implementation. All current source fixes and the archival evidence are included in this commit; no superseded collector is reintroduced.

## Action-aware editor readiness

The public run at `35ffcc0` progressed through both origin and destination suggestions but exhausted the two-refresh limit on later editor changes. A fresh credential-free public-page timing probe found that an airport pop-up became visible approximately 350 ms after filling its declared combobox; observations collected before that still described the background form.

Two further real-browser RED/GREEN cycles reproduce a declared delayed editor after direct filling and focused typing. Each failed before implementation and passed after adding bounded observation of the declared editor's expansion/focus transfer. Evidence: `editor-readiness-RED/GREEN.txt` and `editor-focus-RED/GREEN.txt`. A separate ordinary-field regression passed initially and verifies no unrelated popup deadline; it is not claimed as an additional RED/GREEN fix.

### Editor-readiness stage 1 — specification self-review

Only controls declaring a combobox role or dialog/listbox popup use a bounded readiness window. Plain fields resolve immediately. The condition watches expansion, disconnection or a visible focus transfer and stops as soon as it is satisfied; the 750 ms ceiling does not become a fixed sleep. This is advisory UI readiness, not proof that all asynchronous results have loaded. No input is repeated, no option is automatically selected, no form is submitted, and the agent's decision/recovery/provider budgets are unchanged.

### Editor-readiness stage 2 — code-quality/safety self-review

Reviewed both fill scripts and the shared readiness fragment after the specification pass. The readiness check is outside the pre-input recovery catch, so errors after a dispatched fill cannot be mislabeled as safe to replay. Only the optional readiness deadline is tolerated; other browser failures propagate. Element handles are still disposed in `finally`. Tests preserve unchanged-fill behavior and verify ordinary-field latency rather than weakening the prior navigation/focus assertions. This is a second self-review, not an independent-agent or external approval.

The final native-browser verification also passed both ten-case suites on Oracle `free`, using the real Browser Control extension and relay. Controlled-fixture measurements: focus-click median 124 ms, redirect navigation 82 ms, Back recovery 145 ms. These are not a paired baseline comparison or universal website speedup.

### Final CI portability review

Provisioning a new temporary self-hosted runner was blocked by the platform; the denied provisioning action was not retried. VPS command access remains healthy. Final secret-backed verification therefore uses the existing GitHub-hosted workflow, separately labeled from completed Oracle testing. Review found its Chromium installation came after tests that now require Chromium. The config-only change moves installation before tests and serializes browser checks. Specification review confirms no tests, assertions, budgets or secret restrictions were removed. Subsequent quality review confirms unchanged pinned actions, repository/branch gates, read-only checkout and secret scoping. Hosted CI results must not be described as Oracle VPS results.
