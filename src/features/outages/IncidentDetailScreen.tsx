import { Map as MapIcon } from 'lucide-react';
import type { Route } from '../../types/outage';
import { useOutages } from './OutageContext';
import { CommunityStatusCard } from '../../components/CommunityStatusCard';
import { OfficialInfoCard } from '../../components/OfficialInfoCard';
import { ReportActions } from '../../components/ReportActions';
import { Card, EmptyState, StatusPill } from '../../components/ui';

/** Where the detailed evidence for one incident belongs. */
export function IncidentDetailScreen({
  incidentId,
  onNavigate,
}: {
  incidentId: string;
  onNavigate: (route: Route) => void;
}) {
  const { getIncident, getMyReportState, respondToIncident, getOfficialSource, officialEvents } =
    useOutages();
  const incident = getIncident(incidentId);

  if (!incident) {
    return (
      <div className="screen">
        <Card title="Incident not found">
          <EmptyState>This incident is no longer part of the current community picture.</EmptyState>
          <button type="button" className="btn btn--ghost" onClick={() => onNavigate({ name: 'home' })}>
            Back to home
          </button>
        </Card>
      </div>
    );
  }

  // Official data keeps its own geography; it is matched by locality label
  // only, and shown separately from the community evidence.
  const areaOfficialEvents = officialEvents.filter((event) =>
    event.areaIds.includes(incident.localityId),
  );

  return (
    <div className="screen">
      <Card title={`${incident.localityLabel} · approximate location`}>
        <StatusPill status={incident.status} />
        <p className="lead">
          {incident.streets.length > 0 ? incident.streets.join(' / ') : incident.localityLabel}
        </p>
        <p className="statusCard__meta">Approx. {incident.radiusMeters} m report cluster</p>
        <p className="note">
          The approximate cluster shows where reports are coming from. It does not mean every
          property inside it is without power. Individual reports are stored only as coarsened
          points, so no exact reporter location exists to show.
        </p>
      </Card>

      <CommunityStatusCard incident={incident} localityLabel={incident.localityLabel} />

      <OfficialInfoCard events={areaOfficialEvents} getSource={getOfficialSource} />

      <button
        type="button"
        className="btn btn--ghost"
        onClick={() => onNavigate({ name: 'map', focusIncidentId: incident.id })}
      >
        <MapIcon size={18} aria-hidden="true" /> Show this area on the map
      </button>

      <ReportActions
        myState={getMyReportState(incident)}
        onReport={() => onNavigate({ name: 'report' })}
        onStillOut={() => respondToIncident(incident, 'still_out')}
        onRestored={() => respondToIncident(incident, 'restored')}
      />
    </div>
  );
}
