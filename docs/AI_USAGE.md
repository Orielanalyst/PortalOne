# AI usage

The hackathon asks entrants to document AI tool use. This is the running log.

| Date | Tool | Role | Scope |
|------|------|------|-------|
| 2026-10-16 | Lovable | Reference prototype | Generated the earlier `relief-mission-control` app. Not part of this repository. |
| 2026-10-23 | OpenCode + DeepSeek V4.1 Flash | Build assistant | Scaffold, domain model, deterministic evaluator, tests and tracking docs, written under human direction and reviewed before commit. |
| planned | LangGraph + Nightshift | Agent runtime and model | Planner and replanner reasoning. The verifier remains deterministic. |
| planned | Zetaris | Data layer | SQL over local Docker; evidence rows keep source and timestamps. |

## How output is controlled

- The human sets scope, architecture and acceptance criteria.
- Every AI-written change is typechecked, tested and reviewed before commit.
- The safety evaluator is deterministic and unit-tested. The model cannot approve
  a plan; it can only propose one.
- Secrets are never pasted into prompts or committed. API keys live in `.env`
  (ignored) or, for NVIDIA, in Nightshift's Providers tab.

## What is not AI-generated

The architecture decision, the product constraints, the demo narrative and the
final acceptance of each slice are human decisions. The AI is the pair, not the
author of record.
