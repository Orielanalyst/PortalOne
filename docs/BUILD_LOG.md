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
