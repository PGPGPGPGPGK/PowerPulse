import { useState } from 'react';
import type { GeoPoint, LocationSource, UserLocation } from '../../types/outage';
import { nearestArea } from '../../data/areas';

/**
 * The person's own location.
 *
 * Browser geolocation is requested only when the user asks for it, never on
 * startup, and the app stays fully usable when it is refused: a manually
 * chosen pilot locality is always available as a fallback. A manual position
 * is always tagged `manual`, so it can never be presented as a device fix.
 */

export type LocationPermission =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unavailable';

/** Attaches the nearest locality label to a raw point. */
export function toUserLocation(
  point: GeoPoint,
  source: LocationSource,
  accuracyMeters?: number,
): UserLocation {
  const area = nearestArea(point);
  return {
    point,
    accuracyMeters,
    source,
    localityId: area.id,
    localityLabel: area.name,
  };
}

export interface UserLocationState {
  location: UserLocation;
  permission: LocationPermission;
  /** Asks the browser for a position. Call only from a user action. */
  requestDeviceLocation: () => void;
  /** Manual fallback: any point, always recorded as approximate. */
  setManualLocation: (point: GeoPoint) => void;
}

export function useUserLocation(initial: UserLocation): UserLocationState {
  const [location, setLocation] = useState<UserLocation>(initial);
  const [permission, setPermission] = useState<LocationPermission>('idle');

  const requestDeviceLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setPermission('unavailable');
      return;
    }

    setPermission('requesting');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(
          toUserLocation(
            { lat: position.coords.latitude, lng: position.coords.longitude },
            'device',
            Math.round(position.coords.accuracy),
          ),
        );
        setPermission('granted');
      },
      (error) => {
        // No fabricated coordinates: the manual location simply stays in use.
        setPermission(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const setManualLocation = (point: GeoPoint) => {
    setLocation(toUserLocation(point, 'manual'));
    setPermission((current) => (current === 'granted' ? 'idle' : current));
  };

  return { location, permission, requestDeviceLocation, setManualLocation };
}
