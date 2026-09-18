import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { Route } from '../../types/outage';
import { useOutages } from './OutageContext';
import { CommunityStatusCard } from '../../components/CommunityStatusCard';
import { Card } from '../../components/ui';

export function ReportConfirmationScreen({
  incidentId,
  onNavigate,
}: {
  incidentId: string | null;
  onNavigate: (route: Route) => void;
}) {
  const { getIncident, areaStatus, respondToIncident } = useOutages();
  const incident = (incidentId ? getIncident(incidentId) : null) ?? areaStatus.incident;

  return (
    <div className="screen">
      <section className="statusCard statusCard--ok" aria-live="polite">
        <span className="statusCard__icon" aria-hidden="true">
          <CheckCircle2 size={26} />
        </span>
        <div className="statusCard__body">
          <h2>Report received</h2>
          <p>Thanks. Your report was added to the community picture for {areaStatus.areaName}.</p>
        </div>
      </section>

      <CommunityStatusCard incident={incident} areaName={areaStatus.areaName} />

      <Card title="What happens next">
        <ol className="steps">
          <li>Your report is grouped with other nearby reports from the last few hours.</li>
          <li>
            When enough separate people report the same local area, the status becomes a
            community-confirmed outage.
          </li>
          <li>Tell us when your power returns so the status stays useful for everyone.</li>
        </ol>
        <p className="note">
          PowerPulse cannot tell you when power will be back. It only shows what residents and, in
          future, official sources report.
        </p>
      </Card>

      <div className="actions">
        <button
          type="button"
          className="btn btn--primary"
          disabled={!incident}
          onClick={() => {
            if (incident) respondToIncident(incident, 'restored');
            onNavigate({ name: 'home' });
          }}
        >
          <RotateCcw size={19} aria-hidden="true" /> My power is back
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => onNavigate({ name: 'home' })}>
          Back to home
        </button>
      </div>
    </div>
  );
}
