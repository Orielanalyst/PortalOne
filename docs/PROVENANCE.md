# Provenance

This note distinguishes the existing prototype, the current repository baseline,
third-party components and subsequent hackathon work. Dates are recorded facts
from local history, not independent proof of originality or an eligibility ruling.

## Reference prototype

The earlier project `Orielanalyst/relief-mission-control` (private) was generated
with Lovable on 2026-10-16 and extended on 2026-10-23. It is kept as a **design
reference only**. It is not the submission, and none of its commits are reused.

The earlier tracking note reports a pre-window template commit and bot-authored
commits. That prototype has not been re-audited in the 24 October environment
review. Preserve and declare any actual reused product code, regardless of which
repository now contains it. Starting a fresh repository does not remove a
declaration obligation.

## What was reused

- The product idea: an emergency-response agent that verifies before dispatch.
- The demo scenario (Mbeli flood), including place names and approximate figures.
- The visual direction: a dark mission-control palette.

## Existing repository baseline

- The scaffold, without the Lovable Vite config or the unused shadcn components.
- The domain model, with a deterministic evaluator and unit tests.
- Existing UI scaffold. The earlier note's proposed agent runtime and event
  contract were future work, not verified completed capabilities.

## Why a fresh repository

The current repository's first reachable application commit is `6c13246`, dated
2026-10-23 17:11:59 +01:00. The audit began at `42fb95c` on `diag/workflow`.
Existing tag `v0.1-tracking` is preserved. A UI work-in-progress stash is also
preserved. The file/blob manifest is `evidence/baseline-2026-10-24.json`.

This is a **24 October checkpoint**, not a retroactively created 22 October
snapshot. It records the state we can inspect now. The new corridor scenario,
agent loop, sponsor integrations and redesigned UI must be distinguished from
this baseline in subsequent commits and the final submission.

## Wildcard and official rules

Source: https://hackathon.genai.works/event/open-agent-hackathon-2026#rules,
reviewed with all rule sections expanded on 2026-10-24.

- Rule 4.2 excludes work committed before the window except clearly declared
  pre-existing components.
- Rule 5.4 permits pre-existing open-source libraries and requires declaration
  of pre-existing product code in the submission form.
- Rule 5.5 permits generated code and makes entrants accountable for it.
- Wildcard [Tinkerer] is the track for extending an existing project/prototype/
  concept; its description says scoring covers new work rather than prior work.
- Exactly one primary track is selected. This audit makes no HackOS track change
  and does not establish a requirement to use Wildcard solely because a template
  or reference prototype existed. The final declaration must match actual reuse.

No special Wildcard monitoring tool or mandatory commit cadence was found in
the reviewed rules. Our baseline, build log and commit policy are transparency
measures we choose to make the change boundary easy to inspect.

## Acquired components on 24 October

Official Zetaris HTTP diagnostic helpers are vendored at upstream commit
`6a2fbaa47c32c9ac33f6584c64b43b146c621bed` with their Apache-2.0 license. See
`../vendor/zetaris-getting-started/PROVENANCE.md` and the environment evidence.
The proprietary platform bundle and credentials stay outside this repository.

Meterless World Model is pinned at `1742dec56a66e58eef9dda2d2b865823758ca8cd`
under Apache-2.0. LangGraph/Core/Zod and their adopted archives have MIT license
and integrity records in `../vendor/npm-registry/manifest.json`. Official Zetaris
registration references were read at the same pinned getting-started revision;
the product-specific adapter and constraints are new work.

`../data/relief-scenario-v1/` contains original synthetic fixtures, declared CC0-1.0
with Codex assistance. No actual field reports, beneficiary records or surveyed
detour are represented. The overweight draft is a stress-test fixture; later
model responses and independent rejections are recorded live outcomes. The live
trace's source commit and hashes identify the implementation that produced it.
