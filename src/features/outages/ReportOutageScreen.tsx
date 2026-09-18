import { useState } from 'react';
import { Bolt } from 'lucide-react';
import type { CommunityReasonCode, Route } from '../../types/outage';
import { useOutages } from './OutageContext';
import { AreaSelect, Card } from '../../components/ui';

/**
 * The fast path is deliberately: open this screen, press Report outage.
 * Location, street and reason are all optional detours.
 */
export function ReportOutageScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { areas, areaId, setAreaId, approxLocation, reasonOptions, submitReport } = useOutages();
  const [changingLocation, setChangingLocation] = useState(false);
  const [street, setStreet] = useState('');
  const [reasonCode, setReasonCode] = useState<CommunityReasonCode | ''>('');

  const areaName = areas.find((area) => area.id === areaId)?.name ?? '';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const { incident } = submitReport({
      areaId,
      type: 'outage',
      approxLocation,
      street: street || undefined,
      reasonCode: reasonCode || undefined,
    });
    onNavigate({ name: 'confirmation', incidentId: incident?.id ?? null });
  };

  return (
    <form className="screen" onSubmit={submit}>
      <Card title="Approximate location">
        {changingLocation ? (
          <AreaSelect areas={areas} value={areaId} onChange={setAreaId} label="Location" />
        ) : (
          <div className="locationRow">
            <p className="lead">Near {areaName}</p>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setChangingLocation(true)}
            >
              Change location
            </button>
          </div>
        )}
        <p className="note">
          Location is approximate in this prototype. PowerPulse never publicly shows your exact
          location.
        </p>
      </Card>

      <button type="submit" className="btn btn--primary btn--lg">
        <Bolt size={20} aria-hidden="true" /> Report outage
      </button>
      <p className="note note--center">The time of your report is added automatically.</p>

      <details className="optional">
        <summary>Add optional details</summary>

        <div className="field">
          <label htmlFor="street">Street / road (optional)</label>
          <input
            id="street"
            type="text"
            value={street}
            autoComplete="off"
            placeholder="e.g. Sagar Ring Road"
            onChange={(event) => setStreet(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="reason">What might have happened? (optional)</label>
          <select
            id="reason"
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value as CommunityReasonCode | '')}
          >
            <option value="">Not specified</option>
            {reasonOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="note">
            Anything you pick is shown to others as a community-reported reason, never as a
            confirmed cause.
          </p>
        </div>
      </details>
    </form>
  );
}
