# Report-text interpretation — 26 October

The committee runs a bounded text-reading step before the Mission Expert writes
findings. It reuses Nightshift/Nemotron streaming, Zod and SQLite; no new service
or dependency was acquired.

## Transmission boundary

Only exact matches to [five published synthetic examples](../data/kobo/interpretation-examples-v1.json)
are eligible, and only for demonstration-labelled forms. Provider input comes
from the repository example, never the raw Kobo narrative. Live-labelled records
and other narratives remain local with a visible interpretation gap.

Automatic approval review rejected the initial private-narrative path because
free text may contain sensitive personal or location information. The human has
not authorized that transfer. No alternate provider or indirect route is used.
Enabling it requires explicit authorization for report-text transmission to the
configured NVIDIA service through Nightshift. Reporter references, identity fields
and submitted GPS are not part of this text-reading request.

## Evidence and uncertainty

Readings contain up to four category/assertion pairs: reported, denied, uncertain
or fictional example. The production example adapter rejects actual-reported
assertions. Each nonempty claim has an exact supporting quote; place/time mentions
must occur inside it. Truncated sentence fragments fail the source check. The
prompt requires the full example to preserve negative/demonstration qualifiers.
Relative times are not resolved; form observation time remains separate. No
coordinates are generated from text.

Accepted means the structural/source-span contract passed. It does not establish
semantic completeness or field truth. An empty `not_understood` reading remains
a manual-review gap; `no_observation` supplies no positive incident claim. The
native English/French probe checks denied-road and unknown-health-status semantics,
rather than treating valid JSON as success.

SQLite binds results to signal version, exact text hash, interpretation version
and model receipt. Identical bytes in the same project reuse an accepted reading
before inference; each record retains its own result/lineage. Copies never become
independent witnesses. Edited bytes require a new read. Failures remain inspectable
and are not cache hits. Four new calls and a 90-second window bound interpretation
within the existing ten-minute committee deadline. Limits/failures become gaps;
there is no silent fixture fallback.

## Planning, maps and inspection

Form metadata and text interpretation have separate dossier citations. Planner
and Evaluator receive the source statements. Source Register links open quotes,
text hash, reuse lineage and model receipt through the local evidence endpoint.
Only published example quotations enter exported evidence.

If a form selects blockage/access restriction but its text denies access claims,
asserts no observation, is not understood or remains held, that record is excluded
from the blockage point layer. Positive/uncertain claims still require usable
submitted coordinates and remain unverified. Exclusion never certifies a road
open. Form categories, source versions and prior packs remain intact.

A native rehearsal exposed the coordinator treating an explicit committee request
as a greeting. Its failed turn is retained. Intent decisions now use Ultra;
extraction and conversational wrap-up retain Lightning. There is no keyword-based
launch substituted for the model's decision.

## Rehearse

```powershell
bun scripts/check-report-interpretation.ts
bun scripts/check-report-interpretation.ts --apply
```

The first command describes the scope. Apply makes two native calls using only
published English/French examples, verifies source spans/semantics and retains
receipts. Failed probes remain in the ignored runtime directory; a successful
receipt cannot be overwritten. No Kobo submission is made. The configured app
uses the same extraction step in committee investigations.
