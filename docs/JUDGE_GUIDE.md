# Judge guide

**As of 2026-10-24: environment and state-engine checkpoint.** This repository does
not yet implement the revised humanitarian agent workflow described in the plan.

## What exists and what is next

| Capability | Evidence | State |
|---|---|---|
| Existing evaluator and application scaffold | Existing commits; local 9-test run, typecheck and build | baseline only |
| Local Zetaris platform and authenticated data access | [Environment audit](ENVIRONMENT.md), [receipts](evidence/zetaris-2026-10-24.json) | verified diagnostic capability |
| Accountable starting point | [Baseline manifest](evidence/baseline-2026-10-24.json), [provenance](PROVENANCE.md) | captured on 24 Oct |
| New relief data, planner/validator loop and state updates | [Execution gates](EXECUTION_PLAN.md) | planned |
| Meterless World Model | [Feature receipt](evidence/world-model-2026-10-24.json); `bun run check:world-model` | 8/8 conformance; persistent assumption-tracking feature verified on synthetic inputs |
| Nightshift authentication and discovery | [Runtime receipt](evidence/meterless-2026-10-24.json) | running; valid token accepted and wrong token rejected |
| Pinned engine and installed runtime provenance | [Setup receipt](evidence/power-setup-2026-10-24.json) | source hashes, license, installer hash and test results recorded |
| Nemotron inference | [Environment gates](ENVIRONMENT.md) | NVIDIA account/key action pending; completion currently returns no_provider_configured |
| New UI, final demo and slides | [Execution plan](EXECUTION_PLAN.md) | deferred |
| Hosted CI | [Actions run](https://github.com/Orielanalyst/PortalOne/actions/runs/39986817817) | startup blocked by account billing/spending limit |

## Review the work boundary

1. Read [PROVENANCE.md](PROVENANCE.md) for the reference prototype, declaration
   boundary and Wildcard explanation. The 24 October checkpoint is not backdated.
2. Inspect the baseline commit `42fb95c1569b5dbeb01abb16dca5cff2a771debb`, its
   file/blob manifest and the subsequent commit diff. Existing published history,
   tag `v0.1-tracking` and the UI stash are preserved.
3. Follow [BUILD_LOG.md](BUILD_LOG.md) for dated results and limits,
   [AI_USAGE.md](AI_USAGE.md) for assistance disclosure, and
   [COMMIT_POLICY.md](COMMIT_POLICY.md) for our internal review practices.
4. Reproduce the bounded connection checks in [ENVIRONMENT.md](ENVIRONMENT.md).
   They use pinned, licensed official helpers; a functioning sample query does
   not demonstrate the future relief-data integration.

## Evidence required as features land

Every completed gate must link to its commit, input/data revision, execution
mode, test or run receipt, and limitations. Runtime receipts must connect
observations, query results, state versions, rejected constraints, revisions,
actual model identity and the operator's final action. A local pass must be
distinguished from remote CI; fixture results must be distinguished from live
sponsor calls. Credentials and private reasoning are excluded.

The repository is currently private. Public access and final submission materials
remain release tasks; this guide alone does not make the project judge-accessible.
