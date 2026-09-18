import type { Route } from '../../types/outage';
import { useOutages } from './OutageContext';
import { duration, timeAgo } from './format';
import { Card, DataList, DataRow, EmptyState } from '../../components/ui';

export function HistoryScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { history } = useOutages();

  return (
    <div className="screen">
      <Card title="Past community reports">
        <p className="note">
          PowerPulse community data only. These are incidents residents reported, not utility
          records.
        </p>
      </Card>

      {history.length === 0 ? (
        <Card>
          <EmptyState>No past community-reported incidents yet.</EmptyState>
        </Card>
      ) : (
        history.map((incident) => (
          <Card key={incident.id} title={`${incident.localityLabel} · ${incident.streets[0] ?? 'Area'}`}>
            <DataList>
              <DataRow label="Started" value={timeAgo(incident.firstReportedAt)} />
              <DataRow
                label="Duration"
                value={duration(incident.firstReportedAt, incident.restoredAt)}
              />
              <DataRow label="People reporting" value={incident.reporterCount} />
              <DataRow label="Still-out confirmations" value={incident.confirmationCount} />
              <DataRow label="Power-back reports" value={incident.restorationCount} />
              {incident.reasons.length > 0 ? (
                <DataRow
                  label="Community-reported reason"
                  value={incident.reasons.map((reason) => reason.label).join(', ')}
                />
              ) : null}
            </DataList>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onNavigate({ name: 'incident', incidentId: incident.id })}
            >
              View details
            </button>
          </Card>
        ))
      )}
    </div>
  );
}
