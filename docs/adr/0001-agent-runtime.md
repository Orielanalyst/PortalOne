# ADR 0001 — Agent runtime

- **Status:** Proposed
- **Date:** 2026-10-23
- **Deciders:** project owner

## Context

PortalOne needs an agent that plans, gathers evidence, verifies, replans and
stops for approval. Track 02 scores explainability. The app is TypeScript
(TanStack Start on Bun). Nightshift exposes an OpenAI-compatible endpoint at
`http://127.0.0.1:8088/v1`; Zetaris exposes SQL over REST.

## Options

### A. LangGraph JS with an explicit StateGraph — recommended

Typed state, explicit nodes and conditional edges, checkpointing, interrupts and
step streaming. Runs in-process with the app, so there is one runtime and one
deploy. The deterministic verifier is a node, and therefore a hard gate rather
than a suggestion.

Cost: more wiring than a harness.

### B. Deep Agents JS

Built on LangGraph. Ships planning, subagents, a virtual filesystem and
human-in-the-loop. The official description is a harness that "trusts the LLM":
the agent can do anything its tools allow.

For this product the thesis is the opposite — the model may propose, but the
verifier must be able to overrule it. The built-in planner is generic and less
auditable for a safety decision. It also adds dependencies we do not need for a
bounded pipeline.

### C. Python LangGraph / Deep Agents service

The richest ecosystem, but a second runtime and a cross-language event schema.
With four days left, the deploy risk is not worth it.

## Decision

**Pending.** Recommendation: **A**.

- Runtime: `@langchain/langgraph` + `@langchain/core`.
- Model: `@langchain/openai` `ChatOpenAI` pointed at Nightshift
  (`meterless/auto`, bearer token, `meterless-app: portal-one`,
  `meterless-scope: user`, 180 s timeout).
- Data: a `DataAdapter` with a live Zetaris implementation and a fixture
  implementation for offline demos and tests.

Revisit **B** only as an optional research subagent if open-ended source
discovery becomes necessary. It would sit inside a LangGraph node, not replace
the graph.

## Consequences

- The graph's nodes, edges and citations become the explainability story.
- The verifier stays deterministic, unit-tested and independent of the model.
- One runtime, one deploy, one event schema for the UI.
- More code than `createDeepAgent`, but every transition is inspectable.
