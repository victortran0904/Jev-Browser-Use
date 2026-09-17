# Superseded local experiment

This preserves the last uncommitted patch found in the earlier `e2e-worktree` during reconnection. It is archived source evidence, **not a patch to apply** to the current implementation.

That prototype cached whole candidate/text snapshots in a page-visible global registry and used the obsolete `elementsInspected` metric. The selected production implementation instead keeps private document-scoped references, reuses candidate membership, rereads live geometry/fields, and validates current action targets. Reintroducing the prototype would undo later freshness and privacy work.

The useful behaviors (coherent title/URL collection, focused-field refresh and membership caching) already have current production implementations and regression tests. No unique production fix was discarded. Its original working-tree patch also remains in a named local stash for provenance; the old experimental worktree is clean.

## Inactive follow-up experiments

`deferred-writer-deadline.test.ts.txt` and `deferred-uncertain-state-recovery.test.ts.txt` preserve genuine failing experiments whose implementation commands were blocked before execution. They are documentation artifacts, not active tests or implemented fixes. Do not include them in passing-test totals or apply them as production patches. Their limitations and actual logs are recorded in COMPLETION-REVIEW.md.
