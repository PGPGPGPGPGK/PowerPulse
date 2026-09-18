import type { GeoPoint, Incident } from '../../types/outage';

/**
 * Turns derived incidents into the GeoJSON the map draws.
 *
 * This module is the privacy boundary for the map: it accepts `Incident`
 * objects and reads only their PUBLIC fields - `publicCenter`, `radiusMeters`
 * and aggregate counts. Individual report coordinates are not available here
 * and are never drawn, so the map can show clusters but never households.
 *
 * It holds no MapLibre import, so it stays testable without a browser.
 */

/** Exactly the properties a map feature is allowed to carry. */
export interface IncidentFeatureProperties {
  id: string;
  status: Incident['status'];
  reporterCount: number;
  radiusMeters: number;
  localityLabel: string;
}

export interface PointFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: IncidentFeatureProperties;
}

export interface PolygonFeature {
  type: 'Feature';
  geometry: { type: 'Polygon'; coordinates: [number, number][][] };
  properties: IncidentFeatureProperties;
}

export interface FeatureCollection<T> {
  type: 'FeatureCollection';
  features: T[];
}

const METRES_PER_DEG_LAT = 111_320;

const propertiesOf = (incident: Incident): IncidentFeatureProperties => ({
  id: incident.id,
  status: incident.status,
  reporterCount: incident.reporterCount,
  radiusMeters: incident.radiusMeters,
  localityLabel: incident.localityLabel,
});

/**
 * Ring of points approximating a circle of `radiusMeters` on the ground, so
 * the drawn extent stays true to the cluster at every zoom level.
 */
export function circleRing(center: GeoPoint, radiusMeters: number, steps = 48): [number, number][] {
  const latDelta = radiusMeters / METRES_PER_DEG_LAT;
  const lngDelta = radiusMeters / (METRES_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180));

  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    ring.push([center.lng + Math.cos(angle) * lngDelta, center.lat + Math.sin(angle) * latDelta]);
  }
  ring.push(ring[0]); // close the ring
  return ring;
}

/** One marker per incident, placed at its public approximate centre. */
export function toIncidentPoints(incidents: Incident[]): FeatureCollection<PointFeature> {
  return {
    type: 'FeatureCollection',
    features: incidents.map((incident) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [incident.publicCenter.lng, incident.publicCenter.lat],
      },
      properties: propertiesOf(incident),
    })),
  };
}

/** The approximate extent of each report cluster. Not a coverage claim. */
export function toIncidentAreas(incidents: Incident[]): FeatureCollection<PolygonFeature> {
  return {
    type: 'FeatureCollection',
    features: incidents.map((incident) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [circleRing(incident.publicCenter, incident.radiusMeters)],
      },
      properties: propertiesOf(incident),
    })),
  };
}

/** Text alternative for one incident, used by the map's accessible summary. */
export function describeIncident(incident: Incident, distanceMeters?: number): string {
  const where =
    distanceMeters === undefined
      ? `near ${incident.localityLabel}`
      : `${Math.round(distanceMeters)} m away, near ${incident.localityLabel}`;
  return `${incident.status} outage, ${incident.reporterCount} reporting, ${where}, reports clustered within about ${incident.radiusMeters} m`;
}

/** Viewport that comfortably contains the viewer and the nearby incidents. */
export function boundsFor(points: GeoPoint[], paddingMeters = 400): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const padLat = paddingMeters / METRES_PER_DEG_LAT;
  const padLng = paddingMeters / (METRES_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180));

  return [
    [Math.min(...lngs) - padLng, Math.min(...lats) - padLat],
    [Math.max(...lngs) + padLng, Math.max(...lats) + padLat],
  ];
}
