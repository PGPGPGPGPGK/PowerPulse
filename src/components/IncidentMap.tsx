import type { Area, GeoPoint, Incident, OfficialEvent } from '../types/outage';

/**
 * Prototype map. Deliberately not a real map integration: an SVG plane with a
 * simple equirectangular projection, so incident circles keep their true
 * ground size (the viewBox is in units of 10 m). MapLibre or Google Maps can
 * replace this component without changing anything that feeds it.
 *
 * Only approximate cluster circles are drawn: one circle per incident, never a
 * dot per household. The "you" marker is drawn for the viewer alone and is not
 * part of any shared data.
 */

const METRES_PER_DEG_LAT = 111_320;
const UNIT_M = 10; // one SVG unit = 10 m
const PAD_M = 1_500;
/** Minimum drawn radius so small clusters stay tappable on a phone. */
const MIN_TOUCH_R = 26;

interface Projection {
  width: number;
  height: number;
  toX: (lng: number) => number;
  toY: (lat: number) => number;
  toRadius: (meters: number) => number;
}

function buildProjection(points: GeoPoint[]): Projection {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const metresPerDegLng = METRES_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180);

  const padLat = PAD_M / METRES_PER_DEG_LAT;
  const padLng = PAD_M / metresPerDegLng;
  const north = Math.max(...lats) + padLat;
  const south = Math.min(...lats) - padLat;
  const west = Math.min(...lngs) - padLng;
  const east = Math.max(...lngs) + padLng;

  return {
    width: ((east - west) * metresPerDegLng) / UNIT_M,
    height: ((north - south) * METRES_PER_DEG_LAT) / UNIT_M,
    toX: (lng) => ((lng - west) * metresPerDegLng) / UNIT_M,
    toY: (lat) => ((north - lat) * METRES_PER_DEG_LAT) / UNIT_M,
    toRadius: (meters) => meters / UNIT_M,
  };
}

export function IncidentMap({
  areas,
  incidents,
  officialEvents,
  viewerPoint,
  selectedIncidentId,
  onSelectIncident,
}: {
  areas: Area[];
  incidents: Incident[];
  officialEvents: OfficialEvent[];
  viewerPoint: GeoPoint;
  selectedIncidentId?: string;
  onSelectIncident: (incident: Incident) => void;
}) {
  const projection = buildProjection([
    ...areas.map((area) => area.center),
    ...incidents.map((incident) => incident.publicCenter),
    ...officialEvents.map((event) => event.center),
    viewerPoint,
  ]);

  const gridStep = 100; // 1 km
  const verticals = Math.ceil(projection.width / gridStep);
  const horizontals = Math.ceil(projection.height / gridStep);

  return (
    <div className="mapFrame">
      <svg
        className="mapSvg"
        viewBox={`0 0 ${projection.width} ${projection.height}`}
        role="img"
        aria-label={`Prototype map of the pilot areas with ${incidents.length} community-reported incidents and ${officialEvents.length} official demo entries`}
      >
        <rect x="0" y="0" width={projection.width} height={projection.height} className="map__bg" />

        <g className="map__grid" aria-hidden="true">
          {Array.from({ length: verticals }, (_, i) => (
            <line key={`v${i}`} x1={i * gridStep} y1="0" x2={i * gridStep} y2={projection.height} />
          ))}
          {Array.from({ length: horizontals }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * gridStep} x2={projection.width} y2={i * gridStep} />
          ))}
        </g>

        {areas.map((area) => (
          <g key={area.id} className="map__area" aria-hidden="true">
            <circle cx={projection.toX(area.center.lng)} cy={projection.toY(area.center.lat)} r="6" />
            <text x={projection.toX(area.center.lng) + 14} y={projection.toY(area.center.lat) + 6}>
              {area.name}
            </text>
          </g>
        ))}

        {officialEvents.map((event) => (
          <g key={event.id} className="map__official">
            <circle
              cx={projection.toX(event.center.lng)}
              cy={projection.toY(event.center.lat)}
              r={projection.toRadius(event.radiusMeters)}
            />
          </g>
        ))}

        {incidents.map((incident) => (
          <g
            key={incident.id}
            className={`map__incident map__incident--${incident.status}${
              incident.id === selectedIncidentId ? ' is-selected' : ''
            }`}
            role="button"
            tabIndex={0}
            aria-label={`${incident.localityLabel}: ${incident.reporterCount} reports, ${incident.status}`}
            onClick={() => onSelectIncident(incident)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelectIncident(incident);
              }
            }}
          >
            <circle
              cx={projection.toX(incident.publicCenter.lng)}
              cy={projection.toY(incident.publicCenter.lat)}
              r={Math.max(projection.toRadius(incident.radiusMeters), MIN_TOUCH_R)}
            />
            <text
              x={projection.toX(incident.publicCenter.lng)}
              y={projection.toY(incident.publicCenter.lat) + 10}
              textAnchor="middle"
            >
              {incident.reporterCount}
            </text>
          </g>
        ))}

        <g className="map__you" aria-hidden="true">
          <circle
            className="map__you-halo"
            cx={projection.toX(viewerPoint.lng)}
            cy={projection.toY(viewerPoint.lat)}
            r="34"
          />
          <circle
            cx={projection.toX(viewerPoint.lng)}
            cy={projection.toY(viewerPoint.lat)}
            r="14"
          />
          <text x={projection.toX(viewerPoint.lng)} y={projection.toY(viewerPoint.lat) - 26}>
            You (approx.)
          </text>
        </g>
      </svg>

      <ul className="mapLegend">
        <li>
          <span className="swatch swatch--possible" /> Possible outage
        </li>
        <li>
          <span className="swatch swatch--confirmed" /> Community-confirmed
        </li>
        <li>
          <span className="swatch swatch--restoring" /> Possible restoration
        </li>
        <li>
          <span className="swatch swatch--restored" /> Restored
        </li>
        <li>
          <span className="swatch swatch--official" /> Official information (demo)
        </li>
        <li>
          <span className="swatch swatch--you" /> Your approximate area
        </li>
      </ul>

      <p className="note">
        Prototype map, not a real map integration yet. Circles show where reports are clustered, not
        that every property inside is without power.
      </p>
    </div>
  );
}
