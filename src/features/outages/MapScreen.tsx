import { useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import { ChevronRight } from 'lucide-react';
import type { GeoPoint, Incident, Route } from '../../types/outage';
import { useOutages } from './OutageContext';
import { rankNearby } from './deriveIncidents';
import { describeIncident } from '../map/incidentLayers';
import { NearbyIncidentCard } from '../../components/NearbyIncidentCard';
import { timeAgo } from './format';
import { Card, EmptyState, StatusPill } from '../../components/ui';

/**
 * The map screen owns selection and the list; the map itself only reflects
 * them. MapLibre is fetched when this screen opens, so it never delays Home,
 * and if that fetch or the tiles fail the list below still works.
 */

interface MapCanvasProps {
  incidents: Incident[];
  viewerPoint: GeoPoint;
  selectedId?: string;
  onSelect: (incidentId: string) => void;
  onError: () => void;
}

export function MapScreen({
  focusIncidentId,
  onNavigate,
}: {
  focusIncidentId?: string;
  onNavigate: (route: Route) => void;
}) {
  const { activeIncidents, userLocation, areaStatus, getIncident } = useOutages();
  const [selectedId, setSelectedId] = useState<string | undefined>(
    focusIncidentId ?? areaStatus.incident?.id,
  );
  const [MapCanvas, setMapCanvas] = useState<ComponentType<MapCanvasProps> | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('../map/MapCanvas')
      .then((module) => {
        if (!cancelled) setMapCanvas(() => module.MapCanvas);
      })
      .catch((error) => {
        console.error('PowerPulse: map could not be loaded', error);
        if (!cancelled) setMapFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The same geographic ranking the rest of the app uses - nothing map-specific.
  const nearby = rankNearby(activeIncidents, userLocation.point);
  const focused = focusIncidentId ? getIncident(focusIncidentId) : undefined;
  const visible =
    focused && !nearby.some((entry) => entry.incident.id === focused.id)
      ? [{ incident: focused, distanceMeters: 0 }, ...nearby]
      : nearby;

  const selected = visible.find((entry) => entry.incident.id === selectedId)?.incident;

  return (
    <div className="screen">
      {mapFailed ? (
        <Card title="Map unavailable">
          <EmptyState>
            The map could not be loaded. Everything it would show is listed below as text.
          </EmptyState>
        </Card>
      ) : (
        <div className="mapFrame">
          {MapCanvas ? (
            <MapCanvas
              incidents={visible.map((entry) => entry.incident)}
              viewerPoint={userLocation.point}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onError={() => setMapFailed(true)}
            />
          ) : (
            <p className="mapCanvas mapCanvas--loading">Loading map…</p>
          )}

          <p className="note">
            © OpenStreetMap contributors. Tiles by OpenFreeMap. Circles show where reports cluster,
            not that every property inside is without power. Your own marker is visible only to you.
          </p>
        </div>
      )}

      {selected ? (
        <Card
          title={`${selected.streets[0] ?? selected.localityLabel} · near ${selected.localityLabel}`}
        >
          <StatusPill status={selected.status} />
          <p className="statusCard__meta">
            {selected.reporterCount} reporting · last confirmed {timeAgo(selected.lastConfirmedAt)} ·
            approx. {selected.radiusMeters} m cluster
          </p>
          <p className="visuallyHidden">{describeIncident(selected)}</p>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => onNavigate({ name: 'incident', incidentId: selected.id })}
          >
            View details <ChevronRight size={16} aria-hidden="true" />
          </button>
        </Card>
      ) : (
        <p className="note note--center">
          Select an area on the map, or an entry below, to see that report cluster.
        </p>
      )}

      {/* Text equivalent of the map, and the fallback when it cannot load. */}
      <Card title="Community reports near you">
        {visible.length === 0 ? (
          <EmptyState>No active community reports close to you right now.</EmptyState>
        ) : (
          <div className="incidentList">
            {visible.map((entry) => (
              <NearbyIncidentCard
                key={entry.incident.id}
                incident={entry.incident}
                distanceMeters={entry.distanceMeters}
                onOpen={(chosen) => setSelectedId(chosen.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
