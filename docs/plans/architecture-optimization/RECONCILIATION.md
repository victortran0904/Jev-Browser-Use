# VPS / PR reconciliation — September 17, 2026

Two implementations diverged from `964b286`: VPS `da6b052`, remote PR `7e9cdca`. Both histories are retained by a normal two-parent merge, with local checkpoint branches as additional recovery references. No force push.

The five overlapping implementation files use the VPS version because it has been freshly tested on Oracle Linux ARM64: 62 regression tests, typecheck/build, and all ten deterministic workflows through the real Browser Control extension and relay. That includes the POST/delayed popup cases which the remote specification review still lists as failing.

Remote-only regression fixtures, the model-context helper and available-action filter are retained for integration/review. Their applicability to the unified public observation contract must be checked before final verification. Neither historical review is blanket approval of the merged code.

The pinned 0.7.1 popup compatibility patch is part of the VPS solution. It attaches only native children of relay-owned Jev sessions and does not mirror/replay destination URLs. The merged implementation must undergo fresh specification and quality review, plus real provider and public-flight tests on the requested VPS.
