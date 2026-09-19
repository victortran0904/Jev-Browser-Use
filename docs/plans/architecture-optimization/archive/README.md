# Superseded local experiment

This preserves the last uncommitted patch found in the earlier `e2e-worktree` during reconnection. It is archived source evidence, **not a patch to apply** to the current implementation.

That prototype cached whole candidate/text snapshots in a page-visible global registry and used the obsolete `elementsInspected` metric. The selected production implementation instead keeps private document-scoped references, reuses candidate membership, rereads live geometry/fields, and validates current action targets. Reintroducing the prototype would undo later freshness and privacy work.

The useful behaviors (coherent title/URL collection, focused-field refresh and membership caching) already have current production implementations and regression tests. No unique production fix was discarded. Its original working-tree patch also remains in a named local stash for provenance; the old experimental worktree is clean.

## Inactive follow-up experiments

`deferred-writer-deadline.test.ts.txt` remains an inactive failing experiment whose implementation was not applied. `historical-uncertain-state-recovery-red.test.ts.txt` preserves the earlier RED case for changed-state low-confidence recovery; that behavior was subsequently implemented test-first and is now covered by the active `tests/uncertain-state-recovery.test.ts`. The historical file is evidence only, not a test to execute.
