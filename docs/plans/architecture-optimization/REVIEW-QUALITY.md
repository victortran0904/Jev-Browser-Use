# Review 2 — code quality and operational safety

Performed by the implementing assistant after the specification review, under the user's subagent waiver. This is a second self-review pass, not an independent agent or external approval.

## Findings addressed

- Removed dead global-tab polling and URL-mirroring code after replacing it with run-owned popup tracking.
- Restricted CLI child environment inheritance; a regression test proves model credentials are not passed to browser bootstrap processes.
- Restored unrelated package-lock platform metadata. Browser Control is pinned to the reviewed 0.7.1 version; Playwright 1.63.0 is an explicit test dependency without changing the previously resolved version.
- Added a version-checked, idempotent install patch for native popup ownership. It only attaches children of existing relay-owned `jev-` sessions, not unrelated user tabs, and does not request additional Chrome extension permissions.
- Serialized physical browser input across sessions while leaving observation/model work concurrent. This fixed a real-relay race, not merely a mocked test failure.
- Kept sensitive values out of action-result text and reused field-redaction metadata for focused and directly targeted fields.
- Formatted the extracted observer/types and retained focused modules for transport, session lifecycle, DOM collection, and field actions.
- Replaced tests that asserted literal popup timeout/source code with real browser behavior checks. Historical failures and genuine RED/GREEN cycles remain recorded; no failed assertion was turned into PASS by suppressing it.

## Verification and limits

The full local regression suite passed 62 tests across 13 files, plus typechecking and the production build. The deterministic real-extension suite passed all ten cases. A clean-install rerun and GitHub Actions verification follow this review and are recorded in STATUS.md.

The compatibility patch applies to the pinned CLI relay plus bundled unpacked extension. An existing user installation must reload the extension and restart the relay after `npm ci`. Upgrading Browser Control requires reviewing the patch against the new version; this is deliberately not an unbounded monkey patch.

The observer does not implement comprehensive accessibility/shadow-DOM/iframe extraction. Cache reuse is conservative and still rereads geometry, field properties and bounded page context. Sensitive-field detection is heuristic, not a claim to identify all personal data. No automatic booking or purchase workflow was added.

Public-site flight exploration is reported separately from deterministic regression success. A public CAPTCHA, provider failure or missing route/date/price evidence is a failed exploration, not a verified fare. Secrets are injected only inside GitHub Actions, and artifacts contain allowlisted result metadata.
