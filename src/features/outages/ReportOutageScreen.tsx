import { useState } from 'react';
import { Bolt, Crosshair } from 'lucide-react';
import type { CommunityReasonCode, Route } from '../../types/outage';
import { useOutages } from './OutageContext';
import { AreaSelect, Card } from '../../components/ui';

/**
 * The fast path is deliberately: open this screen, press Report outage.
 * Location, street and reason are all optional detours.
 */
export function ReportOutageScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const {
    areas,
    userLocation,
    locationPermission,
    requestDeviceLocation,
    selectLocality,
    reasonOptions,
    submitReport,
    requireLegalAcknowledgement,
  } = useOutages();
  const [changingLocation, setChangingLocation] = useState(false);
  const [street, setStreet] = useState('');
  const [reasonCode, setReasonCode] = useState<CommunityReasonCode | ''>('');

  const usingDevice = userLocation.source === 'device';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    // Nothing is written until the acknowledgement has been given.
    requireLegalAcknowledgement(() => {
      const { incident } = submitReport({
        type: 'outage',
        street: street || undefined,
        reasonCode: reasonCode || undefined,
      });
      onNavigate({ name: 'confirmation', incidentId: incident?.id ?? null });
    });
  };

  return (
    <form className="screen" onSubmit={submit}>
      <Card title="Approximate location">
        {changingLocation ? (
          <>
            <AreaSelect
              areas={areas}
              value={userLocation.localityId}
              onChange={selectLocality}
              label="Area"
            />
            {locationPermission === 'denied' || locationPermission === 'unavailable' ? null : (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={requestDeviceLocation}
                disabled={locationPermission === 'requesting'}
              >
                <Crosshair size={16} aria-hidden="true" />
                {locationPermission === 'requesting' ? 'Finding you…' : 'Use my location instead'}
              </button>
            )}
          </>
        ) : (
          <div className="locationRow">
            <p className="lead">
              {usingDevice ? 'Near you' : `Near ${userLocation.localityLabel}`}
            </p>
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
          {usingDevice
            ? `Your device puts you within about ${userLocation.accuracyMeters ?? '?'} m, but only a coarsened point (roughly 100 m) is saved with your report. PowerPulse never stores or shows your exact location.`
            : 'Location is approximate in this prototype. Only a coarsened point is saved with your report - never your exact location.'}
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
