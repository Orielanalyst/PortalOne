# PortalOne

**Verified emergency response mission control.**

Give it a disaster and a need. PortalOne plans a route, checks the plan against
federated evidence, rejects what the evidence does not support, replans, and
only then issues a dispatch directive. Every step names the record it rests on.

Built for the **Open Agent Hackathon 2026**. Primary track is pending confirmation;
the current plan provisionally targets *Reasoning Architecture*.

## Status

Environment and planning checkpoint, 24 October. The existing scaffold and
deterministic evaluator pass local checks. Zetaris is running and authenticated
sample queries work. The revised relief-agent loop, Meterless/Nemotron integrations
and redesigned UI are planned, not implemented. GitHub Actions is currently
blocked at startup by an account billing/spending limit.

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
bun install
bun run dev        # http://localhost:8080
```

## Verify

```sh
bun run test
bun run build
bun run typecheck
```

## Environment

Copy `.env.example` to `.env` and fill in the server-side configuration. `.env`
is ignored and credentials must never use a `VITE_` prefix. See `docs/ENVIRONMENT.md`
for the tested local Zetaris UI origin and the repeatable connection check.
The application data adapter is a future gate; diagnostic access is available now.

## Layout

```
src/routes/       file-based routes (TanStack Start)
src/lib/          domain model and adapters
src/styles.css    design tokens
```
