> Historical remote-branch review, superseded by REVIEW-SPEC-FINAL.md after the two-parent VPS reconciliation. Original findings retained for audit.

# Review stage 1 — specification compliance

Reviewer: the implementing assistant, in a separate manual review pass. The user explicitly waived subagents; this is not an independent-agent review. This file records findings, not a claim that every acceptance test passes.

## Reviewed scope

The approved architecture review, repository TDD guidance, public BrowserBoundary/run interfaces, and the user's ten end-to-end browsing cases. Baseline is main `1398bd0`; implementation remains on `perf/browser-architecture-20260917`.

## Verified behavior and fixes

- Lost mutation responses no longer replay via CLI. Explicit HTTP failures and negative/malformed execution envelopes remain failures. Ambiguous session creation does not replay.
- Normal focus/menu clicks no longer wait for an unrelated one-second popup timeout. Real Chromium regression checks enforce this.
- Private document-scoped references are stable across insertions. Changed semantic identity, disconnected/replaced targets and changed focus fail closed. Page-authored reference attributes are not authority.
- Sensitive control values are omitted and mirrored values redacted before observation construction; public signatures are opaque tokens, not raw URLs/attributes. This is conservative field-metadata detection, not universal PII detection.
- Bounded collection, dialog/status/main text budgets, current safe field values and conservative focused snapshots are covered by behavior regressions.
- Planner context excludes internal signatures and the repeated candidate listing. Unavailable click/type/Enter choices are filtered before model dispatch.
- The ten controlled journeys verify visible results. Live TypeSafe/Gemini cases and the real public-flight attempt are reported separately; fixture fares are explicitly synthetic.

## Findings requiring follow-through

1. **Popup acceptance is still failing in the real relay.** The first local popup test passed, but POST/delayed popup cases failed in Actions. Global status snapshots cannot establish ownership. Read-only provenance diagnostics revealed `/extension/status` is not the target-list endpoint and raw CDP is session-filtered. Those defects were fixed, but no child is yet observed in the actual target list. Do not describe popup support as verified until both real cases pass.
2. **Navigation readiness:** direct `goto()` still used the default full-load wait. A new behavior regression has a RED/GREEN fix using explicit DOMContentLoaded readiness, awaiting publication. Completion remains based on observed content, not the readiness event alone.
3. **Read-only wait across navigation:** a document freshness guard incorrectly rejected waiting after a navigation changed execution context. A real neutral-page reload regression has a RED/GREEN fix that exempts only the non-mutating wait; mutations retain freshness checks.
4. **Coverage precision:** focused-state reuse is implemented, but dirty-subtree incremental extraction, general compound actions and complete phase-by-phase telemetry are not yet implemented. Do not imply that passing the ten journeys proves those broader plan items.
5. **Public-flight evidence:** no verified dated public fare has been obtained. A model's done response or a fixture fare is not a substitute.

## Evidence and acceptance

Sequential local RED/GREEN logs are retained in the session evidence directory; full repository tests, TypeScript checking and production build run in Actions because the local verification checkout lacks the provider SDK installation. Full Chromium invariant checks also run in Actions.

Recent actual outcomes: ten deterministic journeys 8/10; latest live-model fixture run 8/10; the same two popup cases fail. Request status metadata confirms the keys can work; earlier transient Gemini 429/timeouts remain recorded rather than hidden. Do not mark the PR merge-ready at this point.

Final acceptance requires a new exact-head verification run, resolution of the remaining findings, and the separate code-quality review. No Greptile or independent reviewer approval has been claimed.
