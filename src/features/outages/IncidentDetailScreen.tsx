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

  const areaOfficialEvents = officialEvents.filter((event) =>
    event.areaIds.includes(incident.areaId),
  );

  return (
    <div className="screen">
      <Card title={`${incident.areaName} · approximate location`}>
        <StatusPill status={incident.status} />
        <p className="lead">
          {incident.streets.length > 0 ? incident.streets.join(' / ') : incident.areaName}
        </p>
        <p className="statusCard__meta">Approx. {incident.radiusMeters} m report cluster</p>
        <p className="note">
          The approximate cluster shows where reports are coming from. It does not mean every
          property inside it is without power, and no exact reporter location is ever shown.
        </p>
      </Card>

      <CommunityStatusCard incident={incident} areaName={incident.areaName} />

      <OfficialInfoCard events={areaOfficialEvents} getSource={getOfficialSource} />

      <ReportActions
        myState={getMyReportState(incident)}
        onReport={() => onNavigate({ name: 'report' })}
        onStillOut={() => respondToIncident(incident, 'still_out')}
        onRestored={() => respondToIncident(incident, 'restored')}
      />
    </div>
  );
}
