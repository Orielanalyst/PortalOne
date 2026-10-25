# Build log

A short, dated narrative. The git history is the detail; this is the story a
judge can follow.

## 2026-10-23

- `6c13246` scaffold PortalOne (TanStack Start + Tailwind), without the Lovable
  config or unused shadcn components.
- `99409fa` derive mission verdicts from evidence; 9 unit tests. The evaluator
  rejects, holds or approves a plan from records, not from scripted copy.
- Tracking rails: build plan, commit policy, CI, provenance, AI usage and local
  hooks.
- Tag `v0.1-tracking` marks the end of setup.
- The mission-control view components are stashed until the agent event contract
  is fixed.

**Next:** accept ADR 0001, add the shared event contract and the graph skeleton.

**Blockers:** Zetaris bundle, Nightshift runtime token, reboot for WSL2.

## 2026-10-24 — accountability and environment review

The 23 October entries above are historical claims. This audit supersedes their
setup blockers and the old flood/UI plan; it does not rewrite earlier history.

- Read all brainstorming and saved hackathon material, then checked the public
  event rules with all sections expanded. Clarified Wildcard and reuse disclosure.
- Recorded audit-start HEAD `42fb95c`, original commit `6c13246`, preserved tag
  `v0.1-tracking`, and the existing UI stash. Raw brainstorming and hackathon
  reference documents were already untracked; they remain untouched.
- Verified Docker Engine 29.9.2, Compose 5.6.1, WSL2 and Ubuntu. Host RAM is about
  31.7 GiB; Docker reports about 15.49 GiB and 12 CPUs.
- Zetaris long-running services are healthy; init/bootstrap exited successfully.
  Vendor `verify.sh` passed all 9 checks. Vendor `preflight.sh` passed in Ubuntu
  WSL with the expected existing-volume warning. No volumes were reset.
- A Git Bash preflight initially reported missing registry login. WSL preflight
  and a registry manifest read succeeded; use the documented WSL path on Windows.
- Queried real NY Taxi sample rows. Vendored official Apache-2.0 diagnostic helpers
  at `6a2fbaa47c32c9ac33f6584c64b43b146c621bed` and smoke-tested catalogue/SQL access.
- Created an ignored local `.env` from the existing bundle account; no credentials
  were printed or committed. Updated `.env.example` with the tested local UI
  origin and username/password option. This is configuration and diagnostic
  access, not an implemented application adapter.
- Local typecheck passed. Tests initially encountered a sandbox temporary-file
  permission error; outside the sandbox all 9 passed and the production build
  passed. The tests cover the existing evaluator, not the new relief-agent loop.
- GitHub repository remains private. Remote Actions runs show `startup_failure`;
  the run page says account payments/spending limits prevented startup. This
  audit did not change billing, visibility or HackOS selections.
- Nightshift's documented candidate ports did not respond. Meterless Engines,
  Nemotron, relief datasets and the new agent runtime remain unverified.
- Extended the verification workflow to all push branches and manual dispatch;
  added the production build to pre-push checks. Workflow YAML parses locally.
  This prepares future checks but does not resolve the GitHub billing blocker.

Evidence and next gates: `JUDGE_GUIDE.md`, `ENVIRONMENT.md`, `EXECUTION_PLAN.md` and
`evidence/`. User application code and UI have not been changed by this audit.

### 24 October — power and state engine implementation

- Acquired World Model at `1742dec56a66e58eef9dda2d2b865823758ca8cd` under
  Apache-2.0. The isolated upstream reference suite passed 10/10; conformance
  passed 8/8 against both source and the compiled vendored module.
- Added a server/CLI adapter using the real engine store, canonical queries and
  audit log. Synthetic feature proof covers durable replay, independent-origin
  counting, contradiction/expiry and invalidation of affected plan assumptions.
  This is not yet the full planner/validator or Zetaris-fed workflow.
- Added a Meterless provider adapter and diagnostic command. It normalizes API
  URLs, sends the required headers, preserves routing mode IDs, distinguishes
  authentication failure from an unavailable runtime and keeps secrets out of
  receipts. Its contract tests use mocked HTTP, separately from live probes.
- Installed official Nightshift Windows 1.2.3 from the vendor download. Its SHA-256
  matches `0679114b9096c6a2c787cad893802ed8be75cee867fabb07ea42ceab6b78b008`.
  The runtime and installer are ignored local tools, not redistributed source.
- Started the official application/daemon. Authenticated model discovery works;
  a wrong token returns 401. A public smoke prompt returns `no_provider_configured`.
- Selected the active hosted Nemotron 3.5 Lightning model page after the older
  Nemotron 3 Super free endpoint was marked deprecated in its live page.
- NVIDIA sign-in accepts Technology Access Terms. Left that action with the
  user and opened Nightshift's source-connection step. No API key is requested
  in chat and no NVIDIA key or completed inference is claimed.
- Final local gate passed: typecheck, 21/21 application tests, 8/8 compiled
  World Model conformance cases and the production build. CI and the pre-push
  hook now include the engine conformance check. Hosted CI remains blocked by
  the previously recorded GitHub account issue.
- Commits: `bf9fd96` pins the acquired engine; `19b916f` adds the product
  adapter, provider contract and automated checks. See the dated setup receipt
  for the test and live-runtime evidence boundary.

### 24 October — live Nemotron gate

- The user created an NVIDIA key and saved it directly in Nightshift. No key was
  handled in chat or written into this repository.
- A real `meterless/auto` request succeeded. Nightshift's response model field
  reported `nvidia/nemotron-3-ultra-550b-a55b`, rather than the earlier Lightning
  candidate. This is routing evidence, not a promise that Auto always selects it.
- The first response mixed a thinking prefix into content. The final-text adapter
  now requests thinking off, removes delimited thinking prefixes, rejects an
  unfinished trace or token-truncated answer, and checks the smoke marker exactly.
  Separate reasoning fields are never returned or saved.
- The saved live receipt returned `PORTALONE_OK`: 6,025 ms, 146 prompt tokens,
  5 completion tokens, 151 total. Wrong-token authentication still returns 401.
- Typecheck and all 26 application tests passed, including five regression cases
  for thinking prefixes, empty final answers and truncation. G1 is verified
  locally; relief-data federation and the complete agent loop remain later gates.
- Response handling is committed in `def0f26`. The live receipt identifies that
  implementation and is linked from the judge guide.

### 24 October — relief data and bounded agent core

- Acquired LangGraph 1.5.2/Core 1.3.0 and adopted Zod 4.6.7. Twenty-one registry
  archives are retained with matching lockfile/registry integrities and MIT text.
  Two packages omitted license text from their archives; pinned upstream copies
  are retained. A real conditional LangGraph loop reached END under its limit.
- Added an original CC0 synthetic mission: two predefined routes, two vehicles,
  one kit stock row and ten raw reports, including a forward and later contradiction.
  All road, time, stock and threat attributes are invented demonstration inputs.
- Provisioned a separate pinned Postgres container without a published port,
  using a source query role with no tested table write privileges. Added four
  namespaced Zetaris registrations and verified idempotent repeat setup.
- JSON-lines ingestion initially returned one row. A standard JSON array returned
  the expected four route rows and ten reports. Only this work's incomplete/probe
  registrations were replaced; platform/sample sources and source files remained.
- The real candidate join returns four bounded rows across Postgres and files.
  Origin filtering returns eight initial reports and nine after the event, matching
  independently calculated fixtures. Timestamp casts fixed the exact event-time
  boundary. A full 50-row page now fails closed against possible omitted origins.
- Added a bounded gather/propose/independently-validate/revise/hold graph. Checks
  cover loaded mass, payload, stock, drive type, round-trip fuel/contingency,
  expiry through delivery, corroboration, deadline and earliest eligible alternative.
  Earliest delivery became an explicit objective after live planning surfaced
  multiple feasible options. No global route optimum or surveyed bypass is claimed.
- Live Nightshift proposals were checked against fresh Zetaris snapshots. The
  synthetic overweight draft was rejected, a light-truck plan reached operator
  review, changed evidence invalidated it, and a detour proposal passed. The
  impossible deadline held even when models proposed invalid options repeatedly.
- The overweight input is an explicitly labelled stress-test draft, not a claimed
  model failure or human approval. Ultra and 3.5 Lightning identities are recorded
  per response; routing-mode names do not imply a particular model or price.
- Explicit offline enumeration passed the same scenarios with HTTP fetch disabled.
  A local bundled rehearsal entry also passed; runtime files and credentials are
  ignored. No dispatch or operator approval is issued by these demonstrations.
- Final local gate: typecheck, 40 application tests, 8 World Model conformance
  cases, 21 vendor archive checks, offline replay and production build passed.
  CI/pre-push now include the vendor and offline checks. Hosted CI remains blocked
  by the previously recorded account issue; local results are not a hosted pass.
- Commits: `510a27d` acquisition, `019c9e0` sources, `b6a5de9` data adapter,
  `73cfba5` first verified core, `2615cf1` boundary/contract hardening and
  `ba87148` verification. The early live receipt is preserved with source hashes;
  the final live capture records its exact checkout and entry artifact.
- G2/G3 are verified locally. G4 still needs version-bound operator decisions and
  recovery for interrupted runs; G5 interface redesign remains deferred. Completed
  CLI receipts and World Model state persist, but LangGraph run state is in memory.

### 25 October — live vision alignment

- Re-read the full original brainstorming (23,996 bytes), all 1,698 event-document
  lines, the attached architectural summary and the user's additional API comparison.
  The original documents remain unmodified. The user's correction restores live
  signal capture, spatial grounding and automatic changed-evidence reaction to
  required scope; the synthetic CLI remains a baseline, not the whole product.
- Added LIVE_VISION.md with a layer-by-layer gap audit, provider/access gates,
  implementation order, full-path acceptance scenario and explicit distinctions
  among live services, actual observations, demonstration reports and replay.
  Updated the execution plan and judge entrypoint to reflect the corrected order.
- Reviewed primary Telegram, Kobo, Firecrawl, ReliefWeb, ACLED, OSM, Google Places,
  Twilio and Inngest documentation. No matching installed source connector was
  found. No source credentials, account settings, billing or product UI changed.
- Credential-free probes: Firecrawl anonymous search returned HTTP 403; both
  bounded Overpass place queries timed out after 30 seconds. HDX CKAN returned
  HTTP 200 and one Cameroon-tagged dataset metadata record; resource contents,
  corridor coverage and operational relevance were not validated. See the dated
  feasibility receipt. These are access results, not implemented connectors.
- No application runtime code changed and no new product feature is marked done.
  G3a live intake/grounding and G3b dynamic federation now precede expanding
  standalone approval storage or polishing the earlier interface.
- Planning checks passed: all 24 local Markdown links in the changed documents
  resolve, the four-result JSON receipt parses, both raw-document hashes match
  their earlier values and `git diff --check` passes. Runtime tests are not new
  evidence for this documentation-only change.

### 25 October — coordinator and interface direction

- The user specified one conversational coordinator that delegates to specialist
  agents and a clean conversation-left/workspace-right interface. ADR 0002 records
  this as accepted product direction; the current fixed CLI is not claimed to
  implement supervisor/subagent orchestration.
- Created an isolated in-conversation UI concept with labelled sample records,
  inspectable action summaries, workspace tabs, a local message preview and a
  simulated incoming-report state. It has no agent selector, live model call or
  connected basemap. Application UI/source code remains unchanged.
- The bundled Playwright 1.62.1 runtime checked six interactions in a temporary
  headless Edge session. A preview message action initially failed inside the
  sandboxed frame; explicit local button handling fixed it. All interactions then
  passed, with no script errors or horizontal overflow at 1024/736/360/320 pixels.
- One bounded GET request for an OSM road extract timed out; no map geometry was
  invented or displayed as retrieved geography. The concept exposes an unavailable
  map state. This does not change the live-source readiness results.
- Read-only runtime smoke checks also confirmed built-in SQLite availability in
  Node 24.15.0 and Bun 1.4.4. No intake storage or endpoint was implemented.

### 25 October — live intake, coordinator and connected workspace

- After the human saved their Kobo key locally, verified access, created the
  marked private form, compiled and deployed it. Three explicit demonstration
  reports were submitted and retrieved; zero actual field incidents are claimed.
  The draft id_string returned 404 on submission; OpenRosa formList revealed the
  deployed asset UID. Correct writes returned 201. Retry UUIDs persist before
  transmission. Data and web collection remain authenticated. No messages sent.
- Acquired Leaflet 1.9.4, shpjs 6.2.0 and pinned dependencies; all 30 retained
  archives pass local integrity/license checks. Removed an earlier parser after
  a transitive license could not be verified. Actual HOT/HDX archives produced
  an attributed ODbL extract: 5,111 road features, 16 places and seven health
  features. No tiles, fonts or geocoder are fetched; no operating status inferred.
- Implemented SQLite input/version and task/event journals, bounded full Kobo
  reconciliation, place grounding with ambiguity, and a Nemotron supervisor.
  Source/mapping are nested deterministic tool graphs with isolated context.
  Returned location/provenance gaps trigger targeted reconnaissance follow-up;
  the checker fetches independently and holds. No separate model persona for
  every tool, DeepAgents installation or model approval authority is claimed.
- Actual Nightshift responses reported Nemotron 3.5 Lightning and 3 Ultra;
  identity, timing, tokens and public parent/child actions are recorded. A new
  Kobo version automatically triggered a fresh investigation. The Balewa test
  retained both source place candidates and produced no invented incident pin.
- The connected conversation/workspace shows actual events, evidence, brief and
  map. Browser QA passed at 1440/1024/736/390/320 pixels with no overflow or script
  errors. Visual inspection caught default pins on road points and a style
  override; line-only road display and explicit styling fixed them. A stale-DOM
  race in the QA helper was corrected to wait on the exact run's completion.
- Explicit browser replay uses a separate journal, deterministic task selection
  and no HTTP/model calls. Completed history persists; partial runs become
  interrupted after restart. Monitoring polls every 20 seconds for 30 minutes and
  pauses on restart. Durable schedules, deletion/expiry plan drift and graph-step
  resumption are not implemented.
- Restarted installed Nightshift and Docker Desktop after finding both stopped.
  Reused the existing Zetaris driver/database; live federation again matched four
  candidates, eight initial/nine updated origins and ten raw synthetic reports.
  No source database, metastore or prior history was replaced.
- Local suite: 51 tests, typecheck, 30 archive checks, HTTP-disabled community
  replay and production build. The push gate also retains World Model conformance
  and the earlier offline relief replay. CI now pins Node 24.15.0 for SQLite;
  hosted results are reported separately.
- Separate commits: `9d364b7` acquisition, `6934268` data, `8351337` intake,
  `72c5961` orchestration, `ce8cff0` interface and `3c4c3a6` checks. The dated
  community receipt binds the executed application to `ce8cff0` and source hashes.
  Raw brainstorming/event hashes still match; those files remain untracked.
  Credentials and raw journals remain ignored. Published history is append-only.
- Remaining: live signals into Zetaris/delivery planning, text extraction/public
  news, road-segment evidence, full mission/logistics binding and human review.
  G3a/G5 are partial; the full live-delivery vision is not marked complete.
