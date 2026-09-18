import type { GeoPoint } from '../../types/outage';

const EARTH_RADIUS_M = 6_371_000;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function centroid(points: GeoPoint[]): GeoPoint {
  const sum = points.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Coarsen a location before it is stored, so no exact household position
 * ever enters the data layer. ~3 decimal places is roughly 100 m.
 */
export function coarsen(point: GeoPoint): GeoPoint {
  return {
    lat: Math.round(point.lat * 1000) / 1000,
    lng: Math.round(point.lng * 1000) / 1000,
  };
}
