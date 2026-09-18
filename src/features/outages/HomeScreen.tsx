import { ChevronRight, Map } from 'lucide-react';
import type { Route } from '../../types/outage';
import { useOutages } from './OutageContext';
import { StatusCard } from '../../components/StatusCard';
import { ReportActions } from '../../components/ReportActions';
import { OfficialInfoCard } from '../../components/OfficialInfoCard';
import { NearbyIncidentCard } from '../../components/NearbyIncidentCard';
import { AreaSelect, EmptyState } from '../../components/ui';

/**
 * Home answers four things and nothing more: is there an outage near me, how
 * strong is the community signal, how recent is it, and what can I do?
 * Evidence and diagnostics live on the incident detail screen.
 */
export function HomeScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const {
    areas,
    areaId,
    setAreaId,
    areaStatus,
    nearbyIncidents,
    getMyReportState,
    respondToIncident,
    getOfficialSource,
  } = useOutages();

  const { incident, officialEvents } = areaStatus;
  const myState = incident ? getMyReportState(incident) : 'none';

  return (
    <div className="screen">
      <AreaSelect areas={areas} value={areaId} onChange={setAreaId} />

      <StatusCard status={areaStatus.status} incident={incident} />

      <ReportActions
        myState={myState}
        onReport={() => onNavigate({ name: 'report' })}
        onStillOut={() => incident && respondToIncident(incident, 'still_out')}
        onRestored={() => incident && respondToIncident(incident, 'restored')}
      />

      {incident ? (
        <button
          type="button"
          className="linkRow"
          onClick={() => onNavigate({ name: 'incident', incidentId: incident.id })}
        >
          <span>
            <strong>Affected area</strong> · Approx. {incident.radiusMeters} m report cluster
          </span>
          <span className="linkRow__cta">
            View details <ChevronRight size={16} aria-hidden="true" />
          </span>
        </button>
      ) : null}

      <OfficialInfoCard events={officialEvents} getSource={getOfficialSource} compact />

      <section className="nearby">
        <h2 className="nearby__title">Nearby</h2>
        {nearbyIncidents.length === 0 ? (
          <EmptyState>No other community reports close to you right now.</EmptyState>
        ) : (
          <div className="incidentList">
            {nearbyIncidents.map((entry) => (
              <NearbyIncidentCard
                key={entry.incident.id}
                incident={entry.incident}
                distanceMeters={entry.distanceMeters}
                onOpen={(selected) => onNavigate({ name: 'incident', incidentId: selected.id })}
              />
            ))}
          </div>
        )}
        <button type="button" className="btn btn--ghost" onClick={() => onNavigate({ name: 'map' })}>
          <Map size={18} aria-hidden="true" /> View Hyderabad map
        </button>
      </section>
    </div>
  );
}
