# jev-ultrafast follow-through review — September 19, 2026

Reference inspected: `browser-use/jev-ultrafast`, linked by Gregor Zunic's X post. This is a design reference, not copied wholesale. The user waived subagents but retained TDD plus specification review followed by quality/safety review.

## Observed reference patterns

The reference's recorded Google Flights example uses 17 Jev decisions for 11 browser actions. It gives click/type/select operations separate speculative target heads, treats a typed autocomplete query as incomplete until a visible suggestion is selected, waits briefly for relevant UI state after input/click, and separates model-decision budget from browser-action budget.

Our preceding public trace stopped after typing an airport because no option was visible and Jev proposed Enter at 0.25 confidence. The 0.30 threshold correctly prevented dispatch.

## Vertical RED/GREEN cycles

| Behavior | RED | Minimal correction | GREEN |
| --- | --- | --- | --- |
| Low-confidence action while page changes | archived test reproduced terminal error | re-observe read-only; replan only when state actually changed, max two refreshes | focused test passes; low-confidence action never dispatched |
| Delayed autocomplete option | option delayed 500 ms was absent | combobox readiness waits for a visible owned option within existing bounded readiness window | option observed before next decision |
| Operation-specific target selection | planner expected missing generic `item` head | separate `click_target` and editable-only `fill_target` heads | fill action selects only editable ref |
| Model-vs-browser budget | 14-decision/12-action dynamic flow hit old 12-step ceiling | allow 24 decisions while hard-capping browser actions at 12 | dynamic flow completes; separate preservation test blocks action 13 |
| Post-click modal transition | next observation still saw disappearing modal | wait at most two animation frames or 50 ms | fresh background state observed |

The public-flight harness now mirrors the 24-decision ceiling while retaining the runtime's 12-browser-action cap and eight writer-call limit.

## Stage 1 — specification self-review

The changes address the observed failure mode without lowering the confidence threshold, forcing an action, scripting flight-specific targets, increasing browser mutations, or permitting booking/account/payment actions. Low-confidence recovery performs only an observation and requires a changed state before replanning. If the state is unchanged, confidence below 0.30 remains terminal.

Operation-specific target heads stay in one TypeSafe request and use the already allowlisted shared control semantics. The fill head contains only editable non-sensitive fields; action-time freshness and actionability remain mandatory.

The decision/action split increases reasoning opportunities, not browser authority: no more than 12 browser boundary actions can execute. The public test can ask up to 24 planning questions but still cannot exceed that production action cap.

Flight-result evidence now accepts the real Google Flights rendering pattern where route/date state and fare are split across DOM text/controls, but only in explicit result context with the searched route/date and a CAD fare below 2500. Existing negative currency/limit tests remain.

Specification self-review: accepted for the public flight-search goal and original architecture constraints, pending clean full verification and fresh secret-backed execution.

## Stage 2 — code-quality and safety self-review

Reviewed the complete production diff after the specification pass. The autocomplete wait is conditional on declared editor semantics; ordinary text fields do not pay the delay. The click settle is bounded by two animation frames or 50 ms and does not replace navigation readiness. Neither path repeats input.

Low-confidence state comparison includes document identity, URL, snapshot, focused label, and focused value. It is capped by the same two pre-dispatch recoveries and cannot convert an ambiguous transport/action outcome into a retry.

Target-head compatibility retains the old `item` response only for existing injected test clients; real requests use the new operation-specific heads. Missing selected target responses fail closed.

Browser-action accounting increments only after a successful `open` or `act`; writer refusals, uncertain decisions, and pre-dispatch rejections do not consume a browser action. The 13th action is blocked before dispatch. No dependency, secret scope, model selection, booking policy, or screenshot behavior changed.

Quality/safety self-review: accepted, subject to the exact-head regression/browser/live/public-flight results recorded after this document.

## Fare-evidence hardening

The existing real-result verifier was also updated for the observed Google Flights rendering where route/date controls and result prices are separate DOM text. The first new check confirms that a search-result page with Hanoi, Vancouver, a December 2026 departure and a visible CAD fare below the cap is accepted.

A second check was intentionally added RED: a matching results page containing only baggage/seat prices incorrectly qualified. The verifier now excludes baggage, seat-selection, insurance, ancillary and optional-charge lines; that test is GREEN. This preserves the rule that unrelated cheap amounts are not flight-fare evidence.

## Clean local verification after all production changes

- Vitest: **115 tests in 29 files passed**.
- Node integration suite: **28 checks passed**.
- Typecheck and production build: passed.
- Real Browser Control extension/relay canonical journeys: **10/10 passed**.
- Additional deterministic browser journeys: **10/10 passed**.
- Controlled fixture timings in this pass: 179 ms focus-click median, 150 ms redirect navigation, 240 ms Back recovery.
- `git diff --check`: passed.

The ancillary-fare verifier changed after the full browser pass; its focused integration file was rerun separately with all four cases passing. It does not alter browser execution.
