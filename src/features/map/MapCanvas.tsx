import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl, ScaleControl } from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoPoint, Incident } from '../../types/outage';
import { boundsFor, toIncidentAreas, toIncidentPoints } from './incidentLayers';

/**
 * The only module that imports MapLibre. It is loaded on demand by the map
 * screen, so Home never waits for the map library to download.
 *
 * What it draws is limited to what `incidentLayers` produces - approximate
 * incident centres, their cluster extents and aggregate counts - plus the
 * viewer's own marker, which exists only in this browser. Individual report
 * coordinates are never handed to the map.
 */

/**
 * OpenFreeMap: OpenStreetMap-based vector tiles, no API key, no usage limit,
 * and explicitly permitted for production use. `liberty` is the style its
 * quick-start documents; `positron` resolves too and declares identical
 * sources, glyphs and sprite. Overridable per deployment.
 */
const DEFAULT_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const styleUrl = import.meta.env.VITE_MAP_STYLE_URL || DEFAULT_STYLE;

/**
 * How long to wait for the basemap to finish painting before treating it as
 * unusable. Generous, because a cold cache on mobile data is slow - but finite,
 * so a blank panel is never left sitting there with only the viewer's dot on it.
 */
const BASEMAP_TIMEOUT_MS = 15_000;

/**
 * Neither the style nor its TileJSON declares an attribution, so MapLibre's
 * control would otherwise render nothing. ODbL requires the credit to be
 * visible, so it is supplied here and repeated as text under the map.
 */
const ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · tiles <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>';

const AREAS = 'incident-areas';
const POINTS = 'incident-points';

/** Kept in step with the status tones used across the app. */
const statusColour: ExpressionSpecification = [
  'match',
  ['get', 'status'],
  'confirmed',
  '#c2410c',
  'restoring',
  '#1d4ed8',
  'restored',
  '#15803d',
  '#b45309', // possible
];

/** Emphasises whichever incident the screen has selected. */
const whenSelected = (id: string | undefined, on: number, off: number): ExpressionSpecification => [
  'case',
  ['==', ['get', 'id'], id ?? ''],
  on,
  off,
];

function viewerMarkerElement(): HTMLElement {
  const element = document.createElement('div');
  element.className = 'mapViewerMarker';
  element.setAttribute('aria-hidden', 'true');
  return element;
}

export function MapCanvas({
  incidents,
  viewerPoint,
  selectedId,
  onSelect,
  onError,
}: {
  incidents: Incident[];
  viewerPoint: GeoPoint;
  selectedId?: string;
  onSelect: (incidentId: string) => void;
  onError: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const ready = useRef(false);
  const basemapPainted = useRef(false);

  // Handlers are registered once on the map, so they read the latest callback
  // through this ref rather than being re-bound on every render.
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = new MapLibreMap({
      container: container.current,
      style: styleUrl,
      center: [viewerPoint.lng, viewerPoint.lat],
      // Close enough to read streets: nearby context beats the whole metro.
      zoom: 13.5,
      attributionControl: { compact: true, customAttribution: ATTRIBUTION },
    });
    map.current = instance;

    instance.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    instance.addControl(new ScaleControl({ maxWidth: 90, unit: 'metric' }));
    instance.dragRotate.disable();
    instance.touchZoomRotate.enableRotation();

    new Marker({ element: viewerMarkerElement() })
      .setLngLat([viewerPoint.lng, viewerPoint.lat])
      .addTo(instance);

    // The container can still be laying out when the map is created - most
    // often in production, where the chunk's stylesheet arrives with the code.
    // Without a re-measure the canvas keeps its initial size, which may be
    // zero: the marker shows, the basemap never paints.
    //
    // ResizeObserver is the precise tool, but it is not assumed to exist: the
    // deferred resizes below cover the same case everywhere, and MapLibre's own
    // trackResize already follows window resizes.
    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => instance.resize());
      resizeObserver.observe(container.current);
    }

    const deferredResizes = [0, 250, 1_000].map((delay) =>
      window.setTimeout(() => instance.resize(), delay),
    );

    // A style that never loads, or tiles that never arrive, must surface as
    // "map unavailable" rather than as an empty panel.
    const basemapTimeout = setTimeout(() => {
      if (!basemapPainted.current) {
        console.error('PowerPulse: basemap did not finish loading');
        onError();
      }
    }, BASEMAP_TIMEOUT_MS);

    instance.on('idle', () => {
      basemapPainted.current = true;
      clearTimeout(basemapTimeout);
    });

    instance.on('error', (event: { error?: unknown; sourceId?: string }) => {
      console.error('PowerPulse: map error', event.sourceId ?? 'style', event.error);
      // Before the first paint, any style or source failure means there is no
      // usable basemap. Afterwards a single missing tile is survivable.
      if (!basemapPainted.current) onError();
    });

    instance.on('load', () => {
      ready.current = true;
      // The container may have gained its real size while the style loaded.
      instance.resize();

      instance.addSource(AREAS, { type: 'geojson', data: toIncidentAreas(incidents) });
      instance.addSource(POINTS, { type: 'geojson', data: toIncidentPoints(incidents) });

      instance.addLayer({
        id: `${AREAS}-fill`,
        type: 'fill',
        source: AREAS,
        paint: { 'fill-color': statusColour, 'fill-opacity': 0.18 },
      });
      instance.addLayer({
        id: `${AREAS}-line`,
        type: 'line',
        source: AREAS,
        paint: {
          'line-color': statusColour,
          'line-width': whenSelected(selectedId, 3, 1.5),
        },
      });
      instance.addLayer({
        id: `${POINTS}-dot`,
        type: 'circle',
        source: POINTS,
        paint: {
          'circle-radius': 15,
          'circle-color': statusColour,
          'circle-stroke-width': whenSelected(selectedId, 4, 2),
          'circle-stroke-color': '#ffffff',
        },
      });
      instance.addLayer({
        id: `${POINTS}-count`,
        type: 'symbol',
        source: POINTS,
        layout: {
          'text-field': ['to-string', ['get', 'reporterCount']] as ExpressionSpecification,
          'text-size': 13,
          'text-font': ['Noto Sans Bold', 'Open Sans Bold'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#ffffff' },
      });

      [`${POINTS}-dot`, `${AREAS}-fill`].forEach((layer) => {
        instance.on(
          'click',
          layer,
          (event: MapMouseEvent & { features?: { properties?: Record<string, unknown> }[] }) => {
            const id = event.features?.[0]?.properties?.id;
            if (typeof id === 'string') select.current(id);
          },
        );
        instance.on('mouseenter', layer, () => {
          instance.getCanvas().style.cursor = 'pointer';
        });
        instance.on('mouseleave', layer, () => {
          instance.getCanvas().style.cursor = '';
        });
      });

      // Open on the viewer plus whatever is around them, not the whole city.
      const bounds = boundsFor([viewerPoint, ...incidents.map((i) => i.publicCenter)]);
      if (bounds) instance.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    });

    return () => {
      clearTimeout(basemapTimeout);
      deferredResizes.forEach((timer) => clearTimeout(timer));
      resizeObserver?.disconnect();
      instance.remove();
      map.current = null;
      ready.current = false;
      basemapPainted.current = false;
    };
    // Initialised once; later prop changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Incidents change in realtime as reports arrive.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready.current) return;
    (instance.getSource(AREAS) as GeoJSONSource | undefined)?.setData(toIncidentAreas(incidents));
    (instance.getSource(POINTS) as GeoJSONSource | undefined)?.setData(toIncidentPoints(incidents));
  }, [incidents]);

  // Selection is owned by the screen; the map only reflects and reports it.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready.current) return;

    instance.setPaintProperty(`${AREAS}-line`, 'line-width', whenSelected(selectedId, 3, 1.5));
    instance.setPaintProperty(`${POINTS}-dot`, 'circle-stroke-width', whenSelected(selectedId, 4, 2));

    const selected = incidents.find((incident) => incident.id === selectedId);
    if (selected) {
      instance.flyTo({
        center: [selected.publicCenter.lng, selected.publicCenter.lat],
        zoom: Math.max(instance.getZoom(), 14.5),
        speed: 1.2,
      });
    }
  }, [selectedId, incidents]);

  return (
    <div
      ref={container}
      className="mapCanvas"
      role="application"
      aria-label={`Map of ${incidents.length} community-reported outage areas near you. The list below the map carries the same information as text.`}
    />
  );
}

export default MapCanvas;
