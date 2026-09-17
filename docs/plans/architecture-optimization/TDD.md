# TDD execution evidence

Recorded from actual command output, not reconstructed passing assertions. Each listed behavior was observed failing before its corresponding implementation passed. Red/green work was done in vertical slices. Existing-behavior regression cases were added without pretending they began RED.

Raw logs were retained outside the worktree under the implementation evidence directory. This summary records their command-log names and exit codes. Some initial fixture attempts failed for setup reasons; corrected behavioral failures are used below, rather than claiming those setup failures prove a regression. The direct popup fixture also had an early runner timeout; the native relay popup row records the actual integration failure and fix.

| Behavior | RED log / exit | GREEN log / exit |
|---|---|---|
| Lost execution response | `01-transport-RED`: 1 | `01-transport-GREEN`: 0 |
| Explicit relay rejection | `02-rejection-RED`: 1 | `02-rejection-GREEN`: 0 |
| Malformed execution envelope | `03-malformed-RED`: 1 | `03-malformed-GREEN`: 0 |
| Password redaction | `04-password-RED`: 1 | `04-password-GREEN`: 0 |
| Fast focus click | `05-focus-RED`: 1 | `05-focus-GREEN`: 0 |
| DOMContentLoaded navigation | `06-navigation-RED-corrected`: 1 | `06-navigation-GREEN`: 0 |
| Stable element references | `09-stable-RED`: 1 | `09-stable-GREEN`: 0 |
| Replaced-element guard | `10-stale-RED`: 1 | `10-stale-GREEN`: 0 |
| Bounded candidate inspection | `12-bounded-scan-RED`: 1 | `12-bounded-scan-GREEN`: 0 |
| Closed session isolation | `14-isolation-RED-corrected`: 1 | `14-isolation-GREEN`: 0 |
| Focused membership reuse | `16-cache-RED`: 1 | `16-cache-GREEN`: 0 |
| Incremental subtree update | `17-incremental-RED`: 1 | `17-incremental-GREEN`: 0 |
| Native relay POST popup | `18-real-post-popup`: 1 | `21-real-popup-patch`: 0 |
| Prioritized dialog context | `22-context-RED`: 1 | `22-context-GREEN`: 0 |
| Sensitive fields and focus | `24-sensitive-focus-RED`: 1 | `24-sensitive-focus-GREEN`: 0 |
| Direct field fill | `25-flight-fill-RED`: 1 | `25-flight-fill-GREEN`: 0 |
| Compact model context | `27-compact-model-RED`: 1 | `27-compact-model-GREEN`: 0 |
| Stop during model writing | `31-stop-writer-RED`: 1 | `31-stop-writer-GREEN`: 0 |
| Controller direct fill | `33-controller-fill-RED`: 1 | `33-controller-fill-GREEN`: 0 |
| Field metadata | `34-field-metadata-RED`: 1 | `34-field-metadata-GREEN`: 0 |
| Planner fill targeting | `35-planner-fill-RED`: 1 | `35-planner-fill-GREEN`: 0 |
| Separate writer timing | `37-writer-timing-RED`: 1 | `37-writer-timing-GREEN`: 0 |
| Changed target meaning | `38-semantic-RED`: 1 | `38-semantic-GREEN`: 0 |
| Close versus initialization | `39-session-close-RED`: 1 | `39-session-close-GREEN`: 0 |
| Superseded observations | `40-observation-version-RED`: 1 | `40-observation-version-GREEN`: 0 |
| Session mutation transport | `41-session-transport-RED`: 1 | `41-session-transport-GREEN`: 0 |
| Explicit initial URL shortcut | `42-initial-url-RED`: 1 | `42-initial-url-GREEN`: 0 |
| Screenshot versioning | `43-screenshot-version-RED`: 1 | `43-screenshot-version-GREEN`: 0 |
| Keyboard document freshness | `44-keyboard-document-RED`: 1 | `44-keyboard-document-GREEN`: 0 |
| CLI credential isolation | `45-cli-env-RED`: 1 | `45-cli-env-GREEN`: 0 |
| Renderer and boundary metrics | `46-observe-metrics-RED`: 1 | `46-observe-metrics-GREEN`: 0 |

## Full verification after both review passes

A clean `npm ci` passed; the version-checked popup patch passed a second idempotent application. The full unit/integration regression suite passed **62 tests across 13 files** with two workers. Typechecking and the production build passed. The ten deterministic browsing cases passed through the real extension/relay after the clean install, including the native POST and delayed popup cases.

The final clean-install fixture measured a **129 ms focus-click median** and **79 ms redirect navigation**. These are small deterministic fixture timings, not an end-to-end speedup claim for arbitrary websites or a controlled comparison of model inference latency. The synthetic flight fixture is not a real fare quote.

The old baseline was 31 tests. Three implementation-coupled boundary tests were replaced by real browser coverage, rather than keeping assertions that forced a one-second timeout and URL reloading.

GitHub Actions and the exact public-flight prompt are separately reported in the PR and STATUS.md; their outcome is not inferred from this local suite.
