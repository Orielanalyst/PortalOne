# Community investigation — verified 25 October 2026

The local interface now connects actual Kobo API intake, durable report versions,
Nemotron delegation through Nightshift, attributed community geography and an
independent readiness check. It is the first investigation slice, not the completed
live delivery planner. All submitted test observations are explicitly demonstration
records; no actual field incident has been verified. The subsequent
[federated planning preflight](FEDERATED_PLANNING.md) connects this intake to
Zetaris, an isolated planning worker and independently checked assessment revisions.

## Run locally

Use Bun 1.4.4 and Node 24.15.0 or a compatible Node 24 release. Node's built-in
SQLite provides persistence without another database service. Install the locked
packages with `bun install --frozen-lockfile`.

For live mode, keep these values only in ignored `.env`:

```dotenv
RELIEFINTEL_MODE=live
KOBO_SERVER_URL=https://kf.kobotoolbox.org
KOBO_PROJECT_UID=your_project_uid
KOBO_API_TOKEN=your_private_token
METERLESS_BASE_URL=http://127.0.0.1:8088/v1
```

The NVIDIA key stays in Nightshift. The application reads its local runtime token
without printing either key. Live mode also needs the running local Zetaris/relief
database and [community source provisioning](FEDERATED_PLANNING.md#reproduce).
Start Nightshift, then `bun run dev --host 127.0.0.1`
and open the printed local URL. Send a mission to the single coordinator. Activity,
Map, Evidence and Brief inspect the same investigation. Users never launch workers.

For an account/project not yet prepared:

```sh
bun run setup:kobo
bun run setup:kobo --apply
bun run setup:kobo --apply --deploy
bun run check:kobo
```

The first command prints a plan. Apply creates/reuses only the marked ReliefIntel
project; deployment compiles and activates it. Project data remains private and
web collection requires authentication. The form captures observation time,
community name, optional GPS, category, text, source relationship and an optional
pseudonymous origin reference. Demonstration is the default mode. It requests no
names or phone numbers and does not establish reporter identity.

`bun run check:kobo --submit-demo` writes one labelled Bambili transport test.
`--demo-place=Bambui` or `--demo-place=Balewa` selects a separate test. UUIDs are
saved before transmission and reused on retry. No incident or need is asserted.
Kobo's deployed OpenRosa form ID is its asset UID; the draft id_string returned
by `.xml` is not the deployed submission ID. This was verified through formList
after the initial wrong-ID requests returned 404. Correct submission returned 201,
and the v2 JSON endpoint returned the same record.

Primary contracts: [Kobo API introduction](https://support.kobotoolbox.org/api),
[current submission endpoint notice](https://github.com/kobotoolbox/kpi/blob/main/REMOVALS.md),
and the actual server's `/api/v2/schema/?format=json`. Credentials never enter URLs.

## What the coordinator actually does

The model selects registered specialist tasks within evidence gates. It can check
readiness early, but final synthesis requires collection, mapping, targeted
gap follow-up, a federated planning assessment and a fresh independent check. Nested LangGraph workers receive
source/mapping task context; raw reports and the full conversation are not
broadcast. Source retrieval and geometry are deterministic tool workers, not
additional autonomous model personas. No DeepAgents harness is claimed installed.

The mapping worker matches exact normalized OSM community names. Unknown names
remain unresolved; duplicate names remain multiple candidates. A place centroid
does not locate an incident on a road. Reporter GPS remains unverified and is
rounded to about 100 metres in the workspace; exact GPS and origin references
remain private. The checker reloads Kobo independently and cannot approve travel.

The model receives bounded finding summaries, counts and a few example evidence
IDs, not report text or raw tables. Model receipts record routing mode, actual
response model, timing and tokens. Private reasoning and provider error payloads
are excluded. The extended slice allows eight specialist delegations, two planning
attempts, two delegation corrections, twelve reserved SELECT slots, 128 output
tokens per call, 45 seconds per call and a five-minute run deadline. Contract failure,
timeout or repeated invalid delegation ends in hold.

SQLite commits raw input and immutable normalized versions together. Repeated
reads add no new version. Edits update the current head while preserving old
versions for historical briefs. Matching text and forwarded copies never create
verified origins. Full reconciliation, capped at 1,000 records, sees edits to old
IDs; it does not use an increment-only ID cursor. Incomplete or unstable scans
fail. API pagination is not a transactional snapshot. Missing records remain in
history and are excluded from a fresh investigation rather than silently clearing
a corridor.

## Monitoring and recovery boundary

An operator can enable a 30-minute watch. The local process polls every 20 seconds;
new or edited versions automatically start a bounded investigation in the same
session. Unchanged polls make no model calls. Source failure is visible and cached
reports cannot clear a hold. Stop disables future polls; it does not cancel a run
already in progress. This is an in-process demonstration scheduler, not Inngest or
a durable month-long collection service. The extended federation poll detects
changed/removed records, logistics drift and logistics freshness boundaries;
it invalidates planning assessments and allows at most six automatic reviews per
watch. Report-expiry policy, affected-route invalidation and durable jobs remain.

Completed observations, tasks, public events and briefs survive a restart.
Incomplete runs become interrupted; monitoring pauses and a new investigation is
required. The graph does not resume a partially completed model call. One local
server process owns the journal; multi-worker deployment is not supported yet.

## Offline rehearsal

Set `RELIEFINTEL_MODE=offline-replay` and restart the application. A separate journal,
two explicitly synthetic report fixtures and deterministic task selection provide
the same tabs and acquired map. The header says OFFLINE REPLAY; no model, live
intake or automatic monitoring is claimed. There is no silent fallback from live.

```sh
bun run check:mission-replay
bun run check:vendor
bun run test
bun run typecheck
bun run build
```

The replay check disables HTTP entirely. Map geometry is committed and hash-checked;
Leaflet, its CSS and parser packages are retained locally. No external tile,
font or geocoding service is required. See the [map attribution and provenance](../data/community-map-v1/README.md).

## Remaining integration

Report metadata now feeds Zetaris and the planning preflight. The existing route
optimizer remains a separate CLI over synthetic stock, fleet and route candidates.
Text extraction, sourced road-segment matching, public news, full executable-plan
version binding, human approval and affected-route invalidation remain required.
Planning-assessment invalidation and independent query receipts are implemented.
New investigations currently take a
fresh mission message; multi-turn conversational mission memory is not implemented.
Local loopback checks protect the operator API; public hosting requires real
authentication and reporter access control before deployment.
