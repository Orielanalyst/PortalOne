"""Build the mission atlas on container-local storage, then publish verified files."""
import json, os, sys, time, shutil, tempfile, textwrap
from pathlib import Path
from qgis.core import (QgsApplication, Qgis, QgsProject, QgsVectorLayer, QgsVectorFileWriter,
    QgsCoordinateReferenceSystem, QgsCoordinateTransform, QgsRectangle, QgsReferencedRectangle,
    QgsPrintLayout, QgsLayoutItemMap, QgsLayoutItemLabel, QgsLayoutItemScaleBar,
    QgsLayoutPoint, QgsLayoutSize, QgsLayoutExporter, QgsMarkerSymbol, QgsLineSymbol,
    QgsFillSymbol, QgsSingleSymbolRenderer, QgsPalLayerSettings, QgsTextFormat,
    QgsTextBufferSettings, QgsVectorLayerSimpleLabeling, QgsUnitTypes, QgsLayoutItemPage,
    QgsSimpleLineSymbolLayer, QgsSimpleMarkerSymbolLayer, QgsCategorizedSymbolRenderer,
    QgsRendererCategory, QgsRuleBasedRenderer, QgsLayoutItemMapGrid, QgsLayoutItemMarker)
from qgis.PyQt.QtGui import QFont, QColor

started=time.monotonic()
destination=Path(sys.argv[1]).resolve()
root=Path(tempfile.mkdtemp(prefix="reliefintel-map-"))
shutil.copy2(destination/"input.json",root/"input.json")
shutil.copytree(destination/"geojson",root/"geojson")
(root/"styles").mkdir()
payload=json.loads((root/"input.json").read_text(encoding="utf-8"))
dossier=payload["dossier"]
def stage(name):
    print(json.dumps({"stage":name,"elapsedSeconds":round(time.monotonic()-started,2)}),flush=True)

app=QgsApplication([],False);app.initQgis()
project=QgsProject.instance()
crs=QgsCoordinateReferenceSystem("EPSG:32632")
project.setCrs(crs);project.setFilePathStorage(Qgis.FilePathType.Relative)
project.setBackgroundColor(QColor("#f4f7f3"))
layers={};checks=[]
names={"roads":"Road network | condition unknown","road_candidates":"Possible report-to-road matches",
       "mission_route":"Mission route | unverified","mission_points":"A / B route references",
       "boundaries":"Mezam department | 2016 reference","facilities":"Health facility references",
       "blockages":"Reported access | unverified","intervention_zones":"Surveyed intervention zones",
       "intervention_candidates":"Community verification references","places":"Mapped settlements",
       "facility_footprints":"Mapped facility footprints"}
gpkg=root/"mission.gpkg"

def line(color,width,dash=False):
    return QgsLineSymbol.createSimple({"line_color":color,"line_width":str(width),"line_style":"dash" if dash else "solid","capstyle":"round","joinstyle":"round"})
def route_symbol(alternative=False):
    symbol=line("#ffffff",3.0 if not alternative else 2.0)
    symbol.appendSymbolLayer(QgsSimpleLineSymbolLayer.create({"line_color":"#7140c6" if not alternative else "#b77813",
        "line_width":"1.5" if not alternative else "0.9","line_style":"solid" if not alternative else "dash","capstyle":"round","joinstyle":"round"}))
    return symbol
def labels(layer,expression,color="#263e43",size=8,priority=5):
    settings=QgsPalLayerSettings();settings.fieldName=expression;settings.isExpression=True
    settings.placement=Qgis.LabelPlacement.OrderedPositionsAroundPoint;settings.dist=2;settings.priority=priority
    fmt=QgsTextFormat();fmt.setFont(QFont("DejaVu Sans",size));fmt.setSize(size);fmt.setColor(QColor(color))
    halo=QgsTextBufferSettings();halo.setEnabled(True);halo.setSize(.9);halo.setColor(QColor("white"));fmt.setBuffer(halo)
    settings.setFormat(fmt);layer.setLabeling(QgsVectorLayerSimpleLabeling(settings));layer.setLabelsEnabled(True)

for index,(name,geojson) in enumerate(dossier["layers"].items()):
    source=QgsVectorLayer(str(root/"geojson"/(name+".geojson")),name,"ogr")
    if not geojson["features"]:
        geometry="Polygon" if name in ("intervention_zones","boundaries","facility_footprints") else "LineString" if name in ("roads","road_candidates","mission_route") else "Point"
        source=QgsVectorLayer(geometry+"?crs=EPSG:4326&field=name:string&field=status:string&field=evidence_id:string",name,"memory")
    if not source.isValid():raise RuntimeError("Invalid source layer: "+name)
    options=QgsVectorFileWriter.SaveVectorOptions()
    options.driverName,options.layerName,options.fileEncoding="GPKG",name,"UTF-8"
    options.actionOnExistingFile=QgsVectorFileWriter.CreateOrOverwriteFile if index==0 else QgsVectorFileWriter.CreateOrOverwriteLayer
    result=QgsVectorFileWriter.writeAsVectorFormatV3(source,str(gpkg),project.transformContext(),options)
    if result[0]!=QgsVectorFileWriter.NoError:raise RuntimeError("GeoPackage write failed: "+name)
    layer=QgsVectorLayer(str(gpkg)+"|layername="+name,names.get(name,name),"ogr")
    if not layer.isValid() or layer.featureCount()!=len(geojson["features"]) or layer.crs().authid()!="EPSG:4326":raise RuntimeError("Layer round-trip failed: "+name)
    if name=="roads":
        categories=[]
        for value in ("trunk","primary","secondary","tertiary","residential","unclassified","service","track","path","footway",""):
            major=value in ("trunk","primary","secondary")
            categories.append(QgsRendererCategory(value,line("#a2afad" if major else "#ccd5d0",.34 if major else .16),value or "Other mapped roads"))
        layer.setRenderer(QgsCategorizedSymbolRenderer("highway",categories))
    elif name=="mission_route":
        renderer=QgsRuleBasedRenderer(route_symbol());parent=renderer.rootRule();parent.removeChildAt(0)
        main=QgsRuleBasedRenderer.Rule(route_symbol());main.setFilterExpression('\"status\" != \'exclusion_scenario_unverified\'');main.setLabel("Mission route candidate")
        alt=QgsRuleBasedRenderer.Rule(route_symbol(True));alt.setFilterExpression('\"status\" = \'exclusion_scenario_unverified\'');alt.setLabel("Geometric exclusion scenario")
        parent.appendChild(main);parent.appendChild(alt);layer.setRenderer(renderer)
    elif name=="road_candidates":layer.setRenderer(QgsSingleSymbolRenderer(line("#df9e32",1.0,True)))
    elif name=="boundaries":layer.setRenderer(QgsSingleSymbolRenderer(QgsFillSymbol.createSimple({"color":"0,0,0,0","outline_color":"#508b87","outline_width":".6","outline_style":"dash"})))
    elif name=="facilities":
        symbol=QgsMarkerSymbol.createSimple({"name":"circle","color":"#167f79","outline_color":"white","outline_width":".5","size":"4.5"})
        symbol.appendSymbolLayer(QgsSimpleMarkerSymbolLayer.create({"name":"cross_fill","color":"white","outline_style":"no","size":"2.6"}))
        layer.setRenderer(QgsSingleSymbolRenderer(symbol));labels(layer,"'H' || $id","#126f69",8,8)
    elif name=="mission_points":
        categories=[]
        for role,color in (("origin","#7140c6"),("destination","#db9c28")):
            symbol=QgsMarkerSymbol.createSimple({"name":"circle","color":color,"outline_color":"white","outline_width":".8","size":"7"})
            if role=="destination":symbol.appendSymbolLayer(QgsSimpleMarkerSymbolLayer.create({"name":"circle","color":"white","outline_style":"no","size":"2"}))
            categories.append(QgsRendererCategory(role,symbol,role.title()+" road reference"))
        layer.setRenderer(QgsCategorizedSymbolRenderer("role",categories));labels(layer,'\"label\" || \' | \' || \"name\"',"#263e43",10,10)
    elif name in ("intervention_zones","facility_footprints"):
        layer.setRenderer(QgsSingleSymbolRenderer(QgsFillSymbol.createSimple({"color":"237,183,71,35","outline_color":"#a78132" if name=="intervention_zones" else "#53aaa0","outline_width":".4"})))
    elif name=="blockages":
        layer.setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol.createSimple({"name":"triangle","color":"#cc693b","outline_color":"white","outline_width":".45","size":"5.5","offset":"-5,-4"})))
        labels(layer,"'Reported access | unverified'","#9c4e27",7,9)
    else:
        layer.setRenderer(QgsSingleSymbolRenderer(QgsMarkerSymbol.createSimple({"name":"circle","color":"0,0,0,0" if name=="intervention_candidates" else "#81928c",
          "outline_color":"#c99236" if name=="intervention_candidates" else "#81928c","outline_width":".5","size":"5.5" if name=="intervention_candidates" else "1.5"})))
        if name=="places":labels(layer,'\"name\"',"#586e68",7,2)
    project.addMapLayer(layer);layers[name]=layer
    invalid=sum(1 for feature in layer.getFeatures() if feature.hasGeometry() and not feature.geometry().isGeosValid())
    if invalid:raise RuntimeError("Invalid feature geometry: "+name)
    checks.append({"layer":name,"count":layer.featureCount(),"crs":layer.crs().authid(),"valid":True,"invalidGeometries":invalid})
    layer.saveNamedStyle(str(root/"styles"/(name+".qml")))
    stage("Validated "+name+" ("+str(layer.featureCount())+" features)")

layout=QgsPrintLayout(project);layout.initializeDefaults();layout.setName("Mission atlas | route and evidence")
layout.pageCollection().pages()[0].setPageSize("A3",QgsLayoutItemPage.Landscape)
project.layoutManager().addLayout(layout)
def label(text,x,y,width,height,size=9,color="#274047",bold=False):
    item=QgsLayoutItemLabel(layout);item.setText(str(text));font=QFont("DejaVu Sans");font.setPointSizeF(size);font.setBold(bold);item.setFont(font);item.setFontColor(QColor(color));layout.addLayoutItem(item)
    item.attemptMove(QgsLayoutPoint(x,y));item.attemptResize(QgsLayoutSize(width,height));return item
def map_box(x,y,w,h):
    item=QgsLayoutItemMap(layout);layout.addLayoutItem(item);item.attemptMove(QgsLayoutPoint(x,y));item.attemptResize(QgsLayoutSize(w,h));item.setCrs(crs)
    item.setBackgroundColor(QColor("#f4f7f3"));item.setFrameEnabled(True);item.setFrameStrokeColor(QColor("#8ca39a"));return item

route=dossier.get("planning",{}).get("route") or {}
title=(route.get("from","Bamenda")+" > "+route.get("to","Bambili")) if route.get("geometry") else "Bamenda - Bambili"
label("RELIEFINTEL  /  MISSION ATLAS",14,8,300,8,10,"#21766f",True)
label(title,14,17,360,15,24,"#183b40",True)
label("COMMITTEE PROPOSAL  |  FIELD CONDITIONS UNVERIFIED  |  "+dossier["capturedAt"][:16].replace("T"," ")+" UTC",14,33,390,8,8)
main_map=map_box(14,47,292,221)
ordered=[layers[key] for key in ("mission_points","facilities","blockages","mission_route","road_candidates","intervention_candidates","places","intervention_zones","facility_footprints","roads","boundaries") if key in layers]
main_map.setLayers(ordered);main_map.setKeepLayerSet(True)
transform=QgsCoordinateTransform(QgsCoordinateReferenceSystem("EPSG:4326"),crs,project)
bounds=dossier["bounds"];coverage=transform.transformBoundingBox(QgsRectangle(*bounds))
if route.get("geometry"):
    coordinates=route["geometry"]["coordinates"];xs=[p[0] for p in coordinates];ys=[p[1] for p in coordinates]
    extent=transform.transformBoundingBox(QgsRectangle(min(xs),min(ys),max(xs),max(ys)));extent.scale(1.36)
else:extent=QgsRectangle(coverage);extent.scale(1.05)
main_map.zoomToExtent(extent)
project.viewSettings().setDefaultViewExtent(QgsReferencedRectangle(main_map.extent(),crs))
grid=main_map.grid();grid.setEnabled(True);grid.setCrs(QgsCoordinateReferenceSystem("EPSG:4326"))
grid.setIntervalX(.02);grid.setIntervalY(.02);grid.setStyle(QgsLayoutItemMapGrid.FrameAnnotationsOnly);grid.setFrameStyle(QgsLayoutItemMapGrid.ExteriorTicks)
grid.setFrameWidth(1.2);grid.setAnnotationEnabled(True);grid.setAnnotationFormat(QgsLayoutItemMapGrid.DecimalWithSuffix);grid.setAnnotationPrecision(2)
grid.setAnnotationFont(QFont("DejaVu Sans",7));grid.setAnnotationFrameDistance(1.8)
for side in (QgsLayoutItemMapGrid.Left,QgsLayoutItemMapGrid.Bottom):
    grid.setAnnotationPosition(QgsLayoutItemMapGrid.OutsideMapFrame,side);grid.setAnnotationDirection(QgsLayoutItemMapGrid.Horizontal,side)
for side in (QgsLayoutItemMapGrid.Top,QgsLayoutItemMapGrid.Right):grid.setAnnotationDisplay(QgsLayoutItemMapGrid.HideAll,side)

label("N",287,52,12,6,10,bold=True)
north=QgsLayoutItemMarker(layout);north.setSymbol(QgsMarkerSymbol.createSimple({"name":"triangle","color":"#183b40","size":"7","outline_style":"no"}));layout.addLayoutItem(north);north.attemptMove(QgsLayoutPoint(293,65));label("grid",286,70,16,5,6)
scale=QgsLayoutItemScaleBar(layout);scale.setStyle("Single Box");scale.setLinkedMap(main_map);scale.applyDefaultSize()
scale.setUnits(QgsUnitTypes.DistanceKilometers);scale.setUnitsPerSegment(1 if route.get("geometry") else 2);scale.setNumberOfSegments(2);scale.setNumberOfSegmentsLeft(0);scale.setUnitLabel("km")
scale.setBackgroundEnabled(True);scale.setBackgroundColor(QColor("#ffffff"));layout.addLayoutItem(scale);scale.attemptMove(QgsLayoutPoint(21,251))

label("REGIONAL CONTEXT",319,46,85,7,9,bold=True)
inset=map_box(319,55,87,45)
inset.setLayers([layers[k] for k in ("mission_route","roads","boundaries") if k in layers]);inset.setKeepLayerSet(True)
context=QgsRectangle(coverage)
if "boundaries" in layers and layers["boundaries"].featureCount():context.combineExtentWith(transform.transformBoundingBox(layers["boundaries"].extent()))
context.scale(1.08);inset.zoomToExtent(context);inset.overview().setLinkedMap(main_map)
inset.overview().setFrameSymbol(QgsFillSymbol.createSimple({"color":"113,64,198,18","outline_color":"#7140c6","outline_width":".5"}))
label("Rectangle: main map extent. Department source: 2016.",319,101,88,9,6.4)
label("MISSION REFERENCES",319,114,88,7,9,bold=True)
distance=str(route["distanceKm"])+" km geometric candidate" if route.get("distanceKm") is not None else "Route not resolved"
label("A  "+route.get("from","Origin unresolved")+"\nB  "+route.get("to","Destination unresolved")+"\n"+distance,319,123,88,22,8)
label("LEGEND",319,150,88,7,9,bold=True)
legend_rows=[("route","Mission route candidate"),("target","Destination road reference"),("facility","Health facility / H-number"),("access","Reported access, unverified"),("candidate","Possible road match"),("boundary","Mezam administrative reference")]
for index,(kind,caption) in enumerate(legend_rows):
    y=161+index*7.5
    if kind in ("route","candidate","boundary"):
        symbol=route_symbol() if kind=="route" else line("#df9e32" if kind=="candidate" else "#508b87",.8,True)
        from qgis.core import QgsLayoutItemPolyline
        from qgis.PyQt.QtCore import QPointF
        from qgis.PyQt.QtGui import QPolygonF
        item=QgsLayoutItemPolyline(QPolygonF([QPointF(0,0),QPointF(11,0)]),layout);item.setSymbol(symbol);layout.addLayoutItem(item);item.attemptMove(QgsLayoutPoint(320,y+3))
    else:
        item=QgsLayoutItemMarker(layout);item.setSymbol(layers["facilities"].renderer().symbol().clone() if kind=="facility" else QgsMarkerSymbol.createSimple({"name":"triangle" if kind=="access" else "circle","color":{"target":"#db9c28","access":"#cc693b"}[kind],"outline_color":"white","outline_width":".3","size":"3.5"}));layout.addLayoutItem(item);item.attemptMove(QgsLayoutPoint(324,y+3))
    label(caption,334,y,73,7,7.3)
label("HEALTH FEATURE INDEX",319,212,88,7,9,bold=True)
health=[]
for index,feature in enumerate(dossier["layers"].get("facilities",{}).get("features",[])):
    health.extend(textwrap.wrap("H"+str(index+1)+"  "+str(feature["properties"]["name"]),48))
label("\n".join(health),319,222,88,46,7.1)
label("Endpoints are road references, not verified entrances. Access symbols are offset for legibility; source coordinates are unchanged. No surveyed intervention boundary is available.",14,278,392,7,7)
label("Scale bar applies to this map. Grid: WGS 84 (EPSG:4326). Display: UTM 32N (EPSG:32632). Operational hold.",14,285,392,6,6.8)
label("© OpenStreetMap contributors / HOT / HDX, ODbL 1.0, snapshot 7 Oct 2026. Mezam: geoBoundaries / Open Africa, 2016, CC BY 4.0.",14,291,392,5,6.4)
stage("Rendering route-focused A3 atlas and regional inset")
exporter=QgsLayoutExporter(layout);image_settings=QgsLayoutExporter.ImageExportSettings();image_settings.dpi=180
if exporter.exportToImage(str(root/"map.png"),image_settings)!=QgsLayoutExporter.Success:raise RuntimeError("Map image export failed")
if exporter.exportToPdf(str(root/"map.pdf"),QgsLayoutExporter.PdfExportSettings())!=QgsLayoutExporter.Success:raise RuntimeError("Map PDF export failed")
project.setFileName(str(root/"mission.qgz"))
if not project.write():raise RuntimeError("QGIS project save failed")
main_extent=QgsRectangle(main_map.extent())
if not project.read(str(root/"mission.qgz")) or any(not layer.isValid() for layer in project.mapLayers().values()):raise RuntimeError("Saved QGIS project did not reopen")
validation={"qgis":Qgis.QGIS_VERSION,"layers":checks,"projectReopened":True,"displayCrs":"EPSG:32632","sourceCrs":"EPSG:4326","networkEnabled":False,
 "cartography":{"page":"A3 landscape","routeFocused":bool(route.get("geometry")),"routeHalo":True,"endpointReferences":len(dossier["layers"].get("mission_points",{}).get("features",[])),
 "regionalInset":True,"coordinateTicks":True,"scaleBar":True,"northArrow":"grid north","administrativeSourceYear":2016 if "boundaries" in layers else None,
 "mainExtentContainsRoute":not route.get("geometry") or all(main_extent.contains(transform.transform(p[0],p[1])) for p in route["geometry"]["coordinates"])},
 "containerLocalProcessing":True,"elapsedSeconds":round(time.monotonic()-started,2)}
(root/"qgis-validation.json").write_text(json.dumps(validation,indent=2),encoding="utf-8")
for name in ("styles","map.png","map.pdf","mission.gpkg","mission.qgz","qgis-validation.json"):
    source=root/name
    if source.is_dir():shutil.copytree(source,destination/name,dirs_exist_ok=True)
    else:shutil.copy2(source,destination/name)
stage("Published validated atlas, GeoPackage, project and styles")
# One-shot isolated process: avoid Qt/SIP destructor-order crashes after native reopen.
os._exit(0)
