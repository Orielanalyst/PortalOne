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
