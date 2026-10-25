# 0003 — Streamed, versioned committee artifacts

Date: 2026-10-25. Status: implemented and verified locally; operational approval
and field evidence are separate gates.

The conversational coordinator commissions a bounded LangGraph workflow with
separate investigation, planning, evaluation and report calls. Deterministic tools
compile the cited dossier; the specialist writers use that compact evidence.
The evaluator receives the latest plan and makes fresh Kobo/Zetaris reads.
No DeepAgents harness, concurrent worker execution or private reasoning display
is claimed. LangGraph and the existing source adapters already provide the needed
bounded state transitions.

Store documents, citations and native deltas in the existing SQLite journal.
Publication freezes a draft before evaluation starts. Revisions produce complete
documents and a real text diff; failed drafts and one bounded publication repair
remain visible. Missing inputs retain an operational hold. At most three versions,
twelve federation query slots and ten minutes bound the committee run.

Use native provider SSE and EventSource, rather than replaying a settled answer.
Streamdown supplies the Markdown parser and memoized blocks; a small hook uses
its block parser for partial table headers. Respect manual scrolling and the draft
being read. Reserve the handoff area and open newly selected tabs at their top.

The installed Nightshift implementation revealed that generic modes can inject
scratch-work and buffer quality winners. Explicit concrete-model addressing skips
those paths. Require trace receipts proving the requested model, one phase, cache
miss and no scaffold/quality buffering. Reject truncated or unconfirmed streams.
NVIDIA JSON mode protects the conversation contract. Keep the earlier CLI's
nonstreaming mode routing and explicit offline replay unchanged.

Export through acquired ReportLab/pypdf and the cached official QGIS image.
Validate every GeoPackage layer and reopen the project; verify a relocated ZIP
in a fresh native QGIS process. Preserve original geometry and source coordinate
basis. Unlocated claims and unsurveyed zones produce empty layers with stated gaps.
Do not ask models to transcribe coordinates. PDF layout editions use the already
published narrative/source snapshot, keep original files immutable and add new
checksummed PDF/ZIP names; they make no new inference or source claims.

Evidence: [workflow and limits](../COMMITTEE_WORKFLOW.md),
[live capture](../evidence/committee-workflow-2026-10-25.json), and
[later UI/layout checks](../evidence/committee-ui-2026-10-25.json).
