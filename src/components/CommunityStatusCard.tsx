import { Users } from 'lucide-react';
import type { Incident } from '../types/outage';
import { duration, timeAgo } from '../features/outages/format';
import { Card, DataList, DataRow, EmptyState } from './ui';

/**
 * Detailed community evidence. Lives on the incident detail screen, not home.
 * Never mixed with official information, and user-submitted reasons are always
 * labelled as community-reported.
 */
export function CommunityStatusCard({
  incident,
  localityLabel,
}: {
  incident: Incident | null;
  localityLabel: string;
}) {
  return (
    <Card
      variant="community"
      title={
        <>
          <Users size={18} aria-hidden="true" /> Community status
        </>
      }
    >
      {!incident ? (
        <EmptyState>
          Nobody has reported an outage around {localityLabel} in the last few hours.
        </EmptyState>
      ) : (
        <>
          <p className="lead">
            {incident.reporterCount} independent {incident.reporterCount === 1 ? 'person' : 'people'}{' '}
            reporting an outage
          </p>

          <DataList>
            <DataRow label="First report" value={timeAgo(incident.firstReportedAt)} />
            <DataRow label="Latest confirmation" value={timeAgo(incident.lastConfirmedAt)} />
            <DataRow
              label="Duration so far"
              value={duration(incident.firstReportedAt, incident.restoredAt)}
            />
            <DataRow label="Still-out confirmations" value={incident.confirmationCount} />
            <DataRow label="Power-back reports" value={incident.restorationCount} />
          </DataList>

          {incident.reasons.length > 0 ? (
            <div className="reasons">
              <h3>Community-reported reason</h3>
              <ul>
                {incident.reasons.map((reason) => (
                  <li key={reason.code}>
                    {reason.label}
                    <span className="reasons__count">
                      {reason.reportedBy} {reason.reportedBy === 1 ? 'mention' : 'mentions'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="note">
                Optional and unverified. Only some people reporting an outage add a possible reason,
                and PowerPulse does not confirm it.
              </p>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
