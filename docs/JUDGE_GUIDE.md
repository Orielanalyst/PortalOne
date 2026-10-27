# Judge guide

**ReliefIntel · Open Agent Hackathon 2026 · Solving Fragmented Intelligence**

ReliefIntel addresses pre-intervention intelligence for local NGOs and relief committees, with an initial Bamenda–Bambili demonstration in North-West Cameroon. The product joins fragmented evidence, delegates an investigation, generates maps and proposals, evaluates/revises them, and reopens review when their evidence basis changes. The founder brings five years of NGO experience.

Start with the [README](../README.md) for impact, architecture, sponsor roles, setup and the current operational boundary.

## Review path

| Question | Open | Evidence boundary |
|---|---|---|
| Does the system talk naturally before delegating? | [Conversational coordinator proof](evidence/coordinator-conversation-2026-10-25.json) | Actual model-backed greeting/clarification and findings-grounded follow-up; no workers started by a greeting. |
| Does Zetaris perform real cross-source work? | [Core data receipt](evidence/relief-data-2026-10-24.json), [federated live change](evidence/federated-live-change-2026-10-25.json) | Real queries over registered structured sources; logistics are rehearsal data and community records are labelled demonstrations. |
| Are drafts and evaluations real model work? | [Committee receipt](evidence/committee-workflow-2026-10-25.json) | Actual provider deltas, v1 publication before evaluation, critique, v2 and text diff. Source commit, model and artifact identities are retained. |
| Does new evidence change the plan's status? | [Changed-evidence receipt](evidence/mission-update-2026-10-25.json) | A newly submitted Kobo demonstration supersedes a proposal and triggers a replacement; old PDF bytes remain unchanged. |
| Can the product hand off something usable? | [Published PDF](evidence/private-inference-demo-2026-10-26/report.pdf), [GIS ZIP](evidence/private-inference-demo-2026-10-26/committee-pack.zip), [validation](evidence/private-inference-2026-10-26.json) | Actual 16-page historical report and seven-layer native GIS pack, separately authorized for publication. Eight demo reports, six extracted claims, zero verified incidents. |
| What does the later integrated build add? | [Mission-to-review acceptance](GOAL_1_TO_4.md), [cartography](MAP_CARTOGRAPHY.md) | Local native proof of mission inputs, mapped-route calculations, reviewed revisions, exact-version decisions, change withdrawal, restart behavior and an eleven-layer atlas. New private-run packs remain local. |

The prepared HackOS materials include a 2:46 product recording and a ten-slide pitch deck. A recorded, shortened workflow is not a claim that every complete live run finishes within the film's duration.

## Implementation entry points

| Responsibility | Source |
|---|---|
| Conversation, clarification and specialist delegation | [mission-coordinator.ts](../src/lib/server/mission-coordinator.ts) |
| Investigate → plan → evaluate → revise → report | [committee-mission.ts](../src/lib/server/committee-mission.ts) |
| Bounded federation and source projection | [zetaris.ts](../src/lib/server/zetaris.ts), [community-evidence.ts](../src/lib/server/community-evidence.ts) |
| Native Nightshift/Nemotron streaming and receipts | [meterless.ts](../src/lib/server/meterless.ts) |
| Versioned requirements and deterministic resource checks | [mission-requirements.ts](../src/lib/server/mission-requirements.ts), [mission-feasibility.ts](../src/lib/server/mission-feasibility.ts) |
| Evidence-dependent proposal invalidation | [mission-world.ts](../src/lib/server/mission-world.ts), [pinned World Model](../vendor/meterless-world-model) |
| Source-backed route geometry | [mapped-route.ts](../src/lib/server/mapped-route.ts) |
| Downloadable reports and native GIS | [committee-export.ts](../src/lib/server/committee-export.ts), [export-qgis.py](../scripts/export-qgis.py) |

## Reproduce and verify

The [README quickstart](../README.md#run-reliefintel) separates credential-free offline replay from actual live services. Live setup requires the sponsor runtimes, an owned Kobo project, configured credentials and the report runtime. There is no silent replay fallback.

Recorded implementation gate at [`fd988f0`](https://github.com/Orielanalyst/PortalOne/commit/fd988f0): **173 tests in 22 files, typecheck, production build, 8/8 World Model checks, 154 retained archive checks, four report-wheel checks and both HTTP-disabled replays passed locally.** The last inspected GitHub Actions runs could not start because of the account billing lock; local results do not claim hosted CI success.

```powershell
bun run typecheck
bun run test
bun run check:world-model
bun run check:vendor
bun run check:report-assets
bun run check:offline-replay
bun run check:mission-replay
bun run build
```

The core CLI's first overweight proposal is an explicit stress-test fixture. Subsequent live model responses, deterministic rejections and the separate offline enumeration path are identified in their own receipts. Review mode and source commit before comparing runs.

## Read the operational boundary

The current acquired coverage is one corridor. Rehearsal reports and logistics are synthetic, field origins are unverified, facility capacity/operation and current road passability require local confirmation, and empty surveyed-zone layers remain empty. Public humanitarian records provide context, not corroboration of a current local incident. Source failure remains visible.

The committee approves an exact proposal; field and endpoint holds remain, and no travel is authorized. The watch is bounded and owned by one local process; it is not a durable month-long collection service. Restart preserves history and requires fresh review. NGO deployment outcomes and time savings await a supervised pilot.

## Review provenance and history

- [PROVENANCE.md](PROVENANCE.md): earlier concept/reference prototype, baseline, actual reuse and acquired components. Starting a new repository does not remove declaration obligations.
- [AI_USAGE.md](AI_USAGE.md): human direction, coding assistance, model-generated content and deterministic checks.
- [BUILD_LOG.md](BUILD_LOG.md), [commit policy](COMMIT_POLICY.md), [baseline manifest](evidence/baseline-2026-10-24.json): dated work boundaries and inspectable history. The 24 October checkpoint is not a backdated build-window snapshot.
- [Private-processing contract](PRIVATE_REPORT_PROCESSING.md): operator-scoped inference consent, categorical sharing and local-only private quotations/mentions. A fresh checkout does not inherit another operator's authorization.

Public artifacts are specifically authorized, dated snapshots. Their counts and layer sets are not relabelled as later runs. The image embedded in the README is an unchanged extraction from the already-public 26 October pack. No new private mission journal, narrative, credentials or report is published by this documentation update.
