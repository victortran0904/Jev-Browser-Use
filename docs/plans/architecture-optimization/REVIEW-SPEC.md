# Review 1 — specification compliance

Review performed by the implementing assistant, not an independent subagent, under the user's explicit waiver. This document records findings and their resolution; it is not an external approval.

## Initial evidence

The ten-case deterministic suite passed through the real Browser Control relay and extension. The same changes also have direct-Chromium tests for sensitive fields, incremental observations and copied-reference attacks. Evidence is retained in the implementation logs and will be summarized in TDD.md.

## Findings requiring resolution before completion

1. A connected element can change meaning without being replaced. Ref identity alone is insufficient; revalidate meaningful target properties and document identity immediately before input.
2. Close during session creation must not allow a delayed initialization to resurrect the run. Stop during writer generation is already covered and fixed.
3. Explicit initial URLs should avoid an unnecessary empty-page observation while preserving the observation/plan event contract.
4. Session transport mutations must follow the same no-ambiguous-replay rule as browser execution. A malformed success response must fail closed.
5. Screenshot output must remain associated with its observation, and renderer/boundary timing must be distinguishable.
6. The direct-fill action needs complete controller/planner field metadata. Its browser behavior is covered by the route/month/budget fixture; the integration tests are being completed.

## Scope decisions

The fast observer caches candidate membership, not unchecked visual state: geometry, visibility, live field values and bounded context are reread. Full collection remains the conservative fallback for broad or uncertain invalidation. Direct fill is allowed; arbitrary compound submissions are not introduced.

The flight fixture is synthetic, not a fare quote. A separate secret-backed public-site test is required to characterize the user's exact prompt. Failures from external providers or the public site must remain visible.

Status: listed application findings resolved and verified. The targeted RED/GREEN results are recorded in TDD.md; after resolution, the clean-install suite passed 62 tests plus all ten real-relay browsing workflows. Public-site/model execution remains a separate CI result, not a condition silently assumed from fixture success.
