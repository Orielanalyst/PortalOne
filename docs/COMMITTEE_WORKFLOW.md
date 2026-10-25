# Live committee workflow and streaming

Updated 25 October 2026. The browser connects a conversational coordinator to
evidence investigation, versioned committee drafts, independent review and a
native PDF/GIS export. These are review documents; dispatch remains on hold.

The [live browser receipt](evidence/committee-workflow-2026-10-25.json) records
4,927 incremental updates, publication of v1 before evaluation, a real v2/diff,
Ultra's acceptance with gaps and the original validated export. It executed
`e555846e5fe4411a2bbdd9a2eba7ea832b12d3b6`. Later formatting and interface
checks have their own commits and hashes in the [UI receipt](evidence/committee-ui-2026-10-25.json).
The final [13-page PDF](evidence/committee-demo-2026-10-25/report.pdf) and
[complete GIS ZIP](evidence/committee-demo-2026-10-25/committee-pack.zip) are
layout edition 4, generated at `93d44d8`; earlier exports remain immutable locally.
Its [fresh QGIS handoff check](evidence/committee-demo-2026-10-25/qgis-handoff.json)
opened that ZIP at a different mount path, with seven valid styled layers and no
invalid geometries. All PDF pages were visually inspected, including comparison
of unchanged renders against the preceding inspected edition.

The executable delivery optimizer remains the separate earlier CLI. This change
does not create real field reports, current resources, verified entrances or an
exhaustive hospital inventory.

## Inspect the implementation

1. The coordinator uses Nemotron for dialogue and intent, without source access
   until the user requests investigation. A greeting starts no workers or watch.
2. The Mission Expert fetches the private Kobo snapshot, projects normalized
   metadata and queries Zetaris. A source catalogue connects every finding to a
   public record identifier, original source where available and statement hash.
3. The Planning Agent streams plan v1 and publishes its immutable document before
   the evaluator task starts. The coordinator announces that handoff by name.
4. The Evaluator Agent reads Kobo and Zetaris again, checks the evidence revision
   and critiques the actual latest plan. Operational gaps and document quality are
   separate: a conditional review draft can be accepted while dispatch stays held.
5. Requested revisions produce complete new plans and an actual unified text diff.
   Earlier drafts and critiques remain available. After at most three versions,
   remaining objections stay explicit rather than implying approval.
6. The final narrative is exported with native QGIS geometry, map, styles, source
   register, coordinate inventories, PDF, draft history and checksummed ZIP.

Public action explanations, source checks and decisions are streamed. Private
reasoning fields and delimiters are rejected or excluded; no private reasoning
transcript is part of the product contract.

## Streaming contract

`MeterlessClient.stream` consumes actual provider SSE and forwards content deltas
immediately into SQLite and `/api/mission/stream`. The browser uses EventSource;
there is no full-answer wait, polling-based token replay or typing timer. Network
frames may contain several tokens. JSON dialogue exposes only the growing reply
field, using NVIDIA JSON mode and the acquired incremental JSON parser.
The [official NVIDIA guidance](https://docs.nvidia.com/nim/large-language-models/2.0.10/get-started/advanced/get-started-nemotron-3.5-lightning.html)
documents JSON mode; the local check verifies it through the installed Nightshift.

The installed Nightshift source revealed that generic modes can add a reasoning
scaffold, select a quality winner before streaming, or replay cached text. Those
behaviors do not prove live generation. Streaming calls now address explicitly
discovered Nemotron models through Nightshift: Lightning for dialogue/investigation;
Ultra for planning, evaluation and the report. Receipts must confirm the requested
model, exactly one phase, a cache miss, no quality buffering and no injected
scaffold. An incomplete stream, token ceiling or missing receipt fails visibly.
Existing nonstreaming CLI routing modes retain their earlier behavior.

Streamdown 2.7.1 supplies Markdown parsing, incomplete emphasis/fence handling,
GFM and memoized blocks. A small extension uses its existing block parser to
render a closed table header while its separator arrives; ambiguous pipe syntax
is withheld until identifiable. Tables use fixed column layout and code scrolls
within its block. Completed content keeps its DOM identity. Following stops when
the reader scrolls away from the bottom; new plan versions do not replace the
draft being read. Current lines still wrap as ordinary text grows.

The handoff area reserves its height through delegation and completion. Opening
a different workspace tab begins at its top; subsequent tokens do not reset a
reader's position. Model startup latency is visible: the accepted run observed
first content between 1.2 and 32.5 seconds, not a fixed response-time guarantee.
Run a fresh request ahead of a three-minute presentation; the complete bounded
workflow may take several minutes. Inspect its live progress and preserved
completed artifacts without presenting historical output as a new generation.

## Evidence and missing inputs

The current account contains four labelled demonstration submissions, including a
forwarded obstruction example; verified field origins remain zero. The acquired
OSM/HOT extract has 5,111 road-related features, of which 5,100 are line geometry,
16 settlement references and seven health features, three tagged hospitals. Its
snapshot is 7 October 2026. Coverage and current operation are not established by
those counts. HOT and OSM are one underlying source, not corroborating sources.

Source inventories provide exact geometry-derived coordinates. Polygon-derived
facility references are boundary vertices, explicitly not verified entrances.
Models receive compact cited facts without coordinate values; narrative numeric
coordinate transcription is rejected. Facility capacity remains unknown.

No usable incident coordinate or surveyed intervention boundary is available in
this demonstration. The blockage Point and intervention-zone Polygon layers are
therefore empty. Community verification candidates are a separate layer, not
invented delivery zones. Existing warehouse/fleet observations remain synthetic
and expired. Null resource records establish an information gap, not absence of
resources in a community.

Publication checks reject unknown citations, uncited factual blocks, placeholders
and unsupported narrative coordinate transcription. Questions and the evaluator's
control verdict alone are not factual claims. One visible publication repair is
allowed per run, preserving the rejected draft and receipt. Structural citation
checks do not prove semantic truth; independent review and human field validation
remain necessary. No domain expert has signed off an operational mission.

## Reproduce on the audited Windows host

Use the existing Kobo, Nightshift and Zetaris configuration described in
[the environment guide](ENVIRONMENT.md) and [community federation](FEDERATED_PLANNING.md).
Keep keys in ignored local stores. With CPython 3.12 x86_64 available:

```powershell
./scripts/setup-report-runtime.ps1 -Python 'C:/absolute/path/python.exe'
docker pull qgis/qgis@sha256:bacafbaf899bb2af5d99dd8a138e0438733aac252ddd5f29d089ad34641bb059
bun run check:report-assets
bun run dev --host 127.0.0.1
```

The four retained wheels install without registry access. Other operating systems
need corresponding wheels for the same pinned versions. QGIS runs from its cached
official image with networking disabled and only the report folder/export script
mounted. Layers are EPSG:4326; map display is EPSG:32632. The exporter writes and
reopens each layer, checks counts/geometry and reopens the saved project. A
one-shot exit after successful validation avoids an observed Qt/SIP teardown
crash; no check is skipped by that workaround.

Open the app and ask to map health facilities in the Bamenda–Bambili corridor and
prepare a committee proposal with evaluator review. Open Activity, Plan, Map,
Evidence and Report as they appear. Disable the 30-minute watch for a single
rehearsal. Other requested areas return a coverage gap rather than invented maps.

Runs stop within ten minutes, reserve at most twelve federation query slots and
three plan versions, with one publication repair and bounded model calls. Output
ceilings are 1,600 tokens for findings, 2,400 for plans, 2,200 for critiques and
3,000 for reports; dialogue is limited to 512. Restart preserves completed
documents and marks partial work interrupted. No durable graph resumption or
month-long scheduler is claimed. A live workflow failure never silently becomes
an offline success; the earlier offline investigation/replay remains explicitly
labelled and separate.

## Acquisition and remaining release work

Acquired packages are pinned and retained in 144 licensed registry archives;
four report wheels have hash/license records. Streamdown is Apache-2.0;
eventsource-parser, partial-json and marked are MIT; diff is BSD-3-Clause.
[Report runtime provenance](../vendor/report-wheels/README.md) records the QGIS
image digest and licenses. Nightshift remains the separately installed proprietary
runtime and is not redistributed here.

Public-news retrieval, general text extraction, live resource ledgers, located
road incidents, actual field confirmation, version-bound human approval,
submission access, video and deployment remain release work. Local test/export
results are separate from hosted CI and from an expert's operational approval.
