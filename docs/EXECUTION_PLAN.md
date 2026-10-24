# Execution plan — 2026-10-24

PortalOne / ReliefIntel helps an aid coordinator decide whether to dispatch,
hold, or request verification for one delivery in the Bamenda–Bambili corridor.
Locations are scenario context; road ratings, threats, safe locations and timings
remain labelled synthetic or unverified until supported by permitted evidence.

This plan supersedes the earlier Mbeli flood plan. Existing UI and application
code are an inventoried baseline, not an accepted design for the new product.
No UI redesign is part of the environment audit.

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
| Model provider | Meterless Nightshift / Runtime | Installed 1.2.3; authenticated discovery passes; inference awaits NVIDIA account/key |
| Shared state | Meterless World Model | Apache-2.0 reference vendored at `1742dec`; 10/10 upstream tests, 8/8 compiled conformance and durable feature proof pass |
| Reasoning | Nemotron through Nightshift | Not configured or tested; retain only after a real request identifies the actual provider/model |
| Orchestration | Existing proposed LangGraph JS architecture | Not installed; verify bounded loop, retry/hold and state handling before accepting ADR 0001 |
| Constraints | Existing solver/graph libraries, OR-Tools if necessary | Select the smallest suitable licensed candidate after formalizing the one mission |
| Data | Small permitted or synthetic signal, route, fleet and stock samples | Source manifest and expected outcomes required before loading |
| UI | Existing React application and established map components | Deferred until the core run works; new design comes later |

Use available skills and connectors where they fit. There is no installed Zetaris
connector in this chat; official source helpers supply the diagnostic capability.
Acquisition cap: 30 minutes per critical component, 10 minutes for an optional
component. A documented fallback replaces any optional component that misses it.
Do not treat documentation review as a runtime smoke test. Pin every acquired
dependency and record its license and test result.

## 3. Stack kill list

- Satellite analysis, regional crawling, live GPS and automatic field messages:
  deferred; the first scenario does not depend on their access or latency.
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

Mission request -> bounded Zetaris evidence -> versioned shared state -> planner
and calculation tools -> independent validator -> revise, hold or request
verification -> operator review.

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
| G1 Power + engine | 24 Oct next; cap 2 hours | Nightshift auth + real completion; actual Nemotron identity; World Model reference/conformance result | partial: Nightshift auth/discovery and World Model feature verified; NVIDIA account/key action pending |
| G2 Scenario + data | 25 Oct morning | Small licensed/synthetic pack, source manifest, repeatable registration and joined relief evidence through Zetaris | not started |
| G3 Agent core | 25 Oct | Validator rejects a candidate, planner revises, impossible case holds; bounded run and event trace | not started |
| G4 Changed evidence | 26 Oct morning | Duplicate, contradiction, expiry and new-event cases; affected plan invalidation; safe operator review | not started |
| G5 Interface + rehearsal | 26 Oct | New interface consumes real events; three scenarios run; offline state explicit; video rehearsal | deferred |
| G6 Submission package | 27 Oct by 21:00 | Video, slides, public runnable repo, declarations and sponsor evidence checked | not started |

Official hard deadline: **28 Oct 00:45 Douala = 27 Oct 23:45 UTC**.
The target submission leaves 3 hours 45 minutes of buffer. Do not change the
submission track, repo visibility or account billing as part of this plan audit.

## 6. Three-minute demo

- 0:00–0:25: user, delivery request and clearly labelled scenario assumptions.
- 0:25–1:00: Zetaris evidence joins; show record IDs and freshness.
- 1:00–1:45: candidate rejected for an exact constraint; revision changes it.
- 1:45–2:20: new observation invalidates the recommendation; system revises or holds.
- 2:20–2:45: operator sees evidence, limitations and the action awaiting review.
- 2:45–3:00: actual sponsor query/model/engine receipts and reproducibility entrypoint.

## 7. Risk register

| Risk | Mitigation prepared before dependent work |
|---|---|
| Model or service unavailable | Connection gate, bounded timeouts/retries, labelled input replay; retain a successful live receipt |
| Misleading evidence or infeasible route | Provenance, independent origins, explicit uncertainty/expiry, constraint checks and valid hold outcome |
| Deadline and weak proof of work | Gate timeboxes, fixed demo boundary, coherent commits, dated evidence and early packaging |

Dependency status: Zetaris images and JDBC driver are already local; vendor
platform checks and pinned Python HTTP helpers pass. World Model is pinned,
vendored and smoke-tested. Nightshift authentication/discovery passes; inference
still needs a provider key. Relief data, Nemotron and orchestration remain unverified.

## Accountability and definition of done

For every completed gate: coherent commit; dated build-log entry; source/license
record; appropriate test output; exact commit and input revision; remaining limits.
Maintain `JUDGE_GUIDE.md` as the entrypoint. Runtime events should record run/parent
IDs, UTC timestamps, actor, tool/query, evidence IDs, state/plan version, constraint
result, revision reason, provider/model, duration and final disposition. Record
concise decision explanations, never private chain-of-thought or credentials.

Local typecheck, 21 application tests, 8 compiled engine conformance cases and
production build passed on 24 Oct. These cover the evaluator, provider contract
and state feature; they do not validate the future complete agent loop. GitHub
Actions is blocked by an account billing/spending-limit error; local evidence is
not a green remote run.
