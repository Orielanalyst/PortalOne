# Provenance

PortalOne is a clean rebuild for the Open Agent Hackathon 2026. This note records
what came from where, so the history is not ambiguous.

## Reference prototype

The earlier project `Orielanalyst/relief-mission-control` (private) was generated
with Lovable on 2026-10-16 and extended on 2026-10-23. It is kept as a **design
reference only**. It is not the submission, and none of its commits are reused.

Its history contains a pre-window template commit and bot-authored commits. That
is exactly the ambiguity a fresh repository avoids.

## What was reused

- The product idea: an emergency-response agent that verifies before dispatch.
- The demo scenario (Mbeli flood), including place names and approximate figures.
- The visual direction: a dark mission-control palette.

## What was rebuilt here

- The scaffold, without the Lovable Vite config or the unused shadcn components.
- The domain model, with a deterministic evaluator and unit tests.
- The UI and, from slice 1.1, the agent runtime and event contract.

## Why a fresh repository

The event asks for work tracked during the build window. A new history makes
every commit date and author unambiguous: the first commit is dated
2026-10-23, inside the window. No pre-window commit is part of this repository.
