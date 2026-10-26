# PortalOne

**Evidence-grounded relief delivery proposals.**

PortalOne combines logistics and road reports, proposes a delivery plan, rejects
constraint violations and revises or holds. Eligible proposals stop for operator
review. Demonstrations use explicitly labelled reports/scenarios and authorize no dispatch.

Built for the **Open Agent Hackathon 2026**. Primary track is pending confirmation;
the current plan provisionally targets *Reasoning Architecture*.

## Status

26 October, reviewed evidence publication: the operator separately authorized the
redacted synthetic-demo [16-page PDF](docs/evidence/private-inference-demo-2026-10-26/report.pdf),
[QGIS/geodata pack](docs/evidence/private-inference-demo-2026-10-26/committee-pack.zip)
and [minimal validation receipt](docs/evidence/private-inference-2026-10-26.json).
Eight demonstration reports yield six extracted text claims and zero verified
incidents. The final committee reused eight authorized readings and streamed 806
document updates. Private narrative, quotations and extracted mentions stay local.

26 October, private processing: the operator explicitly authorized private/live
Kobo report-text inference through their configured NVIDIA/Nightshift service.
Scoped authorization is enabled locally; private quotations and extracted mentions
stay out of shared state, model documents and downloads. Only derived categorical
assertions and provenance enter committee evidence. Fresh clones hold private text
until their own operator configures authorization. See
[processing and export boundaries](docs/PRIVATE_REPORT_PROCESSING.md).

Earlier on 26 October: committee investigations read eligible report text, retain checked
source quotes and reuse unchanged readings. Native English/French probes preserve
negation and unknown status. The new committee run streamed 2,042 updates through
a reviewed plan and PDF/GIS export. That checkpoint allowed only exact published
synthetic examples; other narratives stayed local pending authorization. Four empty
readings remain not understood and three assert no observation. See
[scope and limits](docs/REPORT_INTERPRETATION.md),
[live proof](docs/evidence/report-interpretation-2026-10-26.json) and
[the new PDF](docs/evidence/report-interpretation-demo-2026-10-26/report.pdf).

Latest, 25 October: an actual new Kobo demonstration triggered a replacement
committee review through Zetaris, Meterless World Model and native Nemotron
streaming. The older plan became superseded, its original PDF bytes stayed
unchanged, and a fresh PDF/GIS pack passed final source checks. Two live runs
observed 2,822 incremental updates. See [mission updates](docs/MISSION_UPDATES.md),
[the source-bound receipt](docs/evidence/mission-update-2026-10-25.json), and the
[15-page replacement PDF](docs/evidence/mission-update-demo-2026-10-25/report.pdf).
Seven labelled demonstrations and zero verified field origins remain explicit.

25 October, latest: the browser now streams cited findings, publishes plan v1
before evaluation, shows the actual revision diff and produces a downloadable
committee PDF plus native QGIS/GeoPackage/GeoJSON pack. The live rehearsal observed
4,927 incremental updates. See [workflow, evidence and limits](docs/COMMITTEE_WORKFLOW.md)
and the [review draft PDF](docs/evidence/committee-demo-2026-10-25/report.pdf).
This is the acquired Bamenda–Bambili demonstration corridor; field conditions,
capacities and real resources still require confirmation.

Core CLI verified, 24 October. Real Zetaris queries join isolated Postgres logistics
and JSON route/report fixtures. LangGraph runs a bounded planner–validator loop
through Nightshift/Nemotron. World Model tracks evidence and invalidates affected
plans. The live demonstration rejects an overweight draft, revises, replans after
a contradictory report and holds an impossible deadline. An explicit offline
enumeration replay uses the same validator.

25 October: the browser connects private Kobo intake, a Nemotron coordinator,
isolated source/mapping/planning workers and independently checked Zetaris queries.
A new demonstration report became query-visible, invalidated the earlier assessment
and automatically triggered a fresh review. The workspace shows actual traces,
attributed OSM geography and separate planning/checker query receipts. See
[the live proof and planning limits](docs/FEDERATED_PLANNING.md).
The [conversational coordinator](docs/CONVERSATIONAL_COORDINATOR.md) responds to
greetings, clarifies context before delegation and discusses recorded findings.
The connected planning worker identifies the next verification action; executable
route planning remains a separate CLI. Logistics are synthetic and expired, all
cloud transport tests are demonstration records, and approval remains a build gate.
GitHub Actions has failed at startup before jobs run; local passes are separate.

Start with [the judge guide](docs/JUDGE_GUIDE.md), [current execution plan](docs/EXECUTION_PLAN.md)
and [verified environment status](docs/ENVIRONMENT.md).

## Tracking

The history is the submission, so the rails are explicit:

- `docs/EXECUTION_PLAN.md` — current gates, acceptance evidence and scope
- `docs/BUILD_PLAN.md` — preserved historical plan
- `docs/JUDGE_GUIDE.md` — review entrypoint and verified/planned distinction
- `docs/evidence/` — dated baseline and diagnostic receipts
- `docs/COMMIT_POLICY.md` — how commits stay small, green and append-only
- `docs/BUILD_LOG.md` — the dated session narrative
- `docs/PROVENANCE.md` — what came from the earlier reference prototype
- `docs/AI_USAGE.md` — AI tool disclosure
- `docs/adr/` — architecture decisions

Run `powershell -File scripts/setup-hooks.ps1` once per clone to enable the
secret scan and the pre-push verification.

## Run

```sh
bun install --frozen-lockfile
bun run dev --host 127.0.0.1
```

## Verify

```sh
bun run test
bun run build
bun run typecheck
bun run check:vendor
bun run check:offline-replay
bun run check:mission-replay
```

Run `bun run demo:relief-agent` for the offline core demonstration, or
`bun run demo:relief-agent --live` with the configured local sponsor services.
The live path uses model credits. Reproduction and setup are in
[ENVIRONMENT.md](docs/ENVIRONMENT.md); the initial overweight draft is an explicit
stress-test fixture, not a claimed AI output or human approval.

## Environment

Copy `.env.example` to `.env` and fill in the server-side configuration. `.env`
is ignored and credentials must never use a `VITE_` prefix. See `docs/ENVIRONMENT.md`
for the tested local Zetaris UI origin and the repeatable connection check.
The browser consumes live intake, federation and planning assessments. Reproduction
requires the local sponsor services and community source provisioning documented in
[FEDERATED_PLANNING.md](docs/FEDERATED_PLANNING.md).

## Layout

```
src/routes/       file-based routes (TanStack Start)
src/lib/          domain model and adapters
src/styles.css    design tokens
```
