import { Landmark } from 'lucide-react';
import type { OfficialEvent, OfficialEventKind, OfficialSource } from '../types/outage';
import { clockRange, timeAgo } from '../features/outages/format';
import { Card, DataList, DataRow, DemoBadge } from './ui';

const kindLabel: Record<OfficialEventKind, string> = {
  scheduled_interruption: 'Scheduled interruption',
  planned_works: 'Planned works',
  notice: 'Official notice',
};

/**
 * Official / public-source information, styled deliberately apart from
 * community reports so the two are never read as the same kind of claim. When
 * both exist for an area they are shown independently, and a scheduled
 * interruption never implies that power is currently out.
 *
 * No real utility or government source is connected: every event is fictional
 * placeholder content, marked with a small demo-source indication.
 *
 * `compact` is the home-screen form: headline facts only.
 */
export function OfficialInfoCard({
  events,
  getSource,
  compact = false,
}: {
  events: OfficialEvent[];
  getSource: (id: string) => OfficialSource | undefined;
  compact?: boolean;
}) {
  if (events.length === 0) return null;

  if (compact) {
    const event = events[0];
    return (
      <Card
        variant="official"
        title={
          <>
            <Landmark size={16} aria-hidden="true" /> {kindLabel[event.kind]} nearby
            <DemoBadge label="Demo source" />
          </>
        }
      >
        <p className="officialCompact__time">{clockRange(event.startsAt, event.endsAt)}</p>
        <p className="officialCompact__reason">{event.reason}</p>
        <p className="note">
          Source: {getSource(event.sourceId)?.name ?? 'Unknown source'}. Scheduled work does not
          confirm that power is off right now.
        </p>
      </Card>
    );
  }

  return (
    <Card
      variant="official"
      title={
        <>
          <Landmark size={18} aria-hidden="true" /> Official information
          <DemoBadge label="Demo source" />
        </>
      }
    >
      {events.map((event) => {
        const source = getSource(event.sourceId);
        return (
          <article key={event.id} className="officialEvent">
            <h3>{kindLabel[event.kind]}</h3>
            <p className="lead">{event.title}</p>
            <DataList>
              <DataRow label="Time" value={clockRange(event.startsAt, event.endsAt)} />
              <DataRow label="Reason given" value={event.reason} />
              <DataRow label="Source" value={source?.name ?? 'Unknown source'} />
              {source?.reference ? <DataRow label="Reference" value={source.reference} /> : null}
              <DataRow label="Published" value={timeAgo(event.publishedAt)} />
              <DataRow label="Updated" value={timeAgo(event.updatedAt)} />
            </DataList>
          </article>
        );
      })}

      <p className="note">
        Placeholder content. No utility or government source is connected yet, and scheduled work
        does not confirm that power is currently off.
      </p>
    </Card>
  );
}
