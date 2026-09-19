# Autocomplete and repeated-fill follow-through

Base: `4f95eec32c4fe19cada1e3df4457d202b52a6364`. User waived subagents; both review stages below are self-reviews, not independent-agent approvals.

## Stage 1: specification review

The Oracle VPS acceptance run passed all deterministic checks and nine live-model journeys, but the synthetic flight journey failed at its first fill. The public-flight attempt repeated field edits and exhausted its writer-call budget. These remain failed runs, not successful fare searches.

Reviewing the collector revealed that visible ARIA `option` elements were omitted. A real-Chromium public-boundary test first failed because the Hanoi suggestion was absent, then passed after adding that role to the existing bounded selector. The 180-candidate limit, viewport checks, signatures, and actionability protections remain unchanged.

Identical direct and focused fills now return explicit no-change feedback rather than repeat input events. Separate tests failed on each original success-like result, then passed after the minimal guard. The selected handle is still validated before its live value is compared. Nothing automatically submits a form or selects a suggestion.

Failure reporting now distinguishes malformed JSON, empty model output, and flight-specific writer/planner budgets. Two additional RED/GREEN cycles verify these static categories; raw responses and secret values are not copied into reports.

Specification self-review: accepted for this bounded patch. No claim is made that autocomplete omission caused every prior live failure. The new diagnostic categories and public flight task require a fresh secret-backed run.

## Stage 2: code-quality and safety review

Re-read the implementation after the specification pass. Both early-return paths execute handle disposal in `finally`. All injected values/messages use JSON serialization. The no-change check does not weaken document, focus, sensitivity, or semantic guards. Returned refusal messages participate in existing bounded no-progress detection.

The selector change does not introduce a whole-document accessibility traversal, bypass hidden-element checks, or alter membership-cache invalidation. Tests inspect observable browser outcomes, including the actual number of input events rendered by a fixture. The diagnostic classifier outputs only static categories.

Quality self-review: accepted. Existing limitations remain: incomplete iframe/shadow-root coverage, heuristic sensitivity detection, and the original twelve-step run budget. No flight-evidence threshold, model substitution, browser permission, or credential handling was loosened. No Greptile or independent reviewer approval is claimed.

## Verification before push

Executed on the Oracle `free` VPS after all changes above:

- `npm test -- --maxWorkers=1`: 80 tests across 18 files passed.
- `node --import tsx --test --test-concurrency=1 integration/*.checks.mjs`: 27 checks passed.
- `npm run typecheck` and `npm run build`: passed.
- Credential-free live-harness self-test: six assertions passed.
- `git diff --check`: passed.

Every command exited zero. Five vertical RED/GREEN cycles are retained outside the repository in `evidence/completion/`: diagnostics, flight budgets, autocomplete option selection, unchanged direct fill, and unchanged focused fill. Both review stages above cover the resulting patch. Exact-head live-model and public-flight acceptance are recorded separately in the PR after execution; these local results do not anticipate that outcome.

## Concurrent-update reconciliation

Before pushing, the remote advanced to `c2433d88582463e8f41c93076eda3aa47eef0e8d`. The tested local patch was preserved in a named stash and evidence copies, then the branch fast-forwarded. The remote already contains equivalent unchanged-fill and budget-classification fixes plus typed invalid-target recovery. Those implementations were retained, avoiding an extra renderer round trip for duplicate-fill comparison. The new autocomplete and model-output diagnostic coverage was layered onto them. The duplicate-fill tests now accept the existing refusal wording while retaining input-event assertions. All new combined verification results are recorded separately; the earlier 80-test result is not claimed for this combined head.

### Combined-head verification and re-review

After retaining remote recovery/no-change implementations and adding the local autocomplete/diagnostic changes: 87 Vitest tests across 21 files, 27 Node checks, typecheck, production build, and six harness assertions all passed on the Oracle VPS (all commands exit 0). Specification re-review confirmed no approved behavior was lost in reconciliation. Quality re-review retained the remote's single-evaluation unchanged-fill check and typed pre-dispatch recovery; the local tests still verify actual browser input-event behavior. Exact-head external results remain separate from this local acceptance.
