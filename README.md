# PortalOne

**Evidence-grounded relief delivery proposals.**

PortalOne combines logistics and road reports, proposes a delivery plan, rejects
constraint violations and revises or holds. Eligible proposals stop for operator
review. Demonstrations use explicitly labelled reports/scenarios and authorize no dispatch.

Built for the **Open Agent Hackathon 2026**. Primary track is pending confirmation;
the current plan provisionally targets *Reasoning Architecture*.

## Status

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
