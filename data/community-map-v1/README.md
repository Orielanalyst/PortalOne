# Bamenda–Bambili mapped geography

© OpenStreetMap contributors. Available under the [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Derived from HOT OpenStreetMap exports distributed through HDX, acquired on
25 October 2026. The source metadata describes the Geofabrik Cameroon snapshot
of 7 October 2026. This derived database retains the same ODbL license; it is
separate from PortalOne's synthetic scenario data.

Sources: [roads](https://data.humdata.org/dataset/hotosm_cmr_roads),
[populated places](https://data.humdata.org/dataset/hotosm_cmr_populated_places),
[health facilities](https://data.humdata.org/dataset/hotosm_cmr_health_facilities).
The manifest records resource URLs, source archive hashes, source metadata,
selection extent and each output hash. The rectangular extent is a viewing area,
not an administrative boundary. Whole intersecting features remain uncut.

- `roads.geojson`: 5,111 road-related features. The display uses line geometries;
  point road attributes are retained in the data without generic map pins.
- `places.geojson`: 16 named settlements. Duplicate names remain separate
  candidates; Balewa is deliberately ambiguous.
- `facilities.geojson`: seven mapped health features. No operating status inferred.

Missing road attributes remain unknown. This data does not establish current
passability, security, road load certification, facility operation or completeness.
HOT and OSM are the same underlying source, not two independent confirmations.

`bun scripts/prepare-community-map.ts` verifies an existing immutable extract or
downloads the source archives and prepares it using the pinned parser packages.
Large raw source archives stay in ignored `.runtime/map-acquisition/`; the bounded
derived files are committed so rendering needs no external tiles, fonts or geocoder.
