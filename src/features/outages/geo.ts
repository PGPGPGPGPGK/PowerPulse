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
 * Privacy coarsening applied to every coordinate before it is shared.
 *
 * Method: snap to a fixed decimal-degree grid (3 decimal places). At the pilot
 * latitude (~17.4 N) one cell is about 111 m north-south by 106 m east-west,
 * so a stored point can sit up to ~77 m from where the device actually was.
 * That is deliberately coarser than any household and far finer than the 300 m
 * clustering radius, so grouping behaviour is unaffected.
 *
 * The result is an APPROXIMATE location. It is not, and must never be
 * described as, the device position. Snapping is idempotent, so it is safe to
 * apply again at the persistence boundary as a defensive check.
 */
export const SHARING_GRID_DECIMALS = 3;

export function coarsenForSharing(point: GeoPoint): GeoPoint {
  const factor = 10 ** SHARING_GRID_DECIMALS;
  return {
    lat: Math.round(point.lat * factor) / factor,
    lng: Math.round(point.lng * factor) / factor,
  };
}
