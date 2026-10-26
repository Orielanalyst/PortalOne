# Mission atlas and GIS handoff

The mission map emphasises the sourced route candidate rather than fitting every
road in the acquired extract. The browser has a white-cased violet route, A/B
references, distinct facility and report symbols, layer switches, mission/coverage
framing, a north indicator, a dynamic scale and attribution. Resize observation
keeps the Leaflet canvas aligned with its panel. Report markers are grouped by
their displayed reference and may be offset for readability; underlying coordinates
are unchanged. Neither a mapped road nor a reference marker establishes clearance.

The export is an A3 landscape atlas with a route-focused map, coordinate ticks,
metric scale, grid-north arrow, regional locator, keyed health inventory, legend,
source dates and limitations. The solid route describes a geometric candidate;
present passability remains unknown. The PDF report inserts this native vector
page at its authored size, preserving readable map detail. The saved QGIS project
retains the print layout as well as the editable layers.

Eleven layers are exported: roads, road_candidates, mission_route, mission_points,
boundaries, facilities, blockages, intervention_zones, intervention_candidates,
places and facility_footprints. A/B are route-vertex references, not surveyed
loading/unloading entrances. Reported access, possible road matches, administrative
references and surveyed intervention zones have separate meanings and styles.
Empty surveyed-zone layers remain empty until suitable evidence is supplied.

## Acquired administrative reference

The separately licensed Mezam department polygon comes from geoBoundaries gbOpen
CMR ADM2, source Open Africa, representing **2016**. It is pinned to upstream
revision `9469f09`, with its source URL, input/output hashes, license and limitation
in `data/community-boundaries-v1/manifest.json`. The license is CC BY 4.0;
OpenStreetMap/HOT layers retain ODbL 1.0. A department boundary does not establish
a community catchment, intervention zone, current jurisdiction verification or
security perimeter. The original OSM extract and its hashes remain unchanged.

`bun scripts/prepare-community-boundaries.ts` verifies the retained local payload.
Only a missing payload triggers acquisition from the pinned GitHub LFS media URL;
the ordinary application does not download map data. The geometry hash joins the
evidence revision and World Model assumptions separately from the registered OSM
place identity, so a changed source can invalidate a proposal without relabelling
the existing federated place table.

## Export execution and verification

Native QGIS writes and validates its GeoPackage on container-local temporary
storage, then copies the closed, reopened outputs to the Windows workspace. This
avoids thousands of synchronous GeoPackage writes through a Windows Docker bind
mount. The process remains network-disabled, drops capabilities, uses the pinned
QGIS image and retains a bounded timeout. Per-layer progress is streamed into the
agent trace. Failures retain local diagnostics and never publish a ready pack.

The relocated handoff checker opens the extracted project from another mount,
requires the exact exported layer set, checks counts/CRS/geometries/renderers,
checks every layer path remains inside the extracted pack, and requires the saved
main map/inset layout and unclipped mission geometry. Final delivery additionally
requires visual inspection of the map and all report pages. Native review/update
acceptance is recorded separately; a styling rehearsal alone does not close it.
