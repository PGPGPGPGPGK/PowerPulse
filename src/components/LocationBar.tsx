import { Crosshair, MapPin } from 'lucide-react';
import type { Area, UserLocation } from '../types/outage';
import type { LocationPermission } from '../features/location/useUserLocation';
import { AreaSelect } from './ui';

/**
 * Where the user is reporting from, and how to change it.
 *
 * The permission request only ever happens on the button below, with the
 * reason stated next to it. A refusal is not a dead end: the locality picker
 * is always there, and a manually chosen position is always labelled
 * approximate rather than dressed up as a device fix.
 *
 * A device position shown here is local to this browser. What gets shared is a
 * coarsened point, and the copy says so.
 */
export function LocationBar({
  areas,
  location,
  permission,
  onUseDevice,
  onSelectLocality,
}: {
  areas: Area[];
  location: UserLocation;
  permission: LocationPermission;
  onUseDevice: () => void;
  onSelectLocality: (localityId: string) => void;
}) {
  const usingDevice = location.source === 'device';

  return (
    <section className="locationBar">
      <p className="locationBar__where">
        <MapPin size={16} aria-hidden="true" />
        <span>
          <strong>{location.localityLabel}</strong>{' '}
          {usingDevice ? 'from your device' : 'selected manually'}
        </span>
      </p>

      <p className="note">
        {usingDevice
          ? `Your device puts you within about ${location.accuracyMeters ?? '?'} m. That stays on this device: reports are shared at roughly 100 m precision, so nobody else can see where you actually are.`
          : 'Approximate location. Reports are shared at roughly 100 m precision and are never linked to an exact position.'}
      </p>

      {permission === 'denied' ? (
        <p className="note">
          Location permission is off, so PowerPulse is using the area you pick below. You can turn it
          back on in your browser settings.
        </p>
      ) : null}

      {permission === 'unavailable' ? (
        <p className="note">This browser could not provide a location. Pick your area below.</p>
      ) : null}

      <div className="locationBar__controls">
        {permission === 'denied' ? null : (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onUseDevice}
            disabled={permission === 'requesting'}
          >
            <Crosshair size={16} aria-hidden="true" />
            {permission === 'requesting' ? 'Finding you…' : 'Use my location'}
          </button>
        )}

        <AreaSelect
          areas={areas}
          value={location.localityId}
          onChange={onSelectLocality}
          label="Or pick an area"
        />
      </div>
    </section>
  );
}
