import { CheckCircle2, CircleHelp, Power, Wrench } from 'lucide-react';
import type { Incident, IncidentStatus } from '../types/outage';
import { statusPresentation, timeAgo } from '../features/outages/format';
import { StatusPill } from './ui';

const icons: Record<IncidentStatus, typeof Power> = {
  none: CheckCircle2,
  possible: CircleHelp,
  confirmed: Power,
  restoring: Wrench,
  restored: CheckCircle2,
};

/** Never claims a whole neighbourhood is affected - only "near you". */
const headline = (status: IncidentStatus): string => {
  switch (status) {
    case 'confirmed':
    case 'possible':
      return 'Power outage reported near you';
    case 'restoring':
      return 'Power may be coming back near you';
    case 'restored':
      return 'Power reported back near you';
    default:
      return 'No outage reported near you';
  }
};

/**
 * The whole answer to "is it just me?" in one card: what, how strong the
 * community signal is, and how recent. Detail lives on the incident screen.
 */
export function StatusCard({
  status,
  incident,
}: {
  status: IncidentStatus;
  incident: Incident | null;
}) {
  const Icon = icons[status];
  const tone = statusPresentation[status].tone;

  return (
    <section className={`statusCard statusCard--${tone}`} aria-live="polite">
      <div className="statusCard__head">
        <span className="statusCard__icon" aria-hidden="true">
          <Icon size={24} />
        </span>
        <StatusPill status={status} />
      </div>

      <h2>{headline(status)}</h2>

      {incident ? (
        <>
          <p className="statusCard__signal">
            {incident.reporterCount} {incident.reporterCount === 1 ? 'person' : 'people'} reporting
            within this local area
          </p>
          <p className="statusCard__meta">Last confirmed {timeAgo(incident.lastConfirmedAt)}</p>
          {incident.streets.length > 0 ? (
            <p className="statusCard__streets">{incident.streets.join(' / ')}</p>
          ) : null}
          <p className="statusCard__meta">Approx. {incident.radiusMeters} m report cluster</p>
        </>
      ) : (
        <p className="statusCard__signal">
          Nobody nearby has reported an outage in the last few hours.
        </p>
      )}
    </section>
  );
}
