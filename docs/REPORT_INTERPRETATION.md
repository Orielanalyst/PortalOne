# Report-text interpretation — 26 October

The committee runs a bounded text-reading step before the Mission Expert writes
findings. It reuses Nightshift/Nemotron streaming, Zod and SQLite; no new service
or dependency was acquired.

## Transmission boundary

On 26 October the human explicitly authorized sending private/live Kobo
`report_text` to the configured NVIDIA Nemotron service through Nightshift for
claim extraction, with private quotes excluded from public reports and GitHub.
The authorization is enabled on this local host and bound to this Kobo project,
the configured proxy origin/API URL, NVIDIA model selection and report-text scope.
Reporter references, identity fields and submitted GPS are not included in that
inference request. Free text itself may contain sensitive details; no broad raw
record is forwarded.

The ignored `.runtime/mission/report-inference-consent.json` records the local
authorization. Missing, disabled, invalid, differently scoped or mismatched
project/provider settings hold private narratives before inference or cache reuse.
Fresh checkouts therefore retain the public-example-only default. The initial
automatic approval-review rejection remains historical; the specific human
authorization resolved it, rather than an alternate transmission route.

Without scoped authorization, only exact matches to
[published synthetic examples](../data/kobo/interpretation-examples-v1.json) in
demonstration-labelled forms are eligible. See
[private processing and export boundaries](PRIVATE_REPORT_PROCESSING.md).

## Evidence and uncertainty

Readings contain up to four category/assertion pairs: reported, denied, uncertain
or fictional example. The production example adapter rejects actual-reported
assertions. Each nonempty claim has an exact supporting quote; place/time mentions
must occur inside it. Truncated sentence fragments fail the source check. The
prompt requires full short reports or complete source sentences for longer text,
preserving negative/demonstration qualifiers.
Relative times are not resolved; form observation time remains separate. No
coordinates are generated from text.

Accepted means the structural/source-span contract passed. It does not establish
semantic completeness or field truth. An empty `not_understood` reading remains
a manual-review gap; `no_observation` supplies no positive incident claim. The
native English/French probe checks denied-road and unknown-health-status semantics,
rather than treating valid JSON as success.

SQLite binds results to signal version, exact text hash, interpretation version,
demo/live mode, public/private visibility and model receipt. Identical bytes in the same context reuse an accepted reading
before inference; each record retains its own result/lineage. Copies never become
independent witnesses. Edited bytes require a new read. Failures remain inspectable
and are not cache hits. Four new calls and a 90-second window bound interpretation
within the existing ten-minute committee deadline. Limits/failures become gaps;
there is no silent fixture fallback.

## Planning, maps and inspection

Form metadata and text interpretation have separate dossier citations. Planner
and Evaluator receive the source statements. Source Register links open quotes,
text hash, reuse lineage and model receipt through the local-only evidence endpoint.
Private support links are labelled local only. Private quotes, extracted place/time
mentions and failed model payloads stay in the local journal; downstream committee
models and exports receive categorical assertions, source IDs/hashes and uncertainty.
Only verified published-example quotations enter shared evidence.

If a form selects blockage/access restriction but its text denies access claims,
asserts no observation, is not understood or remains held, that record is excluded
from the blockage point layer. Positive/uncertain claims still require usable
submitted coordinates and remain unverified. Exclusion never certifies a road
open. Form categories, source versions and prior packs remain intact.

A native rehearsal exposed the coordinator treating an explicit committee request
as a greeting. Its failed turn is retained. Intent and source-interpretation decisions
and all committee narratives now use Ultra after native short-model failures;
the conversational wrap-up also uses Ultra after a saved unsupported field-confirmation
statement. The interface selects the latest non-rejected summary, retaining the old
document as rejected history. There is no keyword-based
launch substituted for the model's decision.

## Rehearse

```powershell
bun scripts/check-report-interpretation.ts
bun scripts/check-report-interpretation.ts --apply
bun scripts/check-report-interpretation.ts --apply --tag=scoped-v2
```

The first command describes the scope. Apply makes two native calls using only
published English/French examples, verifies source spans/semantics and retains
receipts. Failed probes remain in the ignored runtime directory; a successful
receipt cannot be overwritten. No Kobo submission is made. The configured app
uses the same extraction step in committee investigations.

## Aggregate publication checks

The dossier generates a separate interpretation inventory with reading count,
extracted claim count, assertion categories, empty results and verified-incident
count. Numeric text-claim totals must match/cite that inventory. Counts of extracted
claims and independently verified incidents remain distinct. Individual zero-claim
readings cannot be generalized to the batch. The PDF renders the inventory directly
from source data, rather than asking the model to reproduce its table.

A first private run passed privacy/source-span checks but wrote the wrong aggregate
in its narrative. Its pack was withdrawn after quality review; original bytes and
receipts remain local. A follow-up caught an overly broad validator confusing a
correct zero-confirmed-incident statement with the extracted-claim count. Regression
checks now cover both cases. Quality withdrawal records the reason, invalidates the
assessment and blocks the download while retaining artifact metadata/history.
