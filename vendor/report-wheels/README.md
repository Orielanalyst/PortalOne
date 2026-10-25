# Local report runtime

Pinned CPython 3.12 Windows x86_64 wheels for ReportLab, Pillow, pypdf and
charset-normalizer. Each archive contains upstream license text. The manifest
records its declared license, PyPI source URL and verified SHA-256. These are
separate from product data and do not contain credentials.

`bun scripts/check-report-assets.ts` verifies the retained bytes without network
access. `scripts/setup-report-runtime.ps1 -Python <absolute-python.exe>` installs
them into ignored `.local-tools/report-python` without registry requests. A
different platform needs corresponding wheels for the same versions.

GIS work uses the separately cached official QGIS LTR image, not Python Fiona:
`qgis/qgis@sha256:bacafbaf899bb2af5d99dd8a138e0438733aac252ddd5f29d089ad34641bb059`.
The image reported QGIS 3.44.15-Solothurn. QGIS is GPL-2.0-or-later; the official
[image build repository](https://github.com/qgis/qgis-docker) is AGPL-3.0. No QGIS
source code was copied into the application. Each export runs in a network-disabled
container, mounts only its report directory and export script, writes the
GeoPackage/project, and reopens the layers to check counts, CRS and geometry.
