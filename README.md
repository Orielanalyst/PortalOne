# PortalOne

**Verified emergency response mission control.**

Give it a disaster and a need. PortalOne plans a route, checks the plan against
federated evidence, rejects what the evidence does not support, replans, and
only then issues a dispatch directive. Every step names the record it rests on.

Built for the **Open Agent Hackathon 2026** — Track 02, *The Agent That Can
Explain Why*.

## Status

Active build. The repository history is the build log: scaffold first, then the
mission model, the agent loop, the evidence trail, and the sponsor integrations,
one commit at a time.

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

Copy `.env.example` to `.env` and fill in what you have. Nothing in `.env` is
committed, and no secret is ever exposed to the browser.

## Layout

```
src/routes/       file-based routes (TanStack Start)
src/lib/          domain model and adapters
src/styles.css    design tokens
```
