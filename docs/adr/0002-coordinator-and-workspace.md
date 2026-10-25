# 0002 — One coordinator and an inspectable workspace

Date: 2026-10-25

Status: accepted product direction; coordinator runtime not implemented.

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

The application still has the earlier bounded gather/propose/validate/revise CLI.
Before claiming this architecture implemented, demonstrate actual specialist
invocation and context separation, targeted feedback routing, persisted task/result
IDs and limits, fresh independent validation and an interruption/restart case.
Provider access, live signal ingestion and community geography remain required
gates in LIVE_VISION.md.
