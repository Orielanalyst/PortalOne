# Execution plan — revised 2026-10-25

26 October active priority: [goal 1–4](GOAL_1_TO_4.md) supersedes the older open
implementation list below for public context, road relationships, mission-specific
feasibility and operator review. The implementation is present; native combined
acceptance is still required. Field confirmation, actual NGO resources, durable
scheduling after process restart and the submission package remain distinct work.

26 October, private inference: explicit human authorization resolves the prior
transmission gate for this project/provider. The interpreter processes report_text
under that local scope and keeps private quotations/mentions out of shared output.
The pipeline now has a deterministic interpretation inventory and count checks;
quality-rejected packs are withdrawn with history retained. Public news, road
matching, real resources, human approval and restart-safe scheduling remain open.

26 October: [report interpretation](REPORT_INTERPRETATION.md) feeds checked
quotations/assertions to committee evidence and excludes unsupported access markers
from export. Native example/committee proofs pass, including English/French negation.
Private narrative transmission remains an approval gate after automatic review
rejected it. G3a stays partial: this example-only increment does not complete private
free-text intake, public news or road matching.

Latest: [mission updates](MISSION_UPDATES.md) proves the new committee workflow
automatically replacing a published snapshot after actual Kobo/Zetaris drift,
with real World Model dependencies, a cross-mission diff, historical download
protection and a new native PDF/GIS pack. The repository is public. Exact road
dependencies, real field/resources, human approval, restart scheduling and the
submission package remain separate gates; the completed update loop does not
claim those are finished.

Latest G5 increment: [live committee workflow](COMMITTEE_WORKFLOW.md) now supplies
native streamed findings/plans/critiques, publication before review, actual diffs
and PDF/native GIS handoff. The live receipt and separate final layout/UI checks
bind each result to its executed source. G3a/G4 remain partial for actual field
evidence, executable mission binding, human approval and durable resumption;
G6 submission/public access/video remain open.

PortalOne / ReliefIntel helps an aid coordinator decide whether to dispatch,
hold, or request verification for one delivery in the Bamenda–Bambili corridor.
Locations are scenario context; road ratings, threats, safe locations and timings
remain labelled synthetic or unverified until supported by permitted evidence.

This plan supersedes the earlier Mbeli flood plan. Existing UI and application
code are an inventoried baseline, not an accepted design for the new product.
No UI redesign is part of the environment audit.

**25 October scope correction:** [LIVE_VISION.md](LIVE_VISION.md) restores live
signal intake, deduplication, spatial grounding and automatic evidence-triggered
re-evaluation as required product work. The synthetic CLI is a verified baseline,
not the completed ReliefIntel vision. Its live sponsor calls do not establish
live community or public-source ingestion. The new source checks and build order
in that document take priority over the earlier decision to defer these layers.

## 1. Rubric decode

| Criterion | Points | Proof we intend to show |
|---|---:|---|
| Impact | 30 | One named user can make a specific delivery decision |
| Technical | 20 | Real queries, bounded execution, validation, recovery |
| Innovation | 15 | Changing evidence invalidates a plan and causes justified revision |
| Demo | 15 | Request, rejection, revision, update, operator review in 3 minutes |
| Product & UX | 10 | Evidence, uncertainty, constraints and required action are understandable |
| Sponsor Tech | 10 | Zetaris query, working Meterless Engine and test, Nightshift model receipt |

Provisional track preference: **Reasoning Architecture**. Older repo documents
say Track 02. The registered submission track is not confirmed by this audit;
no HackOS selection has been changed. Select exactly one before submission.
Wildcard is an alternative for extending a prior product, not a tracking tool.
Rules and declaration boundaries are in `PROVENANCE.md`.

## 2. Capability scan and acquisition gates

| Component | Candidate | Current evidence / adoption gate |
|---|---|---|
| Data engine | Existing Zetaris Docker bundle | Vendor verify: 9/9; WSL preflight passes; real sample rows queried |
| Connection diagnostics | Pinned official Zetaris Python helpers | Apache-2.0, vendored locally, catalogue and SQL smoke-tested |
| Model provider | Meterless Nightshift / Runtime | Installed 1.2.3; authenticated discovery and real final-text completion pass |
| Shared state | Meterless World Model | Apache-2.0 reference vendored at `1742dec`; 10/10 upstream tests, 8/8 compiled conformance and durable feature proof pass |
| Reasoning | Nemotron through Nightshift | Live `meterless/auto` completion reported `nvidia/nemotron-3-ultra-550b-a55b`; receipt records identity, timing and tokens |
| Orchestration | LangGraph JS 1.5.2 + Core 1.3.0 | MIT; pinned and archived; conditional-loop smoke and live bounded scenarios pass |
| Constraints | Exhaustive comparison of four predefined route/vehicle candidates | Deterministic mass, payload, fuel, drive type, freshness, corroboration, deadline and earliest-eligible objective; no general route optimizer needed |
| Data | Synthetic v1 pack, isolated Postgres and JSON files | Manifest hashes; counts and joined results independently matched; read-only source query role verified |
| Live signal intake | Private Kobo API plus SQLite | Real submission/read, immutable versions and duplicate handling verified; text extraction and public news still required |
| Dynamic federation | Existing Postgres client and Zetaris | Immutable community projection, restricted roles and exact-batch joins verified; live change invalidates assessments and triggers fresh review |
| Spatial grounding | Attributed OSM/HOT extract and Leaflet 1.9.4 | Real roads/places/facilities rendered; exact community matching and ambiguity preserved; road-segment matching remains |
| UI | React conversation/workspace with real run events | Live conversation clarifies before delegation and discusses findings; investigation/map, preflight and superseded-state receipts verified; executable delivery planning and approval remain |

Use available skills and connectors where they fit. There is no installed Zetaris
connector in this chat; official source helpers supply the diagnostic capability.
Acquisition cap: 30 minutes per critical component, 10 minutes for an optional
component. A documented fallback replaces any optional component that misses it.
Do not treat documentation review as a runtime smoke test. Pin every acquired
dependency and record its license and test result.

## 3. Stack kill list

- Satellite analysis, unrestricted regional crawling, live GPS hardware and
  automatic field messages: deferred. Corridor-specific live intake, public
  retrieval and spatial grounding are required; provider access is gated first.
- Separate vector database, Redis and additional storage services: deferred until
  a measured requirement justifies them. Preserve provenance before similarity.
- All four Meterless Engines: adopt one working engine first.
- Unbounded autonomous exploration or agent debate: use explicit turn, query,
  timeout and context budgets. Full DeepAgents harness remains a candidate only
  if its needed delegation behaviour passes a local smoke test.
- New hosting infrastructure: keep the verified local Zetaris environment; cloud
  deployment and related spend are not prerequisites for the next milestone.
- Free-form model-generated routes and mathematical safety claims: calculations
  and deterministic constraints must support proposed plans.

## 4. The one integration

Mission request and new report -> provenance/deduplication -> structured claim
and spatial grounding -> bounded Zetaris federation -> versioned shared state ->
planner and calculation tools -> independent validator -> revise, hold or request
targeted verification -> version-bound operator review. Incoming relevant
evidence must trigger this re-evaluation without manually starting another demo.

An incoming observation can invalidate an assumption of an earlier recommendation.
Preserve observations, assessments and decisions separately. Every decision links
to evidence IDs, data/state version, constraints, model identity and its revision.
Duplicate forwards do not become independent corroboration. Missing or stale
reports do not automatically clear a corridor. Human approval is bound to a plan
version; a relevant change invalidates that approval.

Initial runtime limits: two revision attempts, twelve data queries, fifty rows
per query, thirty seconds per query and a five-minute overall run deadline.
Model-call limits must fit inside that overall deadline. Exceeding a budget ends
in an explicit hold or verification request, not another unbounded retry.

Fallback: replay labelled input observations through the same bounded decision
logic and fixture adapter. An offline run is visibly offline and cannot stand in
for the separate evidence of working sponsor integrations. Do not hardcode answers.

## 5. Gates and target dates

Dates below are in Africa/Douala (UTC+1). Estimates are timeboxes, not verified
completion times. Each gate requires its acceptance evidence before marking done.

| Gate | Target | Exit evidence | Status |
|---|---|---|---|
| G0 Accountability + environment | 24 Oct | Baseline manifest, truthful judge index, local checks, Zetaris read smoke | verified locally; remote CI blocked |
| G1 Power + engine | 24 Oct next; cap 2 hours | Nightshift auth + real completion; actual Nemotron identity; World Model reference/conformance result | verified locally: World Model feature, auth rejection and final-text Nemotron completion; see runtime receipt |
| G2 Scenario + data | 25 Oct morning | Small licensed/synthetic pack, source manifest, repeatable registration and joined relief evidence through Zetaris | verified locally on 24 Oct; provisioning and cross-source receipts linked in judge guide |
| G3 Agent core | 25 Oct | Validator rejects a candidate, planner revises, impossible case holds; bounded run and event trace | verified locally on 24 Oct; live Nightshift/Zetaris trace plus explicit offline replay |
| G3a Live intake + grounding | 25 Oct next | Newly received report, durable provenance/cursor, duplicate handling, structured extraction and sourced place/segment candidates; external source access proof | partial: real Kobo transport, versioned intake, attributed map and community grounding pass; text extraction, public news and segment candidates remain |
| G3b Dynamic federation | 26 Oct morning | Incoming claim becomes query-visible in Zetaris and automatically invalidates affected plans; checker requests evidence/revision/hold | implemented for project-scoped planning assessments: real joins, drift invalidation and fresh preflight; executable route-plan dependencies remain |
| G4 Changed evidence + review | 26 Oct | Duplicate, contradiction, expiry and new-event cases; full dependency invalidation; version-bound operator review and recovery | partial: new/removed reports, logistics drift and freshness can invalidate assessments; checker-driven preflight revision works; full executable-plan binding, approval, durable scheduling and graph resumption remain |
| G5 Interface + rehearsal | 26 Oct | New interface consumes real events; three scenarios run; offline state explicit; video rehearsal | partial: real investigation events/map and explicit offline browser path work; full delivery scenarios and video remain |
| G6 Submission package | 27 Oct by 21:00 | Video, slides, public runnable repo, declarations and sponsor evidence checked | not started |

Official hard deadline: **28 Oct 00:45 Douala = 27 Oct 23:45 UTC**.
The target submission leaves 3 hours 45 minutes of buffer. Do not change the
submission track, repo visibility or account billing as part of this plan audit.
G3a/G3b now precede expanding standalone review storage or interface polish.

## 6. Three-minute demo

- 0:00–0:25: user, delivery request, collection window and labelled demo records.
- 0:25–1:20: public retrieval/community intake, forwarded-copy handling and
  vernacular place grounding with provenance and uncertainty.
- 1:20–1:55: Zetaris evidence joins, exact constraint rejection and corrected plan.
- 1:55–2:35: a newly submitted demonstration report automatically invalidates the
  affected recommendation; the system verifies, revises or holds.
- 2:35–3:00: evidence-linked operator review, actual model/engine receipts and mode.

This is the target demonstration, not a claim that live intake or the new UI
already works. The detailed acceptance boundary is in LIVE_VISION.md.

## 7. Risk register

| Risk | Mitigation prepared before dependent work |
|---|---|
| Model or service unavailable | Connection gate, bounded timeouts/retries, labelled input replay; retain a successful live receipt |
| Misleading evidence or infeasible route | Provenance, independent origins, explicit uncertainty/expiry, constraint checks and valid hold outcome |
| Deadline and weak proof of work | Gate timeboxes, fixed demo boundary, coherent commits, dated evidence and early packaging |

Dependency status: Zetaris images and JDBC driver are already local; vendor
platform checks and pinned Python HTTP helpers pass. World Model is pinned,
vendored and smoke-tested. Nightshift authentication/discovery and a real Nemotron
completion pass. Relief federation and the bounded LangGraph core pass live
synthetic scenarios. Thirty adopted package archives are retained with
integrity and license evidence. Routing modes can choose different models later;
each call records its returned identity. A full 50-row page fails closed because
it might omit another origin. LangGraph runs are not yet resumable after process
failure; completed receipts and World Model state are persisted.

## Accountability and definition of done

For every completed gate: coherent commit; dated build-log entry; source/license
record; appropriate test output; exact commit and input revision; remaining limits.
Maintain `JUDGE_GUIDE.md` as the entrypoint. Runtime events should record run/parent
IDs, UTC timestamps, actor, tool/query, evidence IDs, state/plan version, constraint
result, revision reason, provider/model, duration and final disposition. Record
concise decision explanations, never private chain-of-thought or credentials.

Local typecheck, 40 application tests, 8 compiled engine conformance cases and
production build passed on 24 Oct. These cover the evaluator, provider contract
and state/data/agent core. They do not validate the deferred interface or approval workflow. GitHub
Actions is blocked by an account billing/spending-limit error; local evidence is
not a green remote run.
