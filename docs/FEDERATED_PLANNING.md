# Live community evidence and planning preflight

This extends the earlier intake/map slice. Actual Kobo metadata is now committed
to an isolated PostgreSQL schema and queried through Zetaris alongside community
place candidates and the registered rehearsal logistics. Nemotron's isolated
planning worker sees the compact results, not raw report text. An independent
worker fetches Kobo and queries Zetaris again before checking the assessment.

This is a planning preflight, not an executable delivery plan. Stock/fleet remain
synthetic, dated 24 October and expired. No actual field incident, road clearance,
vehicle dispatch or approval is established by a demonstration report.

The [25 October live-change receipt](evidence/federated-live-change-2026-10-25.json)
binds this proof to application commit `46c62b18ac53de0da2259ab518208f03ed725404`.
Kobo changed from three to four demonstration reports, including one forwarded
record. Zetaris returned the new version, the earlier assessment was invalidated,
and an automatic same-session review completed with separate fresh checker queries.
All five transport/change assertions passed. Verified field origins and dispatch
authorization remained zero/false. The rehearsal stopped its own watch afterward.

## Reproduce

Start the existing Docker/Zetaris stack, owned relief database and Nightshift.
Keep the configured credentials in ignored local files. From the project root:

```sh
bun run provision:community-data
bun run provision:community-data --apply
bun run check:community-data
bun run demo:mission-coordinator
```

Provisioning defaults to printing a plan. Apply verifies the existing container's
ownership label and pinned image, then adds only `community_v1` and the registered
`PORTALONE_COMMUNITY_V1` source. It does not reset the original scenario, database,
metastore or source registrations. The installed PostgreSQL client is reused
through Docker's existing local interface; no dependency, TCP port or service was
added. This is a local deployment arrangement, not a production Docker-access model.

The writer can INSERT/SELECT the immutable metadata tables, but cannot read the
stock table or update existing report records. Zetaris's community reader is
SELECT-only. Provisioning verifies those privileges and the 16-place map revision.
The source description must obey Zetaris's restricted punctuation; an initial
semicolon in the description was rejected and corrected before registration.

The model gets two bounded SELECT results:

1. An exact-batch summary verifies source count, demonstration/live modes and
   forwarded records. The batch ID hashes normalized versions and map identity.
2. A grouped query joins reports, candidate places, declared destination/depot
   scope, stock and fleet. Global report counts are not summed across ambiguous
   place alternatives. Future or expired logistics are unavailable; multiple
   unaggregated stock matches fail as unexpected fan-out.

Round-trip counts and every community group are checked against the ingested
metadata. Stale batches, missing groups, unexpected duplicates, map mismatches and
the existing 50-row boundary fail closed. Raw report text, claimed reporter
references and GPS are not copied to this source. The original inputs remain in
the private SQLite journal.

Only Bambili currently has a declared rehearsal association to the synthetic
Bamenda depot. This does not locate stock in Bambili or establish a real NGO
warehouse. Other communities show unknown stock/fleet rather than zero supplies.

## Changed evidence and independent checks

Planning assessments persist their input revision, compact result, model advice
and query receipts. The checker stores its own separate result and query IDs.
Checked means the evidence basis matched an independent read; operational status
remains hold. A new revision invalidates earlier assessments using that source.
Invalidation is irreversible, and the interface labels historical assessments
superseded rather than silently updating their old facts.

This first dependency scope is the dedicated community project/corridor, because
the planner receives that entire bounded context. It is deliberately conservative:
it does not claim precise affected-road or convoy dependency analysis. If the
checker sees drift during a run, it rejects the assessment and sends it back to
logistics for one fresh planning attempt and another independent query.

The supervisor may receive at most two corrections for a rejected delegation.
These corrections preserve the evidence gates and appear in the trace. Actual
early integration runs attempted to skip planning and correctly held; explicit
allowed-task feedback enabled the completed run. No rejected action is silently
executed. The run has at most eight delegations, two planning attempts, twelve
reserved SELECT slots, 128 output tokens per call and a five-minute deadline.

A watch polls every 20 seconds, up to 30 minutes, with a 30-second refresh bound.
It checks federation even when Kobo IDs are unchanged, so removed records,
logistics changes and logistics freshness boundaries can change the context.
Unchanged results make no model calls. Changed context triggers a fresh review;
at most six automatic reviews are allowed per watch. Stop/expiry discards late
poll results. This remains an in-process scheduler; restart pauses monitoring.

## Live-change rehearsal

Start the local live-mode interface with `bun run dev --host 127.0.0.1`. Commit
application changes and restart it so the runtime's commit marker matches HEAD.

```sh
bun scripts/demo-live-change.ts
bun scripts/demo-live-change.ts --apply --evidence
```

The default prints the plan. Apply establishes a checked baseline, submits one
explicit demonstration of a forwarded obstruction report through the actual
private Kobo API, and waits for the application monitor. It asserts that the
report becomes query-visible, the old assessment is invalidated and the new one
has a fresh independent check. Forwarding never becomes verified corroboration.
The script then stops its watch and records source hashes, revisions, model
receipts and both sets of queries. It requires a demo-only project for public
evidence and refuses to reuse an already-present demonstration UUID or overwrite
an existing public receipt. Subsequent rehearsals can use a new explicitly labelled
form submission and inspect the same pipeline without fabricating a new transport.

## Remaining product work

The earlier finite route/vehicle optimizer and its deterministic mass/fuel/time
validator remain a separate CLI. Connecting an executable route proposal needs
mission requirements, actual incident-to-road matching and an operating policy.
Public news, free-text extraction, verified origins, real warehouse/fleet data,
version-bound human approval and durable month-long scheduling remain required.
No unsupported field is filled with a model guess.
