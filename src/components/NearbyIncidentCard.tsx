import { ChevronRight } from 'lucide-react';
import type { Incident } from '../types/outage';
import { distanceLabel, statusPresentation, timeAgo } from '../features/outages/format';

/** Compact, tappable summary of one nearby incident, with its distance. */
export function NearbyIncidentCard({
  incident,
  distanceMeters,
  onOpen,
}: {
  incident: Incident;
  distanceMeters?: number;
  onOpen: (incident: Incident) => void;
}) {
  const place = incident.streets[0] ?? incident.areaName;

  return (
    <button type="button" className="incidentRow" onClick={() => onOpen(incident)}>
      <span className="incidentRow__main">
        <span className="incidentRow__title">
          {place}
          {distanceMeters === undefined ? '' : ` · ${distanceLabel(distanceMeters)}`}
        </span>
        <span className="incidentRow__meta">
          <span className={`dot dot--${statusPresentation[incident.status].tone}`} aria-hidden="true" />
          {statusPresentation[incident.status].label} · {incident.reporterCount}{' '}
          {incident.reporterCount === 1 ? 'report' : 'reports'} · last confirmed{' '}
          {timeAgo(incident.lastConfirmedAt)}
        </span>
      </span>
      <ChevronRight size={20} aria-hidden="true" />
    </button>
  );
}
