import type { Area, GeoPoint } from '../types/outage';
import { distanceMeters } from '../features/outages/geo.ts';

/** Pilot areas. Centres are approximate neighbourhood centroids. */
export const pilotAreas: Area[] = [
  { id: 'kothapet', name: 'Kothapet', city: 'Hyderabad', center: { lat: 17.3675, lng: 78.531 } },
  { id: 'dilsukhnagar', name: 'Dilsukhnagar', city: 'Hyderabad', center: { lat: 17.3687, lng: 78.5247 } },
  { id: 'chaitanyapuri', name: 'Chaitanyapuri', city: 'Hyderabad', center: { lat: 17.362, lng: 78.533 } },
  { id: 'lb-nagar', name: 'LB Nagar', city: 'Hyderabad', center: { lat: 17.3457, lng: 78.5522 } },
  { id: 'uppal', name: 'Uppal', city: 'Hyderabad', center: { lat: 17.4058, lng: 78.559 } },
  { id: 'madhapur', name: 'Madhapur', city: 'Hyderabad', center: { lat: 17.4485, lng: 78.3908 } },
  { id: 'kondapur', name: 'Kondapur', city: 'Hyderabad', center: { lat: 17.464, lng: 78.364 } },
  { id: 'gachibowli', name: 'Gachibowli', city: 'Hyderabad', center: { lat: 17.4401, lng: 78.3489 } },
  { id: 'kukatpally', name: 'Kukatpally', city: 'Hyderabad', center: { lat: 17.4948, lng: 78.3996 } },
];

/**
 * Nearest pilot locality to a point. Used to LABEL a location or an incident
 * centroid, and as the manual location fallback. It never decides which
 * reports belong together.
 */
export function nearestArea(point: GeoPoint): Area {
  return pilotAreas.reduce((closest, area) =>
    distanceMeters(area.center, point) < distanceMeters(closest.center, point) ? area : closest,
  );
}

/** Labeller passed to the incident derivation. */
export const localityFor = (point: GeoPoint): { id: string; label: string } => {
  const area = nearestArea(point);
  return { id: area.id, label: area.name };
};

export const areaById = (id: string): Area =>
  pilotAreas.find((area) => area.id === id) ?? pilotAreas[0];
