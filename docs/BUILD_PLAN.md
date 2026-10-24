# Historical build plan — superseded 2026-10-24

The current plan is [EXECUTION_PLAN.md](EXECUTION_PLAN.md). This document is
preserved as the earlier plan, including its then-current assumptions. Its UI,
track, completion and blocker claims are not the current verified status.

**Goal:** PortalOne — an emergency-response agent that explains and verifies every
dispatch. Open Agent Hackathon 2026, Track 02, *The Agent That Can Explain Why*.

**Build window:** 2026-10-22 00:00 → 2026-10-27 23:45 UTC.

## Design principles

1. **The model proposes; the verifier disposes.** Safety checks are deterministic
   code, not a second opinion from the same model.
2. **No claim without a record.** Every plan step cites evidence IDs.
3. **No dispatch without approval.** A human gate sits before the directive.
4. **Every commit is a working slice.** Typecheck, tests and build pass.
5. **History is append-only.** Never rewrite a published commit.

## Slices

Each row is one commit or a small, coherent set. Status is updated as work lands.

| # | Slice | Acceptance | Status |
|---|-------|------------|--------|
| 0.1 | Build plan + commit policy | docs committed, tree clean | done |
| 0.2 | CI on every push | workflow green on GitHub | done |
| 0.3 | Provenance + AI usage | reference repo and tools documented | done |
| 0.4 | Local hooks | secret scan blocks `.env` and NVIDIA keys | done |
| 1.1 | Agent event contract | shared step/event types + tests | todo |
| 1.2 | Graph state + fixture adapter | graph runs offline, transcript derived | todo |
| 1.3 | Planner / evaluator / replan nodes | conditional routing tested | todo |
| 1.4 | Escalation path | no directive when every plan is rejected | todo |
| 2.1 | Nightshift model client | ChatOpenAI against `:8088`, timeout, headers | todo |
| 2.2 | Structured plan output | zod-validated plan, deterministic fallback | todo |
| 3.1 | Zetaris adapter | SQL → evidence rows with provenance | todo |
| 3.2 | Seed dataset | reproducible SQL for the demo scenario | todo |
| 4.1 | SSE mission route | steps stream to the browser | todo |
| 4.2 | Wire mission-control UI | live transcript, map, ledger, directive | todo |
| 5.1 | Approval gate | interrupt + resume before dispatch | todo |
| 5.2 | Checkpoint + replay | mission resumes from a thread id | todo |
| 6.1 | Offline and error states | missing data/model shown honestly | todo |
| 6.2 | Demo script | 2–4 minute path rehearsed | todo |
| 7.1 | README + architecture | judge-readable setup and design | todo |
| 7.2 | Submission | repo public, video, AI disclosure | todo |

## Runtime decision

See `docs/adr/0001-agent-runtime.md`. Recommendation: **LangGraph JS in-process**,
with Nightshift as the model provider and Zetaris behind a data adapter. The UI
is not rebuilt again; it consumes the agent's step contract.

## Blockers

- Zetaris bundle / account not obtained.
- Nightshift runtime token not obtained. The NVIDIA key belongs in Nightshift's
  Providers tab, never in this repo.
- WSL2 / Docker needs a reboot before Zetaris can run locally.

## Definition of done

`bun run typecheck`, `bun run test` and `bun run build` pass; the commit is
pushed; `docs/BUILD_LOG.md` is updated.
