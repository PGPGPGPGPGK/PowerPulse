import type { ReactNode } from 'react';
import type { Area, IncidentStatus } from '../types/outage';
import { statusPresentation } from '../features/outages/format';

/** Small shared building blocks. Presentational only, no data access. */

export function Card({
  title,
  children,
  variant = 'default',
}: {
  title?: ReactNode;
  children: ReactNode;
  variant?: 'default' | 'official' | 'community';
}) {
  return (
    <section className={`card card--${variant}`}>
      {title ? <h2 className="card__title">{title}</h2> : null}
      {children}
    </section>
  );
}

export function StatusPill({ status }: { status: IncidentStatus }) {
  const { label, tone } = statusPresentation[status];
  return <span className={`pill pill--${tone}`}>{label}</span>;
}

/** Marks every piece of simulated information in the prototype. */
export function DemoBadge({ label = 'Demo data' }: { label?: string }) {
  return (
    <span className="pill pill--demo" title="Simulated data for prototype testing only">
      {label}
    </span>
  );
}

export function DataList({ children }: { children: ReactNode }) {
  return <dl className="dataList">{children}</dl>;
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="dataRow">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function AreaSelect({
  areas,
  value,
  onChange,
  id = 'area',
  label = 'Your area',
}: {
  areas: Area[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
  label?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {areas.map((area) => (
          <option key={area.id} value={area.id}>
            {area.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
