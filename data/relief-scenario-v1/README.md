# Synthetic corridor fixture — v1

All stock, vehicles, travel times, load limits, nodes, reports and restrictions
are invented for a software demonstration. Bamenda and Bambili provide geographic
context only. The detour is a fictional edge sequence, not a surveyed road or a
real route recommendation. No operational dispatch may rely on this pack.

The simulation clock is fixed at 24 October 2026 09:00 UTC. Actual execution
timestamps are recorded separately. At 09:05 a third originating report contradicts
the direct route's passable reports. Its arrival is replayed by advancing the
simulation clock; no live field collection is implied.

The request is 100 kits, 10 kg each. The objective is earliest eligible delivery
among the supplied alternatives, not a global route optimum. A heavy truck on the direct route exceeds
the synthetic 3,500 kg segment limit (4,800 + 1,000 = 5,800 kg). The light truck
weighs 3,100 kg loaded. Both routes have two independent passable reports per
segment initially; a forward shares its origin and counts once. A reported road
status is not proof of safety. Unknown, expired and contradictory evidence block
operator review under this demo's conservative policy.

Expected cases:

- Heavy/direct: reject gross weight.
- Light/direct at 09:00: eligible for operator review after validation.
- At 09:05: direct-route assumption invalidated; light/detour can be proposed.
- Deadline 09:45: hold; neither route meets the complete handling/buffer budget.
- At 11:01: expired observations remain unknown; hold for verification.

Logistics rows live in a dedicated local Postgres container, with a read-only
query role. Route and observation JSON arrays are registered in Zetaris separately.
The bounded candidate query joins those sources and returns four candidate rows;
the model receives compact assessments, not raw text or a database dump.

Author: PortalOne hackathon team with Codex assistance, 2026-10-24.
Original synthetic data in this directory is dedicated under CC0-1.0:
https://creativecommons.org/publicdomain/zero/1.0/ . Third-party tools retain
their own licenses. `manifest.json` records content hashes and source boundaries.
