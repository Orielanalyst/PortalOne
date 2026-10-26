"""Build, reopen and render the mission's actual layers using native QGIS."""
import json
import os
import sys
from pathlib import Path
from qgis.core import (QgsApplication, Qgis, QgsProject, QgsVectorLayer, QgsVectorFileWriter,
    QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsRectangle, QgsPrintLayout,
    QgsLayoutItemMap, QgsLayoutItemLegend, QgsLayoutItemLabel, QgsLayoutItemScaleBar,
    QgsLayoutPoint, QgsLayoutSize, QgsLayoutExporter, QgsMarkerSymbol, QgsLineSymbol,
    QgsFillSymbol, QgsSingleSymbolRenderer, QgsPalLayerSettings, QgsTextFormat,
    QgsTextBufferSettings, QgsVectorLayerSimpleLabeling, QgsUnitTypes)
from qgis.PyQt.QtGui import QFont, QColor

root = Path(sys.argv[1]).resolve()
payload = json.loads((root / "input.json").read_text(encoding="utf-8"))
app = QgsApplication([], False)
app.initQgis()
project = QgsProject.instance()
project.setCrs(QgsCoordinateReferenceSystem("EPSG:32632"))
project.setFilePathStorage(Qgis.FilePathType.Relative)
layers = []
checks = []
colors = {"roads":"#647681", "facilities":"#167c8a", "blockages":"#bb4d3e", "intervention_zones":"#d79e42", "intervention_candidates":"#c88d26", "places":"#3e565d", "facility_footprints":"#6a9999"}
names = {"roads":"Roads | condition unknown", "facilities":"Health facilities | unverified", "blockages":"Access reports | unverified", "intervention_zones":"Surveyed intervention zones", "intervention_candidates":"Community verification points", "places":"Named settlements", "facility_footprints":"Facility footprints"}
colors["road_candidates"]="#c88d26"
names["road_candidates"]="Possible road links | unverified"
colors["mission_route"]="#75679e"
names["mission_route"]="Mission route candidate | unverified"
gpkg = root / "mission.gpkg"
for index, (name, geojson) in enumerate(payload["dossier"]["layers"].items()):
    source = QgsVectorLayer(str(root / "geojson" / (name + ".geojson")), name, "ogr")
    if not geojson["features"]:
        geometry = "Polygon" if name == "intervention_zones" else "LineString" if name in ("roads","road_candidates","mission_route") else "Point"
        source = QgsVectorLayer(geometry + "?crs=EPSG:4326&field=name:string&field=status:string&field=evidence_id:string", name, "memory")
    if not source.isValid():
        raise RuntimeError("Invalid source layer: " + name)
    options = QgsVectorFileWriter.SaveVectorOptions()
    options.driverName, options.layerName, options.fileEncoding = "GPKG", name, "UTF-8"
    options.actionOnExistingFile = QgsVectorFileWriter.CreateOrOverwriteFile if index == 0 else QgsVectorFileWriter.CreateOrOverwriteLayer
    result = QgsVectorFileWriter.writeAsVectorFormatV3(source, str(gpkg), project.transformContext(), options)
    if result[0] != QgsVectorFileWriter.NoError:
        raise RuntimeError("GeoPackage write failed for " + name + ": " + str(result[1]))
    layer = QgsVectorLayer(str(gpkg) + "|layername=" + name, names[name], "ogr")
    if not layer.isValid() or layer.featureCount() != len(geojson["features"]) or layer.crs().authid() != "EPSG:4326":
        raise RuntimeError("QGIS round-trip validation failed: " + name)
    color = colors[name]
    if name in ("roads","road_candidates","mission_route"):
        symbol = QgsLineSymbol.createSimple({"line_color":color,"line_width":"0.75" if name=="mission_route" else "0.55" if name=="road_candidates" else "0.22","line_style":"dash" if name in ("road_candidates","mission_route") else "solid"})
    elif name in ("intervention_zones", "facility_footprints"):
        symbol = QgsFillSymbol.createSimple({"color":"220,235,232,80", "outline_color":color,"outline_width":"0.3"})
    else:
        symbol = QgsMarkerSymbol.createSimple({"name":"cross2" if name == "facilities" else "circle", "color":color, "outline_color":color, "outline_width":"0.4", "size":"3.2" if name == "facilities" else "1.8"})
    layer.setRenderer(QgsSingleSymbolRenderer(symbol))
    if name == "places":
        labels = QgsPalLayerSettings(); labels.fieldName = "name"
        formatting = QgsTextFormat(); formatting.setFont(QFont("DejaVu Sans", 8)); formatting.setSize(8); formatting.setColor(QColor("#33474a"))
        buffer = QgsTextBufferSettings(); buffer.setEnabled(True); buffer.setSize(0.65); buffer.setColor(QColor("white")); formatting.setBuffer(buffer)
        labels.setFormat(formatting); layer.setLabeling(QgsVectorLayerSimpleLabeling(labels)); layer.setLabelsEnabled(True)
    project.addMapLayer(layer); layers.append(layer)
    invalid = sum(1 for feature in layer.getFeatures() if feature.hasGeometry() and not feature.geometry().isGeosValid())
    if invalid: raise RuntimeError("Invalid feature geometry in " + name)
    checks.append({"layer":name,"count":layer.featureCount(),"crs":layer.crs().authid(),"valid":True,"invalidGeometries":invalid})
    layer.saveNamedStyle(str(root / "styles" / (name + ".qml")))

layout = QgsPrintLayout(project); layout.initializeDefaults()
from qgis.core import QgsLayoutItemPage
layout.pageCollection().pages()[0].setPageSize("A4", QgsLayoutItemPage.Landscape)
map_item = QgsLayoutItemMap(layout); layout.addLayoutItem(map_item)
map_item.attemptMove(QgsLayoutPoint(8, 25)); map_item.attemptResize(QgsLayoutSize(208, 159)); map_item.setCrs(project.crs())
ordered = [layer for key in ["places","facilities","blockages","intervention_candidates","road_candidates","mission_route","intervention_zones","facility_footprints","roads"] for layer in layers if layer.name() == names[key]]
map_item.setLayers(ordered); map_item.setKeepLayerSet(True)
west,south,east,north = payload["dossier"]["bounds"]
transform = QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:4326"),project.crs(),project)
extent = transform.transformBoundingBox(QgsRectangle(west,south,east,north)); extent.scale(1.03); map_item.zoomToExtent(extent)

def label(text, x, y, width, height, size=9):
    item=QgsLayoutItemLabel(layout); item.setText(text); item.setFont(QFont("DejaVu Sans",size)); layout.addLayoutItem(item)
    item.attemptMove(QgsLayoutPoint(x,y)); item.attemptResize(QgsLayoutSize(width,height)); return item
label("RELIEFINTEL | Committee evidence map",8,5,280,11,16)
label("Acquired geography and unverified reports | Operational hold | " + payload["dossier"]["capturedAt"],8,16,280,7,8)
legend=QgsLayoutItemLegend(layout); legend.setTitle("Evidence layers"); legend.setLinkedMap(map_item); layout.addLayoutItem(legend)
legend.setWrapString(" | ")
from qgis.core import QgsLegendStyle
for component in (QgsLegendStyle.Title,QgsLegendStyle.Group,QgsLegendStyle.Subgroup,QgsLegendStyle.SymbolLabel):
    style=legend.rstyle(component); formatting=QgsTextFormat(); formatting.setFont(QFont("DejaVu Sans",8)); formatting.setSize(8); style.setTextFormat(formatting)
legend.attemptMove(QgsLayoutPoint(220,27)); legend.attemptResize(QgsLayoutSize(68,92))
label("Empty layers are evidence gaps:\nNo surveyed intervention zones.\nUnlocated blockage claims are\nlisted in the report, not pinned.\n\nFacility capacity and operation\nare unverified. Coverage is\nnot an exhaustive inventory.\n\nReference points are not\nverified incident/entrance points.",221,115,67,65,8)
scale=QgsLayoutItemScaleBar(layout); scale.setStyle("Single Box"); scale.setLinkedMap(map_item); scale.applyDefaultSize()
scale.setUnits(QgsUnitTypes.DistanceKilometers); scale.setUnitsPerSegment(2); scale.setNumberOfSegments(2); scale.setNumberOfSegmentsLeft(0); scale.setUnitLabel("km")
layout.addLayoutItem(scale); scale.attemptMove(QgsLayoutPoint(14,171))
label("N (grid)",190,29,23,8,9)
label("EPSG:32632 map display | EPSG:4326 source layers | Geographic scale shown by bar",8,188,280,7,8)
label("© OpenStreetMap contributors | HOT / HDX | ODbL 1.0 | Source snapshot: 7 October 2026",8,196,280,7,8)
exporter=QgsLayoutExporter(layout); image_settings=QgsLayoutExporter.ImageExportSettings(); image_settings.dpi=180
if exporter.exportToImage(str(root / "map.png"),image_settings) != QgsLayoutExporter.Success: raise RuntimeError("Map image export failed")
if exporter.exportToPdf(str(root / "map.pdf"),QgsLayoutExporter.PdfExportSettings()) != QgsLayoutExporter.Success: raise RuntimeError("Map PDF export failed")
project.setFileName(str(root / "mission.qgz"))
if not project.write(): raise RuntimeError("QGIS project save failed")
if not project.read(str(root / "mission.qgz")) or any(not layer.isValid() for layer in project.mapLayers().values()): raise RuntimeError("Saved QGIS project did not reopen cleanly")
(root / "qgis-validation.json").write_text(json.dumps({"qgis":Qgis.QGIS_VERSION,"layers":checks,"projectReopened":True,"displayCrs":"EPSG:32632","sourceCrs":"EPSG:4326","networkEnabled":False},indent=2),encoding="utf-8")
print(json.dumps({"qgis":Qgis.QGIS_VERSION,"layers":len(checks),"projectReopened":True}),flush=True)
# This is a one-shot, isolated container. All files have been closed and reopened
# above. Exit after validation to avoid Qt/SIP destruction-order crashes at teardown.
os._exit(0)
