# 0002 — One coordinator and an inspectable workspace

Date: 2026-10-25

Status: accepted; bounded investigation and federated planning preflight verified
locally. Executable delivery-planning coordination remains required.

## Decision

The user talks to one mission coordinator. The coordinator maintains the mission
brief and conversation, delegates bounded tasks to specialist agents, reconciles
their findings, handles feedback and presents a single evidence-linked response.
Users do not select, launch or manage agents manually.

This follows the supervisor/subagent pattern described in the
[LangChain documentation](https://docs.langchain.com/oss/javascript/langchain/multi-agent/subagents).
The existing LangGraph runtime can host specialist subgraphs with explicit input
and output contracts. No new supervisor package or DeepAgents harness has been
adopted or smoke-tested by this decision.

## Specialist responsibilities

- Reconnaissance: permitted source retrieval, collection windows and evidence gaps.
- Community mapping: sourced geography, local place resolution and uncertainty.
- Planning/logistics: candidate plans using deterministic feasibility tools.
- Independent checking: fresh evidence queries, constraint violations and holds.

Hashing, geometry, arithmetic, database writes, scheduling and drift monitoring
remain tools/services where a separate model-driven agent adds no value. A
specialist role is not a claim that it already exists as a running AI agent.

The coordinator can delegate independent investigations concurrently, request
targeted follow-up work and retry within budgets. A location gap returns to
mapping; a source gap returns to recon; a logistics violation returns to planning.
Infeasibility, unavailable evidence or exhausted budgets produce a visible hold.
The coordinator cannot override deterministic rejection or grant human dispatch
authorization. Background collection events can start a new bounded review cycle.

## Interface direction

The supplied reference is interpreted as a conversation pane on the left and a
larger workspace on the right. The coordinator is the only conversational persona.
Action summaries explain delegated work; selecting one inspects its result and
does not dispatch an agent. The right workspace opens activity, map, evidence or
operator output in context. Keep whitespace and progressive detail; avoid nested
dashboard cards and an agent-selection control.

Show concise public action summaries, source/tool receipts, results and blockers.
Do not display private model reasoning. The activity hierarchy connects each
specialist task and result to its parent mission/coordinator request.

## Current proof and next gate

An in-conversation interface concept demonstrates action inspection, workspace
navigation, a local message preview and a simulated incoming-report state. Browser
checks pass at 1024, 736, 360 and 320 pixels with no horizontal overflow or script
errors. It uses labelled sample records, no model calls and no live basemap.
It is not the application UI or evidence of a working coordinator runtime.

The application now also has an actual supervisor graph using Nemotron through
Nightshift, nested source/mapping task graphs, targeted source follow-up and an
independent fresh-data check. SQLite persists parent/child tasks, report versions,
events and results. Restart preserves completed work, marks partial work interrupted
and pauses monitoring; it does not resume in-flight graph steps. The source and
geometry workers are deterministic tools, not separate autonomous model personas.

The connected browser shows these actual events and OSM geography. The isolated
planning worker now uses Nemotron over compact community/logistics joins from
Zetaris. Its contract proposes a next verification action, not a route. A separate
checker reads Kobo and Zetaris again and stores its own receipts. Evidence drift
invalidates earlier assessments and returns work to planning within the budget.
Bounded monitoring also checks removals, resource changes and freshness boundaries.
The live-change receipt proves one automatic same-session re-review after a new
demonstration report. Dependency scope is the entire dedicated project/corridor.
Synthetic expired logistics, unverified origins and missing road evidence retain
the operational hold. The conversation layer now keeps recent dialogue, clarifies
before delegation and generates a findings-grounded wrap-up. See
[CONVERSATIONAL_COORDINATOR.md](../CONVERSATIONAL_COORDINATOR.md). No concurrent
worker execution, formal versioned mission requirements or integration of the
earlier executable route CLI is claimed. See
[FEDERATED_PLANNING.md](../FEDERATED_PLANNING.md) for proof and remaining gates.
