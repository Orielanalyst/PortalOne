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
