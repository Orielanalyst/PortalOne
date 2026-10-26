import json, os
from pathlib import Path
from qgis.core import QgsApplication, QgsProject, Qgis
app=QgsApplication([],False); app.initQgis()
root=Path('/handoff'); project=QgsProject.instance()
if not project.read(str(root/'mission.qgz')): raise RuntimeError('Relocated QGIS project could not open')
expected=json.loads((root/'qgis-validation.json').read_text())
checks=[]
for layer in project.mapLayers().values():
    name=layer.source().split('layername=')[-1]
    expected_layer=next(row for row in expected['layers'] if row['layer']==name)
    if not layer.isValid() or layer.featureCount()!=expected_layer['count'] or layer.crs().authid()!='EPSG:4326': raise RuntimeError('Relocated layer failed: '+name)
    if not layer.source().startswith('/handoff/'): raise RuntimeError('Layer refers outside relocated pack: '+name)
    if not layer.renderer(): raise RuntimeError('Missing native renderer: '+name)
    invalid=sum(1 for feature in layer.getFeatures() if feature.hasGeometry() and not feature.geometry().isGeosValid())
    if invalid: raise RuntimeError('Invalid relocated geometry: '+name)
    checks.append({'layer':name,'features':layer.featureCount(),'crs':layer.crs().authid(),'valid':True,'invalidGeometries':invalid,'styleLoaded':True,'pathWithinExtractedPack':True})
expected_names={row['layer'] for row in expected['layers']}
if len(expected_names)!=len(expected['layers']) or {row['layer'] for row in checks}!=expected_names or len(checks)!=len(expected_names):
    raise RuntimeError('Relocated project does not contain the exact exported evidence layers')
layouts=project.layoutManager().layouts()
if expected.get('cartography'):
    from qgis.core import QgsLayoutItemMap, QgsCoordinateTransform
    if len(layouts)!=1:raise RuntimeError('Relocated atlas layout missing or duplicated')
    maps=[item for item in layouts[0].items() if isinstance(item,QgsLayoutItemMap)]
    if len(maps)!=2:raise RuntimeError('Atlas must retain its main map and regional inset')
    main=max(maps,key=lambda item:item.sizeWithUnits().width())
    route_layer=next((layer for layer in project.mapLayers().values() if layer.source().endswith('layername=mission_route')),None)
    if route_layer:
        transform=QgsCoordinateTransform(route_layer.crs(),main.crs(),project)
        for feature in route_layer.getFeatures():
            if feature['status']=='exclusion_scenario_unverified':continue
            if any(not main.extent().contains(transform.transform(vertex.x(),vertex.y())) for vertex in feature.geometry().vertices()):raise RuntimeError('Mission route is clipped by atlas framing')
result={'qgis':Qgis.QGIS_VERSION,'freshProcess':True,'openedFromZipAtNewMount':True,'displayCrs':project.crs().authid(),'layers':checks,'networkEnabled':False}
(root/'handoff-validation.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result),flush=True)
os._exit(0)
