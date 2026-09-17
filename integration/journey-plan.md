# Browser E2E acceptance cases

The user authorized direct implementation without subagents, retaining test-first development, a specification review and a separate code-quality review. Work remains on `perf/browser-architecture-20260917`; main must remain unchanged.

1. Search form: enter an exact query and verify the submitted result.
2. Menu: open a menu, choose a newly exposed item and verify details.
3. SPA: load asynchronous results and verify completion rather than a click acknowledgment.
4. Redirect: arrive at the destination without waiting for unrelated slow media.
5. POST popup: continue in the original popup without losing POST/tab-local state.
6. Delayed popup: detect the run's delayed child without delaying ordinary clicks.
7. Scrolling: reveal and activate an initially off-screen control.
8. DOM replacement: update controls and reject actions on stale elements.
9. Isolation: complete concurrent left/right sessions without mixing targets.
10. Flight form: search a controlled fixture for Hanoi to Vancouver in December 2026, below CAD 2,500.

Controlled fixture flight prices are synthetic, never real travel offers. In addition to these ten reproducible cases, run the user's exact flight-search prompt against public websites with the repository Actions secrets. Record the assumptions: December 2026, CAD, one-way economy, one adult. No booking, sign-in, personal-data entry or CAPTCHA bypass. A model saying done is not proof that a matching fare was found.

Report deterministic browser/relay results, live-model fixture results and the public-flight attempt separately. Do not label blocked, skipped, unverified or provider-failed attempts as passed. Preserve original failures and review fixes. Repository secret values must remain in Actions; never print them or upload browser profiles/provider responses.
