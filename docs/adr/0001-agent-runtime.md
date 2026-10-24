# ADR 0001 — Agent runtime

- **Status:** Implemented and locally verified for the core CLI, 2026-10-24
- **Date:** 2026-10-23
- **Deciders:** project owner

24 October implementation: the bounded LangGraph CLI passes live Zetaris/Nightshift
and explicit offline scenarios. Exact dependencies and license/integrity records
are in `vendor/npm-registry/` from the repository root. Current gates
are in `../EXECUTION_PLAN.md`. Operator approval binding and run recovery remain open.

## Context

PortalOne needs an agent that plans, gathers evidence, verifies, replans and
stops for operator review. The track remains provisional. The app is TypeScript
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

Built on LangGraph, with planning, isolated subagents and a virtual filesystem.
These capabilities remain relevant to future open-ended source discovery. The
first slice has four predefined route/vehicle combinations and needs explicit
bounded transitions, without delegation or an additional service.

### C. Python LangGraph / Deep Agents service

The richest ecosystem, but a second runtime and a cross-language event schema.
With four days left, the deploy risk is not worth it.

## Decision

**Implemented: A**, using the already verified narrow Meterless client.

- Runtime: LangGraph 1.5.2, Core 1.3.0 and Zod 4.6.7, locked and archived under MIT.
- Model: native final-text JSON requests to Nightshift with the required bearer,
  app and user-scope headers. Initial proposals request `meterless/fast`; revisions
  request `meterless/deep`. The returned model identity is recorded each time.
- Data: fixed-query live Zetaris and explicit offline implementations.
- Flow: gather → propose → independently validate → revise, hold or operator review.
  Recursion limit 12, two revisions, 12 reserved query slots, five-minute deadline.
- Constraints: exhaustive checks over four supplied alternatives. No general
  optimizer or global route-optimality claim is needed for this finite slice.

Revisit **B** only as an optional research subagent if open-ended source
discovery becomes necessary. It would sit inside a LangGraph node, not replace
the graph.

## Consequences

- The graph's nodes, edges and citations become the explainability story.
- The verifier stays deterministic, unit-tested and independent of the model.
- One application language and a typed core event schema for the future UI.
- World Model persists observations and proposed/invalidated plans; completed CLI
  receipts persist public decisions and evidence. LangGraph run state is still
  in memory; process-crash resume and operator approval actions are not implemented.
