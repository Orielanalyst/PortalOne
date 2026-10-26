# Active goal: complete the live mission-to-review path

The human asked to achieve items 1–4 together. Completion requires the whole path
below; passing component checks does not close the goal. Scope is one supported
Bamenda–Bambili mission. Other areas require additional acquired data coverage.

| Requirement | Acceptance evidence required | Current work |
|---|---|---|
| 1. Live public and community evidence | Actual public fetch and Kobo read; traceable document URLs/times/hashes; bounded coverage, duplicates and unavailable sources visible; public changes invalidate the affected plan; cited streamed committee and export | ReliefWeb RSS succeeded through Bun but the native Node runtime receives a publisher bot block. The connector exposes that failure and falls back to the documented public IFRC GO events endpoint, verifying Cameroon identity and retaining record creation/update dates separately from observation time. Native committee runs consumed eight bounded historical public records alongside Kobo. These records provide context, not current local incident confirmation. Combined final review/invalidation proof remains required. |
| 2. Roads and intervention relationships | Source-backed road candidates, ambiguity preserved, meaningful route/intervention dependencies, candidate map/GIS layers and native reopen; no settlement-to-incident invention | Pinned Turf computes candidates around rounded submitted references. Named settlements alone are not snapped. Candidate count/truncation, possible route overlaps and exclusion scenarios are explicit. The acquired pathfinder produced a source-vertex Bamenda–Bambili candidate in its native smoke check. Nine-layer export/UI integration exists; combined native export, visual QA and fresh QGIS reopen remain. |
| 3. Mission-specific planning | Conversation captures and persists origin/destination, beneficiaries, cargo, stock/fleet, timing and operating policy; source-checked inputs; mapped-route tools; deterministic mass/fuel/time/freshness checks; missing inputs cause specific questions/holds; independent recheck | Four real coordinator turns captured all 25 required fields, asked for missing inputs, and waited for an investigation request. Inputs survived restart. Native route/resource calculations reached a conditional proposal with field and endpoint holds; generated PDF sections retain input provenance. Bounded format and concise-reply corrections preserve failed attempts and cannot alter validated inputs. Operator statements are not an independent NGO ledger. The final combined review proof remains open. |
| 4. Version-bound human review | Operator can approve/reject/request changes to an exact proposal and requirement/evidence version; changed evidence/requirements/plan or expiry withdraws approval; source drift during review cannot grant approval; durable history and visible UI | Exact document/input/evidence/calculation bindings, forced public/source refresh, durable decisions, redacted receipts, expiry, rejection and linked request-changes flow are implemented. Regressions exercise drift during approval, idempotency, input edits and shared-source/mission isolation. Combined native approval, automatic changed-evidence withdrawal, revision, restart and UI proof remain. Proposal approval retains operational holds and never authorizes dispatch. |

Acquisition: existing saxes 6.0.0 (ISC) and parse5 7.3.0 (MIT) are explicit runtime
dependencies. Turf nearest-point-on-line/length 7.3.5 are MIT at upstream
`a33ca387405df72847af00cdf689d3209301a2c1`. ngraph.graph 20.1.2 is BSD-3-Clause and
ngraph.path 1.6.1 and chrono-node 2.10.3 are MIT. Chrono normalizes exact user time
phrases against their original message timestamp, using the visible Cameroon
timezone unless the source supplies an offset. Ambiguous dates/times cause a
specific clarification; model-generated ISO conversions are not accepted as input
evidence. Exact npm archives, integrity hashes and license records
are retained in `vendor/npm-registry/manifest.json`. No hosted service or paid
account was added. Acquisition is separate from native integration proof.

Public feed text is retained locally for source auditing. Shared evidence carries
source identity, publication time, unknown observation time, content hash and at
most one short complete-sentence publisher excerpt per document. Country or place
mentions do not corroborate a current incident. A public-fetch failure yields an
explicit gap rather than silently serving history as a refreshed source.

The documented IFRC fallback uses `countries__in=41`, validates country ID and
ISO3, and projects only public event identity and dates. Contact/narrative fields
are excluded. Historical event records never acquire a fabricated observation time.

The prior approval to publish a redacted private-run pack applies to that snapshot
only. New private-run outputs stay local unless separately authorized. Code and
public-source component receipts have no private narrative or extracted mentions.
