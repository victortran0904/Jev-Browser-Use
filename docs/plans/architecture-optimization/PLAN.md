# Browser architecture optimization plan

Status: BLOCKED before implementation (required SDD worker unavailable).
Base: `1398bd0bd3c1c327ad9140d92f7351798807511e` (`main`).
Branch: `perf/browser-architecture-20260917`.

## Goal and scope

Implement the architecture optimizations approved in the repository review without a Rust rewrite, changing the UI, or weakening browser action safety. Improve end-to-end task completion, not just individual command throughput. This commit is planning only: none of the optimization tasks below has been implemented.

The user explicitly requested an isolated branch/worktree, pushes to that branch, a PR to `main`, and use of `skills/sdd/SKILL.md` plus `skills/tdd/SKILL.md`.

## Execution gates

1. Start each task on a clean working tree in this worktree, never the user's existing checkout.
2. Dispatch a fresh Codex implementer using the SDD companion and its XML prompt template. No controller implementation edits. Verify the documented model is actually available; do not silently substitute another model.
3. For every behavioral change: one failing behavior test through a public interface, minimal code to pass it, then repeat. Record commands, exit codes, and actual RED/GREEN outcomes as the task progresses. Do not write all tests in one horizontal pass. Refactor only while GREEN.
4. Snapshot HEAD/status before and after dispatch; require a valid `Status:` within the first five output lines and an actual repository change.
5. Review specification compliance first, then code quality, with TDD evidence checked in both reviews. Respect the skill's fix-cycle limits.
6. Run focused tests plus the complete existing test/typecheck/build gates before pushing each accepted task.
7. Keep the PR draft until implementation and independent reviews exist. Apply the referenced Greptile gate when available; never claim a stale or missing review is approved. Do not merge this preparatory PR.

There are no implementation dispatches or RED/GREEN cycles yet. Baseline regression tests are not TDD evidence.

## Public interface strategy

Preserve `createBrowserBoundary()` and its `begin`, `observe`, `open`, `act`, `close` operations as the main integration boundary. Preserve run-controller APIs and existing SSE event names. Extend observation/action metadata additively where possible; keep a self-contained state for every Jev request. Extract focused modules only where they hide substantial complexity behind a small interface.

Mock only external boundaries (relay HTTP/CLI, model endpoints, time). Browser behavior must be exercised using real DOM/browser fixtures, not assertions about strings inside generated scripts. Inspect the installed Browser Control version and wire schema before selecting popup/session APIs; upstream main is not necessarily the installed contract.

## Task sequence

### 1. Safe transport and phase-level timing

Relevant files: `server/browser.ts`, `server/runs.ts`, `server/types.ts`; introduce a narrow transport module only as needed.

First tracer bullet: through `BrowserBoundary.act`, demonstrate that a relay action whose response is lost is not executed a second time through the CLI. Observe the external action effect, not internal function-call counts.

Subsequent behaviors, each with its own RED/GREEN cycle:
- Distinguish proven pre-dispatch unavailability, explicit relay rejection, malformed response, and unknown execution outcome.
- Allow bootstrap/fallback only when dispatch is known not to have happened; never replay ambiguous mutating operations. Do not assume request IDs imply server deduplication unless implemented and verified.
- Preserve session identity, warnings, diagnostics, and target/navigation metadata supplied by the pinned relay protocol.
- Emit transport, renderer extraction, navigation readiness, popup coordination, screenshot, writer, and planner durations where observable. Distinguish unavailable subphase measurements from zero. Do not double-count overlapping spans.
- Keep telemetry free of sensitive input values. Do not attribute writer latency to browser typing.

### 2. Action-aware navigation and run-owned targets

Relevant files: `server/browser.ts`; add a target/session module only if needed behind the existing boundary.

First tracer bullet: an ordinary focus click succeeds without waiting for an unrelated one-second popup deadline, while preserving actionability checks.

Subsequent behaviors:
- Track popup/navigation events for the run rather than blocking every click on a popup timer. Correlate children with the run's opener/target; never capture an unrelated concurrent run's tab.
- Handle delayed popups, redirect chains, popup initially at `about:blank`, opener closure, and relay-owned child sessions.
- Continue in the actual popup/child target rather than reloading its URL in the original tab. Preserve POST-generated and tab-local state. Inspect ownership transfer semantics before deleting sessions.
- Use explicit navigation readiness (`domcontentloaded` plus relevant content/action checks), not universal load/network-idle waits or fixed sleeps. Preserve SPA readiness and recover from destroyed execution contexts.
- Track every run-owned session and clean up only those sessions. Release listeners exactly once. Stop must not resurrect closed sessions or issue later actions.
- Validate target/document identity before action dispatch; allow one mutation at a time per run.

### 3. Bounded DOM extraction and sensitive-field redaction

Relevant files: `server/browser.ts`, `server/types.ts`; isolate the in-page observation collector behind a testable public boundary.

First tracer bullet: an observation never exposes a password field's value through candidates, focused-field metadata, or page context.

Subsequent behaviors:
- Redact password, credential/one-time-code, and payment-related values using conservative field metadata rules before they reach models, events, logs, or cache records. Do not claim complete PII detection from heuristics.
- Reject irrelevant/off-screen geometry before label work; compute accepted labels once; stop detailed inspection at the current 180 accepted-candidate bound.
- Complete layout/style/text reads before reference writes. Do not relabel all DOM nodes on every observation.
- Return title, URL/document identity, field state, and renderer-side duration in a coherent observation. Do not associate old DOM with a new page after navigation.
- Allocate explicit text budgets for active dialogs, main content, field context, and confirmation evidence rather than only taking the first body-text prefix. Keep total payload bounded and never use hidden sensitive text as a faster fallback.
- Preserve useful naming/visibility semantics and test dialogs, horizontally off-screen elements, unlabeled inputs, changed controls, and large pages.

### 4. Stable refs and fresh-action validation

First tracer bullet: the same live element keeps its identity across observations in one document, while a removed/replaced element cannot inherit permission to execute an old action.

Subsequent behaviors:
- Separate element identity, observation identity, document epoch, and target identity.
- Reject navigation/target changes, disconnected nodes, changed meaningful target identity, stale focused fields, and now-disabled controls before dispatch.
- Avoid memory leaks by clearing document-scoped state and releasing target listeners; prevent page-authored attributes from becoming trusted authorization.
- Preserve browser actionability checks. Stable refs must not authorize changed semantics.

### 5. Incremental and focused observations

First tracer bullet: a focus/value-only interaction returns updated field state while keeping equivalent unchanged page context, without a full detailed rescan.

Subsequent behaviors:
- Full observation on new document, target change, broad/unknown invalidation, or recovery.
- Dirty-region observation when the affected area is known; focused refresh for stable field interactions.
- Invalidate for relevant DOM mutations, navigation, scrolling/resizing, focus/input changes, and uncertain layout changes. MutationObserver alone is insufficient. Re-read live form properties because programmatic value updates need not mutate attributes.
- Fall back to a full scan conservatively when correctness cannot be established; do not turn every mutation into synchronous scan work.
- Preserve equivalent current observations and completion evidence; cache collection work, not an assumed stateful model conversation. Revalidate the action target immediately before use.

### 6. Compact, self-contained planner/writer input

Relevant files: `server/planner.ts`, `server/writer.ts`, `server/types.ts`.

First tracer bullet: the planner receives the necessary current candidate choices and relevant page context without repeating the complete candidate list in both inputs.

Subsequent behaviors:
- Separate candidate choices from page context. Keep kind/site/item classification in a single Jev call unless a measured, supported alternative is approved.
- Preserve focused field metadata, untrusted-page policy, recent action history, dialog state, and visible success evidence.
- Keep writer input useful after snapshot restructuring; redact before either model boundary.
- Bound payload size; record bytes/candidate counts without logging sensitive content.
- Preserve old observation consumers through an explicit compatible migration rather than silently dropping data.

### 7. Safe run-loop shortcuts and screenshots

First tracer bullet: an explicit initial URL opens without a needless model call or expensive empty-page scan, while preserving the initial run event contract and neutral-session safety.

Subsequent behaviors:
- Introduce a narrowly bounded fill-by-observed-target operation to avoid a separate focus planning cycle, validating target and field eligibility at execution time.
- Permit compound search submission only when the user's goal explicitly authorizes it and the form is safely identified. Never create general arbitrary click chains or automatic consequential submissions.
- Keep screenshots optional (already disabled by default). Capture only when requested or needed for diagnostics, bind them to an observation version, and never show a stale image as the current state.
- Avoid uncancelled screenshot work, close/stop races, and action execution after stop. Preserve run limits and completion-evidence requirements.

### 8. Regression, benchmark, and final review

Add reproducible real-browser fixtures for fast same-page actions, delayed popup, redirects, SPA updates, DOM replacement during planning, POST popup state, concurrent-run isolation, sensitive fields, and ambiguous relay responses. Replace implementation-string assertions that currently lock in popup delays and URL mirroring.

Report separately:
- Existing regression tests, new focused tests, typechecking, and production build.
- Synthetic DOM median/p95 with identical fixtures and candidate/output equivalence assertions.
- Cold versus warm session end-to-end time and task success rate with the actual extension/relay where available.
- Model latency, transport/queue time, browser extraction, and readiness waits. Do not compare a less-verified action path against a fully verified baseline as a speed improvement.

No paid inference, external-site side effects, or real user-browser mutations are required for the deterministic test suite. Live extension verification requires an explicitly available test browser. Record unavailable tests as NOT RUN, never PASS.

## Completion definition

Each task has a genuine implementation commit, RED/GREEN evidence, spec approval, quality approval, and verification results. The final PR documents behavior changes, actual measured performance, known limitations, rollout/rollback controls, and review status for its exact head. Passing the unchanged baseline does not satisfy this definition.
