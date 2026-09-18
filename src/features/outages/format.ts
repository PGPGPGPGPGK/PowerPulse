import type { IncidentStatus } from '../../types/outage';
import type { StatusPresentation } from '../../types/outage';

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "18 min ago" style label for an ISO timestamp. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diffMinutes = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (Math.abs(diffMinutes) < 60) return relative.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return relative.format(diffHours, 'hour');
  return relative.format(Math.round(diffHours / 24), 'day');
}

/** Human duration between two timestamps, e.g. "1 h 35 min". */
export function duration(fromIso: string, toIso: string = new Date().toISOString()): string {
  const minutes = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

export function clockRange(startIso: string, endIso: string): string {
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return `${time(startIso)} – ${time(endIso)}`;
}

/** Rounded, human distance: "650 m" or "1.2 km". */
export function distanceLabel(meters: number): string {
  if (meters < 1000) return `${Math.max(50, Math.round(meters / 50) * 50)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export const statusPresentation: Record<IncidentStatus, StatusPresentation> = {
  none: { label: 'No outage reported', tone: 'ok' },
  possible: { label: 'Possible outage', tone: 'warn' },
  confirmed: { label: 'Community-confirmed outage', tone: 'alert' },
  restoring: { label: 'Possible restoration', tone: 'restoring' },
  restored: { label: 'Power reported back', tone: 'ok' },
};
