import { useEffect, useRef, useState } from 'react';
import type { MissionView } from '../lib/server/mission-runtime';
import type { FeatureCollection } from 'geojson';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function CommunityMapView({ view }: { view: MissionView }) {
  const element = useRef<HTMLDivElement>(null), map = useRef<Leaflet.Map | null>(null), reports = useRef<Leaflet.LayerGroup | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false; const abort = new AbortController();
    void (async () => {
      try {
        const L = await import('leaflet');
        const layers = await Promise.all(['roads', 'places', 'facilities'].map(async layer => { const r = await fetch(`/api/map/${layer}`, { signal: abort.signal }); if (!r.ok) throw new Error(); return await r.json() as FeatureCollection; }));
        if (cancelled || !element.current) return;
        const instance = L.map(element.current, { zoomControl: false, preferCanvas: true }); map.current = instance;
        L.control.zoom({ position: 'topright' }).addTo(instance);
        const [west, south, east, north] = view.map.bounds as [number, number, number, number]; instance.fitBounds([[south, west], [north, east]]);
        const label = (text: string) => { const node = document.createElement('span'); node.textContent = text; return node; };
        L.geoJSON(layers[0], { filter: f => ['LineString', 'MultiLineString'].includes(f.geometry.type),
          style: f => ({ color: ['trunk', 'primary'].includes(f?.properties?.['highway']) ? '#7a8590' : '#414e57', weight: f?.properties?.['highway'] === 'primary' ? 3 : 1.3, opacity: .8 }),
          onEachFeature: (f, layer) => layer.bindTooltip(label(`${f.properties?.['name'] ?? 'Mapped road'} · present condition unknown`)) }).addTo(instance);
        L.geoJSON(layers[1], { pointToLayer: (f, latlng) => L.circleMarker(latlng, { radius: f.properties?.['place'] === 'city' ? 5 : 3, color: '#b6c3c3', fillColor: '#b6c3c3', fillOpacity: .9, weight: 1 }),
          onEachFeature: (f, layer) => layer.bindTooltip(label(String(f.properties?.['name'] ?? 'Mapped place')), { permanent: true, direction: 'right', className: 'place-label' }) }).addTo(instance);
        L.geoJSON(layers[2], { style: { color: '#78a9a0', weight: 1, fillOpacity: .15 },
          pointToLayer: (_, latlng) => L.circleMarker(latlng, { radius: 4, color: '#78a9a0', weight: 1, fillOpacity: .3 }),
          onEachFeature: (f, layer) => layer.bindTooltip(label(`${f.properties?.['name'] ?? 'Mapped health facility'} · operation unverified`)) }).addTo(instance);
        instance.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · HOT / HDX · ODbL');
        reports.current = L.layerGroup().addTo(instance); setReady(true);
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; abort.abort(); map.current?.remove(); map.current = null; reports.current = null; };
  }, [view.map.version]);
  useEffect(() => {
    if (!ready || !reports.current) return;
    void import('leaflet').then(L => {
      if (!reports.current) return; reports.current.clearLayers();
      for (const grounding of view.groundings) {
        if (!grounding.location) continue;
        const signal = view.signals.find(s => s.id === grounding.signalId); if (!signal) continue;
        const node = document.createElement('span'); node.textContent = `${signal.mode === 'demo' ? 'DEMONSTRATION' : 'UNVERIFIED REPORT'} · ${signal.placeName} · ${grounding.gap}`;
        L.circleMarker([grounding.location.lat, grounding.location.lng], { radius: 12, color: signal.mode === 'demo' ? '#dcba7c' : '#a6bfd6', weight: 2, fillOpacity: .15 }).bindTooltip(node).addTo(reports.current);
      }
    });
  }, [ready, view.groundings, view.signals]);
  return <div className="community-map"><div ref={element} className="map-canvas" aria-label="Community geography map of Bamenda and Bambili" />
    <div className="map-caption"><span className="eyebrow">COMMUNITY CONTEXT</span><h2>A picture of the ground.</h2><p>5,111 mapped road features · 16 places · 7 health facilities</p></div>
    {!ready && <div className="map-loading">{error ? 'Map unavailable. Check local map files.' : 'Loading acquired map geography…'}</div>}
    <div className="map-legend"><span><i className="road-key" />Mapped roads</span><span><i className="facility-key" />Health facility · operation unknown</span><span><i className="report-key" />Report area · unverified</span><p>Community matches locate a place, not the exact incident. No road is shown as cleared.</p></div>
  </div>;
}
