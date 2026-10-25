# Live mission updates

The [live receipt](evidence/mission-update-2026-10-25.json) executed
`ece0ce3862f45654ebe99460a63716178ce54f58`: a six-record baseline, one real Kobo
demonstration submission, automatic invalidation and a seven-record replacement.
It observed 1,252 baseline and 1,570 replacement updates before publication,
published v1 before each evaluation, preserved the old PDF hash and rejected its
default stale download URL. Both replacement PDF/ZIP download hashes match.
The [15-page PDF](evidence/mission-update-demo-2026-10-25/report.pdf) was visually
inspected page by page; the [ZIP](evidence/mission-update-demo-2026-10-25/committee-pack.zip)
was reopened in a fresh native QGIS process at another mount with seven valid
styled layers. Located-access features are three demonstration observations,
not three independently verified incidents. Prior failed rehearsals are summarized
in the receipt, with full failed drafts retained locally.

The committee workflow now uses the retained Meterless World Model engine to
bind published plans to exact evidence snapshots. SQLite keeps the application
journal; World Model supplies persistent dependency entities, relationships,
changed facts, event IDs and audit entries.

## What changes when a report arrives

1. The existing 30-minute watch reads Kobo and refreshes the bounded Zetaris
   projection. Unchanged query receipts/timestamps do not create another revision.
2. A changed report/map/resource revision invalidates plans depending on the older
   project snapshot. Changed values are recorded without promoting claims to facts.
3. The coordinator announces a replacement and delegates the committee review.
   Old drafts remain published historical records; the new run has its own
   findings, v1, evaluation, revisions, final narrative and export.
4. An actual diff compares the preceding mission plan to the replacement's first
   plan. A source-register entry and generated PDF section explain the recorded
   evidence changes. The ZIP includes `mission-memory.json` with dependencies and
   real engine audit entries.
5. Fresh Kobo/Zetaris checks before export and before download publication prevent
   a changed snapshot from being offered as a fresh replacement. A failed check
   stops publication and leaves the failed step inspectable.

Plan and Report keep the mission being read selected as new activity arrives.
Superseded snapshots have an explicit banner and historical download labels.
Old default download URLs return HTTP 409; choosing a historical link adds
`historical=1`, returns the original bytes and uses a `superseded-` filename plus
an evidence-status header. The original document is never silently overwritten.

## Rehearse on the configured local host

```powershell
bun scripts/demo-committee-update.ts
bun scripts/demo-committee-update.ts --apply --tag=my-rehearsal
```

The first command describes the operation. The second runs the live workflow
twice and submits one explicitly labelled demonstration to the configured Kobo
project. It uses a persisted UUID so an uncertain submission can be retried
without creating another record. Reusing a tag whose report already exists is
rejected. Receipts live in the ignored `.runtime/committee-update/` directory.
Use a demonstration-only project and an idle live app with its provider/data/
report runtimes configured. No credentials are printed. Model calls consume the
configured provider allowance.

The synthetic point is selected from an existing public Bambili map reference
for the rehearsal, rounded to approximately 100 metres. It is not a field
observation. Repeated forwards add records, never verified independent origins.
The exported blockage layer contains reported/unverified access observations;
its feature count is not a count of independently confirmed incidents.

## Boundaries

Invalidation is conservative for the project's source snapshot. Exact affected
road dependencies, actual field origins, real resource ledgers and version-bound
human dispatch approval remain separate work. World Model does not infer road
clearance from a map. Completed records persist; the watch and interrupted graph
do not resume after restart. A live failure never silently becomes replay output.

The live citation failures are preserved alongside their forward fixes. Models
use short source handles; the streaming resolver maps each supplied handle or
bounded group/range to its exact current evidence ID. It holds partial identifiers
only, without replaying the settled answer. Published document metadata retains
the mapping. Unknown sources stop publication. Repairs use Ultra: one per
document, at most two across the run, within the existing time/query bounds.
Unsupported ISO calendar dates are rejected. Missing deadlines must be obtained
from the operator. A date inside an ISO timestamp remains supported. A pure
"None" in required changes is an evaluator control; explanations and field claims
still need citations. Failure results preserve the reports actually retrieved.
Structural checks do not establish semantic truth or replace
expert review.

Kobo reads use the already retained MIT-licensed `p-retry` 7.1.1 package, now pinned
as a direct dependency. An interrupted transport, HTTP 429/5xx or inconsistent
pagination gets one complete-snapshot retry, announced in Activity. Authentication
failures and cancellations are not retried. Each attempt remains subject to its
request timeout and the enclosing workflow signal; failed refreshes block
publication. No new dependency archive or external service was needed.
