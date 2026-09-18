import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Route } from '../../types/outage';
import { useOutages } from './OutageContext';
import { IncidentMap } from '../../components/IncidentMap';
import { NearbyIncidentCard } from '../../components/NearbyIncidentCard';
import { timeAgo } from './format';
import { Card, EmptyState, StatusPill } from '../../components/ui';

export function MapScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { areas, activeIncidents, officialEvents, userLocation, areaStatus } = useOutages();
  const [selectedId, setSelectedId] = useState<string | undefined>(areaStatus.incident?.id);

  const selected = activeIncidents.find((incident) => incident.id === selectedId);

  return (
    <div className="screen">
      <IncidentMap
        areas={areas}
        incidents={activeIncidents}
        officialEvents={officialEvents}
        viewerPoint={userLocation.point}
        selectedIncidentId={selectedId}
        onSelectIncident={(incident) => setSelectedId(incident.id)}
      />

      {selected ? (
        <Card title={`${selected.streets[0] ?? selected.localityLabel} · near ${selected.localityLabel}`}>
          <StatusPill status={selected.status} />
          <p className="statusCard__meta">
            {selected.reporterCount} reporting · last confirmed {timeAgo(selected.lastConfirmedAt)} ·
            approx. {selected.radiusMeters} m cluster
          </p>
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
          Select a circle on the map to see a summary of that report cluster.
        </p>
      )}

      {/* Text equivalent of the map, so the data is reachable without it. */}
      <Card title="Active community reports">
        {activeIncidents.length === 0 ? (
          <EmptyState>No active community reports in the pilot areas right now.</EmptyState>
        ) : (
          <div className="incidentList">
            {activeIncidents.map((incident) => (
              <NearbyIncidentCard
                key={incident.id}
                incident={incident}
                onOpen={(chosen) => setSelectedId(chosen.id)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
