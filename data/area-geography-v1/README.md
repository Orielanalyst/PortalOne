# Cameroon reference geography

Public OpenStreetMap geography distributed through HOT / HDX, **ODbL-1.0**. © OpenStreetMap contributors. The [ODbL terms](https://opendatacommons.org/licenses/odbl/1-0/) and [OSM attribution requirements](https://www.openstreetmap.org/copyright) apply to these data, separately from the application code.

`places.json` retains 12,730 named source settlement references. `catalog.json` records the pinned national archive hashes, derived index hashes, source URLs and acquisition timestamp from the existing corridor source manifest. It does not contain credentials or community reports.

Two source extracts are retained under `maps/` for Buea and Limbé. Each manifest lists its reference point, ±5 km extraction window, counts, file hashes and limitations. The retained GeoJSON has been derived from the same source archives as the original corridor. Buea's three layers were also opened in the pinned native QGIS runtime and checked for counts and EPSG:4326 coordinates.

These are reference features, not current field observations, unique operating hospitals, safe routes or surveyed intervention boundaries. Whole features with bounding boxes overlapping the viewing window are retained. No completeness or present condition is asserted. Downloads must retain this attribution and source manifest.

Other source-matched Cameroon settlements can be mapped after the CLI prepares the national source indexes. The local machine reuses its pinned archives; a new machine downloads and verifies those archives. A changed remote archive fails verification rather than being substituted silently.
