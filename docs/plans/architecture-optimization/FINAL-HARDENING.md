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
