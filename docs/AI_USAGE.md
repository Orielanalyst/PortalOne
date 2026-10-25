# AI usage

This is our transparency log. The reviewed rules allow generated code and make
entrants accountable for it; this file is our chosen detailed disclosure format.

| Date | Tool | Role | Scope |
|------|------|------|-------|
| 2026-10-16 | Lovable | Reference prototype | Generated the earlier `relief-mission-control` app. Not part of this repository. |
| 2026-10-23 | OpenCode + DeepSeek V4.1 Flash | Build assistant | Scaffold, domain model, deterministic evaluator, tests and tracking docs, written under human direction and reviewed before commit. |
| 2026-10-24 | Codex | Research, planning and environment audit | Read brainstorming and event materials; proposed scope and architecture; verified Docker/WSL/Zetaris, local checks and CI status; added planning/provenance records and a wrapper around pinned official diagnostic helpers. Product implementation and UI redesign were not performed in this audit. |
| 2026-10-24 | Codex | Meterless implementation | Acquired and verified World Model; implemented persistent observation/plan-assumption tracking and synthetic replay; wrote Meterless contract adapter and tests; installed official Nightshift and verified local authentication. NVIDIA account/key action and real model inference remain pending. |
| 2026-10-24 | Codex + Nightshift/Nemotron | Live provider verification | After the user saved their key in Nightshift, verified real marker completion; response reported Nemotron 3 Ultra. Fixed final-answer handling and added regression tests; saved identity, timing and usage without credentials or thinking text. Supersedes the earlier pending inference status. |
| 2026-10-24 | Codex | Relief data and agent implementation | Authored synthetic fixtures/provisioning, server adapter, finite constraint checks, LangGraph loop, tests, source hashes and live/offline replay. Existing browser UI was not redesigned. |
| 2026-10-24 | Nightshift + NVIDIA Nemotron | Live planner/replanner | Generated JSON proposals and brief public rationales. Recorded Ultra and 3.5 Lightning IDs; independent code rejected weight, slower eligible choice and deadline violations. No model approval or dispatch authority. |
| 2026-10-24 | Zetaris | Live data layer | Real joins over isolated Postgres and synthetic JSON files; counts and decoded snapshots matched independent fixture calculations. |
| 2026-10-25 | Codex | Vision alignment and live-source feasibility | Re-read the full brainstorming/event documents and attached architecture; incorporated the user's API comparison; restored intake, spatial grounding and automatic re-evaluation to required scope. Reviewed primary API/access documentation and ran bounded credential-free public-source probes. This planning work adds no product connector or UI. |
| 2026-10-25 | Codex | Coordinator architecture and UI exploration | Under the user's direction, recorded a single conversational coordinator with specialist delegation and a conversation/workspace UI. Created an isolated interactive concept and checked it with bundled Playwright; no application UI, live map, intake pipeline or coordinator runtime is claimed implemented. |
| 2026-10-25 | Codex + Nightshift/Nemotron | Federated planning implementation and live proof | Added immutable community metadata projection, isolated PostgreSQL roles and bounded Zetaris joins; implemented model-backed next-verification advice, independent query checks, assessment invalidation, monitoring and connected Brief receipts. Submitted one explicitly forwarded demonstration through Kobo and verified automatic same-session re-review. Arithmetic, hashes, queries, persistence and rejection gates are code; no field incident or dispatch is claimed. |
| 2026-10-25 | Codex + Nightshift/Nemotron | Conversational coordinator correction | After the human's greeting wrongly triggered the real investigation graph, added a live-model conversation step, persisted dialogue, bounded recent context, clarification/handoff contract, grounded wrap-up and follow-up replies. Reused installed components and tested through the actual browser/model. The fixed workflow retains deterministic evidence gates and no dispatch authority. |

## How output is controlled

25 October implementation: Codex acquired/pinned Leaflet and map parsers, prepared
the attributed OSM extract, created the private Kobo form after the human saved
their token, and implemented intake, SQLite persistence, the supervisor/tool-worker
graphs, tests, monitoring, explicit replay and the connected interface. Live
Nightshift responses reported Nemotron 3.5 Lightning and Nemotron 3 Ultra; the
model selected bounded delegations and public reasons. Geometry, reconciliation
and readiness checks are code. Transport tests are explicit demonstrations, not
claimed field incidents. No reporter messages, provider terms, account billing,
public sharing or dispatch approval were automated.

- The human sets scope, architecture and acceptance criteria.
- Every AI-written change is typechecked, tested and reviewed before commit.
- The safety evaluator is deterministic and unit-tested. The model cannot approve
  a plan; it can only propose one.
- Secrets are never pasted into prompts or committed. API keys live in `.env`
  (ignored) or, for NVIDIA, in Nightshift's Providers tab.

## Responsibility and attribution

The human owns project direction and final acceptance. AI has contributed
architecture, scope and demo suggestions as well as code and documents; those
contributions are not represented as exclusively human-authored. A commit made
with the user's configured Git identity does not by itself establish authorship
of every line. Planned model integrations in the table remain unimplemented
until their verification evidence exists.
