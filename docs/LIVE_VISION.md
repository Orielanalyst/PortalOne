# ReliefIntel: live vision and delivery boundary — 25 October 2026

## Product decision

ReliefIntel turns new community observations and public information into
geographically grounded, evidence-backed delivery recommendations. Its defining
behaviour is an incoming report changing the evidence, invalidating an affected
plan and triggering independent re-evaluation before operator review.

The current synthetic CLI proves part of the decision loop. It is an engineering
baseline, not the complete product or an adequate replacement for live intake.
Live sponsor calls and live observations are separate claims: we have verified
the former over synthetic data; the latter remains to be implemented.

This corrects the 24 October plan's decision to defer signal capture and spatial
grounding. Keep one mission and the Bamenda–Bambili corridor, but implement every
stage of that mission's evidence-to-decision loop. UI design follows those events.

Inputs reviewed in full: the original `BRAINSTORMING.md`, all 1,698 lines of
`HACKATHON_DUMB.md`, the user's attached architectural summary, and the subsequent
API comparison. The raw brainstorming/event documents remain unchanged. This
document records implementation choices; it does not declare every brainstorm
claim to be a verified fact.

## 1. Rubric decode

The supplied event guide weights impact 30, technical execution 20, innovation
15, demo 15, product/UX 10 and sponsor technology 10. The must-see moment is:

> An operator submits an unexpected new report about a place along the mission.
> ReliefIntel preserves its provenance, resolves or flags the location, updates
> the federated evidence and automatically challenges the affected plan. A
> forwarded copy does not become a second independent witness. The operator sees
> a justified revision, hold or request for verification, with exact citations.

An event submitted during the demo is live transport, but its contents remain
labelled as a demonstration report. It is not evidence of an actual incident.
Public source retrieval must show its real publication/observation time and URL.
An empty search is an evidence gap, not a clear road.

## 2. Capability scan and honest current status

| Stage / role | Current implementation | Required next behaviour / acquisition |
|---|---|---|
| Reconnaissance and intake | No live field or public-source connector | Mission area, collection window, source registry, cursors and bounded source refresh; incoming community report endpoint plus one verified external source |
| Signal interpretation | Existing inputs already contain structured road claims | Nemotron through Nightshift extracts category, quoted support, place mentions and observation time from incoming text; unknown fields remain unknown |
| Deduplication and evidence reconciliation | Immutable observation IDs, origin-aware road assessments, forwarded-copy handling | Content fingerprint before inference; bounded paraphrase/event matching without losing original reports or counting forwards as independent witnesses |
| Spatial grounding | Synthetic segment IDs; no gazetteer or real road geometry | Small attributed OSM extract plus curated, sourced aliases; resolve place candidates and uncertainty; Turf candidate for geometry/distance checks |
| Data federation | Real Zetaris joins over static synthetic files and Postgres | Live incident/grounding records in a separate source table joined through Zetaris with logistics and mapped segments; query-visible updates proven |
| Planner and logistics tools | Nemotron selects among four predefined candidates; independent mass, fuel, stock, drive and time checks | Real mapped corridor alternatives, explicit operating policy and deterministic feasibility tools; OR-Tools is an acquisition candidate if convoy allocation needs it, not an installed solver |
| Adversarial checker | Fresh independent source reads and exact constraint violations | Independently check active incidents and policy/geographic exclusions; request targeted evidence when an assumption lacks support |
| Drift detection and replanning | CLI explicitly loads a later simulated snapshot and calls plan review | Ingestion/expiry events automatically find dependent plans, mark them stale and trigger a bounded fresh planning run |
| Operator review and directive | CLI stops at operator-review disposition | Approval bound to mission, logistics, evidence and plan versions; decision invalidated after relevant drift; resumable/restart-safe work |
| Product interface | Earlier scaffold, not connected to core | Event/evidence inspector and map consuming actual run state, intake, violations, uncertainty and operator actions |
| Operational policy and contingencies | Generic delivery deadline and fixed reserve; no sourced curfew/lockdown policy | Versioned, effective-dated policy and explicit abort/hold triggers; safe-harbour alternatives require their own evidence |
| Demand, cargo and fleet allocation | One SKU, one quantity and one selected vehicle | Needs/urgency, cold-chain and multi-vehicle allocation remain in the product vision; first live slice uses one declared cargo class and makes these unsupported cases explicit |

These are logical roles, not a claim that we already run nine autonomous AI
agents. Collection, hashing, arithmetic, geometry, expiry and audit are code/tool
responsibilities. Model calls interpret text and plan bounded investigations;
they do not establish truth, invent coordinates or authorize dispatch.

**User-facing coordination:** one mission coordinator handles the conversation
and dynamically delegates to specialists; users do not manually select agents.
The left conversation and right contextual workspace expose delegated work and
its results. This accepted direction, its boundaries and implementation gate are
recorded in [ADR 0002](adr/0002-coordinator-and-workspace.md). The existing fixed
CLI workflow is not yet this supervisor/subagent runtime.

### Source decisions

| Source | Role and first adoption gate | Current boundary |
|---|---|---|
| WhatsApp tip-line | Preferred community channel from the user's comparison; verify existing business setup, inbound webhook and a received report | Not connected or access-verified; no private-group scraping |
| KoboToolbox | Preferred structured volunteer report source; verify server, project, API access and one submission | Not connected; local collection is still required |
| Telegram Bot API | Alternative community transport when a bot/channel is available; prove a received update and durable offset | Not connected; bot-visible updates are not arbitrary channel search or 30-day history |
| Application field-report endpoint | Immediate common intake contract and demo test surface, independent of provider onboarding | To build; human-entered reports retain their real/demo and unverified status |
| Firecrawl Search / Scrape | Allowlisted public-source discovery and bounded extraction; verify usable results and available quota before adoption | Documentation reviewed; anonymous search returned HTTP 403 locally on 25 October; no working connector or reason for rejection inferred |
| ReliefWeb | Humanitarian context with report dates and citations | Official docs require a pre-approved appname; no approved identifier verified |
| HDX CKAN | Discover small, licensed boundaries/facilities/needs datasets | Dataset-by-dataset coverage, age and license checks required; not a checkpoint feed |
| ACLED | Background conflict context and patterns if permitted access exists | Requires account/authentication; not an assumed live road-status source |
| OSM / Overpass | Attributed mapped roads, place candidates and available road attributes | Coverage/access probe is separate from a product connector; missing load/width/access attributes stay unknown |
| Google Maps | Candidate display/routing provider if coverage, key, cost and storage/display terms fit | No integration verified; Places content is not copied into an unrestricted permanent gazetteer |
| Inngest | Candidate durable scheduling, retries, cancellation and ingestion jobs | Not installed or tested; mission dates and stop conditions still belong in our application |
| Local SMS provider | Later low-connectivity transport after inbound number/access proof | No provider verified; Twilio lists Cameroon two-way SMS as unsupported |
| HOT / satellite / social networks | HOT can supply OSM-derived extracts; satellite and social access remain later extensions | HOT is not independent OSM corroboration; no checkpoint detection or unrestricted network access claimed |

No matching installed Firecrawl, Kobo, Telegram, SMS or maps connector was found
in the tool inventory during this review. Reuse documented APIs or maintained
SDKs/MCPs when selected, with exact versions, licenses and a local smoke test.
Do not add every provider. The first delivery needs one working community intake,
one working public-information source and grounded geography. Access failure
changes the provider choice, not the requirement for live intake.

[25 October access receipt](evidence/live-source-feasibility-2026-10-25.json):
HDX discovery returned HTTP 200 and one metadata record. Firecrawl returned 403;
two Overpass endpoints timed out. No road geometry or relevant field observation
was retrieved. Dataset tags and metadata dates alone do not establish coverage.

## 3. Stack choices and corrections to brainstorming assumptions

Keep Zetaris, Nightshift/Nemotron, World Model and the bounded LangGraph loop.
Reuse the existing constraints, receipts and provenance handling. Acquire mapping,
scheduling and solver components only for a demonstrated requirement. A new
candidate has at most 30 minutes for acquisition and five minutes for its first
smoke test; cap optional provider exploration at ten minutes each. A failed gate
is recorded and a working alternative fills that role.

Defer satellite interpretation, unrestricted social crawling, full regional
coverage, automatic field notifications, fleet telemetry hardware, large vector
infrastructure and all-provider integration. Do not defer the complete signal,
grounding, federation, validation and changed-evidence loop.

Preserve the original ambition while correcting these unverified assumptions:

- A report's source, independence, freshness and support are separate from model
  extraction confidence. The proposed 0.95/0.80/0.35 trust weights are not measured
  probabilities and are not used as proof.
- Semantic similarity suggests event grouping, not source independence. Preserve
  source lineage and contradictory claims; shared wording does not add witnesses.
  Skip duplicate payload inference while retaining receipt/provenance metadata.
- A vernacular place can have several matches. Do not turn a plausible landmark
  into exact coordinates; preserve candidate areas and request confirmation.
- Roads drawn in OSM do not establish present passability, surveyed bridge limits
  or a safe staging location. Geography and operational evidence stay distinct.
- Monday restrictions, curfews, speed penalties, reserve factors and exclusion
  distances in the brainstorm are policy examples. Require explicit provenance,
  effective dates, timezone and expiry; do not assert them as universal local law
  or current conditions. Missing required policy/evidence blocks approval.
- Do not assume Zetaris supports the example PostGIS syntax or a millisecond
  latency target. Smoke-test actual spatial capability. If absent, compute
  bounded geometry matches with an acquired library and federate the resulting
  evidence-to-segment table through Zetaris.
- A 30-day lookback requires accessible history. Show available coverage, gaps
  and query time bounds; do not fabricate history or compress dates silently.
- A successful constraint check is not a signed safety guarantee. Human decisions
  bind to an exact plan version; later relevant evidence withdraws eligibility.

## 4. The one integration and revised build order

Implement this complete path for one corridor:

`new report -> provenance/dedup -> structured claim -> grounded place/segment ->
incident source table -> Zetaris mission join -> World Model dependency change ->
planner/tools -> independent checker -> revision/hold -> version-bound review`

The checker must be able to send a targeted missing-evidence task back to recon
or spatial grounding, within source/query/time budgets. A new claim is not silently
promoted to a confirmed fact. Newly unresolved material can suspend a plan while
verification is requested.

| Order | Time target (Douala) | Concrete acceptance |
|---|---|---|
| A. Contracts and source gate | 25 October next | Single raw-signal/claim/place/event contract; live/replay/demo and source-time distinctions; verified provider/access inventory |
| B. Intake, interpretation and grounding | 25 October | A newly submitted report survives process restart, a forward adds no witness, ambiguous place is flagged; one live public retrieval and a sourced gazetteer/geometry result |
| C. Dynamic federation and feedback | 26 October morning | New incident is visible through Zetaris; affected plan becomes stale automatically; checker requests evidence or forces a revised feasible proposal/hold |
| D. Review/recovery and interface | 26 October | Relevant drift invalidates prior review; interrupted work resumes/restarts without reusing approval; map/evidence inspector shows actual events |
| E. Release rehearsal | 27 October by 21:00 | Live demonstration plus explicitly labelled cached replay; reproducible setup, video, slides and declarations |

These are targets, not achieved gates. Do B/C before expanding standalone approval
storage or polishing the earlier UI. The hard deadline remains 28 October 00:45
Douala (27 October 23:45 UTC), as stated in the supplied event materials.

Collection supports baseline, pre-mission and active-mission phases. Start with
configurable windows, persistent cursors, an end time and bounded polling. Never
promise that a scheduler or a transport provides unavailable historical data.
Source observations use their own event time and receipt time. Wall-clock live
runs and the existing 24 October simulated-clock rehearsal remain separate.

Track the other brainstorm ambitions explicitly: month-long baseline and 72-hour
surge collection are configured windows, not promised source coverage; multilingual
normalization must retain original text and quoted extraction support; semantic
matching is a gated extension after exact deduplication and origin lineage work.
Multi-stop convoys, cold-chain optimization, demand allocation, Pareto alternatives,
telemetry-driven in-transit guidance and verified safe-harbour diversion follow the
first complete live slice. Keep their input contracts extensible without claiming
these capabilities exist. The initial mission has one destination and cargo class;
an unsupported requirement returns a visible limitation instead of silent success.

Fallback is an explicitly labelled cached replay through the same decision path.
A failed live feed is visible as unavailable/stale. It does not turn synthetic
observations into live evidence. Demo logistics remain labelled synthetic until
an actual permitted warehouse/fleet source is available.

## 5. Three-minute demonstration

- 0:00–0:25: mission, real collection window, source availability and demo records.
- 0:25–0:55: actual public retrieval and a community report, with publication,
  observation and receipt times; show exact support rather than a credibility %.
- 0:55–1:20: vernacular landmark resolves to sourced map candidates; a forwarded
  report groups with its original without adding an independent origin.
- 1:20–1:55: Zetaris joins grounded incident state with stock/fleet; show a
  deterministic rejection and the planner's corrected proposal.
- 1:55–2:35: submit a new demonstration report while running; affected plan
  invalidates automatically; checker requests verification, replans or holds.
- 2:35–3:00: show evidence-linked operator review, actual Nemotron identity,
  World Model history and live/cached mode. No actual convoy dispatch occurs.

## 6. Risk register and dependency proof

| Demo risk | Mitigation to implement and prove |
|---|---|
| External onboarding, credits or public API failure | Test access first; source status and bounded timeout; use a proven alternative; retain permitted timestamped samples for visibly offline replay |
| Sparse local evidence or ambiguous geography | Preserve missing/unknown state, source lineage and place candidates; show verification/hold rather than inventing road clearance or a bypass |
| New report arrives during review or process failure | Durable receipt/cursor, idempotent ingestion, affected-plan invalidation, version-bound decision and process-restart test |

Existing vendored, pinned and tested components are recorded in PROVENANCE,
ENVIRONMENT and the judge guide. Turf, OR-Tools, Inngest and the proposed source
connectors are candidates only: none is claimed acquired, vendored or smoke-tested
by this planning document. The live-source probe receipt records limited access
checks, not a connected evidence pipeline.

## Primary documentation reviewed

- [Telegram receiving/access rules](https://core.telegram.org/bots/faq) and
  [update delivery/cursors](https://core.telegram.org/bots/api).
- [Kobo API setup and project access](https://support.kobotoolbox.org/api.html).
- [Firecrawl Search](https://docs.firecrawl.dev/features/search).
- [ReliefWeb approved appname](https://apidoc.reliefweb.int/).
- [ACLED authentication](https://acleddata.com/api-documentation/getting-started).
- [OSM attribution/data license](https://www.openstreetmap.org/copyright) and
  [Overpass service/access guidance](https://wiki.openstreetmap.org/wiki/Overpass_API).
- [Google Places storage/display policies](https://developers.google.com/maps/documentation/places/web-service/policies).
- [Twilio Cameroon inbound SMS availability](https://www.twilio.com/en-us/guidelines/cm/sms).
- [Inngest schedules](https://www.inngest.com/docs/durable-execution/guides-and-advanced/events-and-triggers/schedules-and-delayed-starts),
  [OR-Tools time windows](https://developers.google.com/optimization/routing/vrptw)
  and [Turf source](https://github.com/Turfjs/turf).
