# Commit policy

**Why this exists:** the hackathon may disqualify submissions with large single
commits or missing histories. This repository is the build log, so the history
has to be readable on its own.

## Rules

1. **One concern per commit.** Docs, CI, data, agent and UI are separate commits.
2. **Commit early, push often.** Aim for a commit every 30–90 minutes of work.
3. **Every commit is green.** Typecheck, tests and build pass before pushing.
4. **Stage explicitly.** Use `git add <paths>`. Avoid `git add -A` unless the
   working tree is fully understood.
5. **Never rewrite published history.** No force-push, rebase, amend or squash
   after a commit is pushed. Fix forward with `git revert`.
6. **No secrets.** `.env` is ignored. The NVIDIA key lives only in Nightshift's
   Providers tab. The pre-commit hook blocks the obvious cases.
7. **Log the session.** Update `docs/BUILD_LOG.md` at the end of each session.
8. **Tag phase boundaries.** `v0.1-tracking`, `v0.2-agent-core`,
   `v0.3-live-model`, `v0.4-zetaris`, `v0.5-ui`, `v0.6-gate`.
9. **Disclose AI assistance.** The canonical log is `docs/AI_USAGE.md`. The human
   owns the scope, architecture and acceptance of every change.

## Message format

`type(scope): summary` — imperative mood, lower-case, 72 characters or fewer.

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, `data`.

Examples:

- `feat(agent): route rejected plans back to the replanner`
- `data(zetaris): seed flood and bridge tables`
- `docs(adr): choose LangGraph JS for the mission runtime`
- `fix(ui): keep the directive hidden until approval`

## Size guidance

If a diff exceeds roughly 300 changed lines, ask whether it contains two
concerns. Generated lockfiles and seed SQL are exempt. A single feature may
still be split into contract, implementation and tests.

## Definition of done

- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] commit pushed
- [ ] build log updated
