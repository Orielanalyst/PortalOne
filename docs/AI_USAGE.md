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
| planned | LangGraph + Nightshift | Agent runtime and model | Planner and replanner reasoning. The verifier remains deterministic. |
| planned | Zetaris | Data layer | SQL over local Docker; evidence rows keep source and timestamps. |

## How output is controlled

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
