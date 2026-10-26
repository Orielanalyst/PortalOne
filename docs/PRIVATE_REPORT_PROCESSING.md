# Private report-text processing — 26 October

The human explicitly authorized report-text transfer to their configured NVIDIA
Nemotron service through Nightshift for extraction. This authorizes processing,
not publishing private narrative or quotes. No account terms, billing or repository
visibility settings were changed for this increment.

## Local configuration

```powershell
bun scripts/configure-report-inference.ts
# Only after the local operator authorizes the stated transfer:
bun scripts/configure-report-inference.ts --apply
```

The first command describes the exact project/provider scope. Apply records it in
ignored `.runtime/mission/report-inference-consent.json`; credentials are never
printed. The committed source contains no enabled authorization for other machines.
The project's UID and configured proxy API URL must match. Disabled/missing/invalid
consent, project drift or a changed provider endpoint holds private processing,
including reuse of cached private readings. Set `enabled` false in that local file
to disable private processing for subsequent investigations. Watches are bounded
in-process jobs, not durable scheduled subscriptions.

## Data flow

Kobo narrative -> scoped policy -> isolated Nemotron Ultra call -> exact source
spans/strict category and assertion checks -> private journal -> shared categorical
projection -> committee findings/plan/evaluation -> redacted PDF/GIS/source pack.

Only narrative text and the form's demo/live label enter the extraction prompt.
Reporter reference fields, raw GPS, credentials and the rest of the source record
do not. Model-returned quotes and place/time mentions are retained locally and
validated against the exact input. No relative time or coordinate is invented.
Demonstration assertions cannot become actual reported observations. Cache identity
includes project, text bytes, interpretation version, mode and visibility.

Shared state, streamed events and downstream prompts contain enum categories and
assertions, source IDs/hashes, generic gaps and model identity. They do not contain
private quotes or extracted place/time strings. Failed responses are retained in
the private journal and stored separately from enumerable error properties, so
routine error logging does not print their content. The exported source register
marks private support but withholds it. Original form metadata remains separately
attributed; a private narrative does not silently overwrite that metadata.

The Sources view opens private support only through the localhost-only evidence
endpoint on an explicit click. It is excluded from ordinary mission state and
downloads. This is a local operator application, not an authenticated hosted
multi-tenant service. An external deployment needs its own access model before
exposing private inspection.

## Live rehearsal

`bun scripts/demo-private-report.ts` describes the operation. Apply submits one
synthetic report containing a fresh private exercise marker to the configured
private Kobo project. Its UUID/narrative are retained in ignored files; uncertain
retries reuse the UUID. The test does not assert a real field incident and never
prints its narrative. The committee then reads the actual submission through the
same configured source. Local support must retain the quote; shared state, SSE,
model documents and every exported member must omit the private marker. PDF text
must also be checked after decompression/text extraction, not only as raw bytes.

Native English/French probes separately verify negative access and unknown health
status. The first v2 Lightning regression failed its output contract; that failure
is retained and Ultra is used for source interpretation. A rejected result becomes
a visible gap, never an accepted fallback. Exact quotes and semantic probes do not
verify field truth, independent origins, current capacity or road clearance.

Remaining work includes public news, precise road matching, real logistics,
version-bound operator approval, durable resumption and submission packaging.

Private-run artifacts and derived metadata remain local. Authorization for model
processing does not authorize publishing their source IDs, timestamps, counts,
receipts, documents or hashes to a public repository. Public disclosure requires
separate operator authorization. Code and generic setup documentation are the
current public checkpoint.

## Quality review remains separate from privacy

The first private run's exports passed private-marker and exact-quote checks, but
its narrative incorrectly generalized an individual zero-claim reading to the
whole batch. That pack was explicitly withdrawn with its bytes retained. The new
dossier computes the full interpretation inventory, and narrative publication checks
validate aggregate counts against it. A follow-up corrected a false positive that
confused zero confirmed incidents with nonzero extracted claims. Field verification
does not follow from either a source-span check or a correct aggregate.
