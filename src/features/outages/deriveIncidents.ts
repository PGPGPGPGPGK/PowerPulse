import type {
  CommunityReason,
  GeoPoint,
  Incident,
  NearbyIncident,
  Report,
} from '../../types/outage';
import type { MyReportState } from '../../services/outageRepository';
import { reasonLabel } from '../../data/reasons.ts';
import { centroid, distanceMeters } from './geo.ts';

/**
 * Turns raw reports into derived incidents.
 *
 * Clustering is purely geographic. A report joins a cluster when it is within
 * CLUSTER_RADIUS_M of that cluster's centroid, whatever locality either sits
 * in - two reports 100 m apart on opposite sides of a locality boundary form
 * one incident. Localities are attached afterwards, as labels only.
 *
 * Every threshold below is a PILOT HYPOTHESIS to tune with real data, not
 * utility truth.
 */
export const CLUSTER_RADIUS_M = 300;
export const MAX_RADIUS_M = 500;
export const MIN_RADIUS_M = 120;
/** Distinct reporters needed before a community incident counts as confirmed. */
export const CONFIRM_THRESHOLD = 3;
/** Distinct restoration reporters needed before an incident reads as restored. */
export const RESTORE_THRESHOLD = 2;
/**
 * How long an incident keeps being shown as active without a fresh outage or
 * still-out observation. Past this it goes quiet - which is not a restoration.
 */
export const ACTIVE_WINDOW_HOURS = 6;
/**
 * How long one person's own observation stays fresh before they are asked to
 * reconfirm. Their answer restarts the clock.
 */
export const RECONFIRM_AFTER_HOURS = 2;
/**
 * How often an open app re-evaluates time-dependent state, so a reconfirmation
 * prompt appears and an incident goes quiet without anyone touching the screen.
 * Purely local arithmetic: no query, no write, no billing.
 */
export const LIFECYCLE_TICK_MS = 60_000;
/**
 * Hard bound on how far back clustering ever looks. Without it the cost of
 * derivation would grow with the whole history of the database.
 */
export const DERIVATION_WINDOW_HOURS = 24;
/** How far "nearby" reaches. Display parameter, tunable. */
export const NEARBY_RADIUS_M = 5_000;
/** How close an incident must be to count as "at my location". */
export const AT_MY_LOCATION_RADIUS_M = 600;

/** Resolves the locality label for a point. Labelling only, never grouping. */
export type LocalityLabeller = (point: GeoPoint) => { id: string; label: string };

const distinctUsers = (reports: Report[]) => new Set(reports.map((r) => r.userId)).size;

const hoursSince = (iso: string, now: number) => (now - new Date(iso).getTime()) / 3_600_000;

function buildIncident(cluster: Report[], labelFor: LocalityLabeller, now: number): Incident {
  const sorted = [...cluster].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const outages = sorted.filter((r) => r.type === 'outage');
  const stillOut = sorted.filter((r) => r.type === 'still_out');
  const restorations = sorted.filter((r) => r.type === 'restored');

  const center = centroid(sorted.map((r) => r.location));
  const spread = Math.max(...sorted.map((r) => distanceMeters(center, r.location)));
  const radiusMeters = Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(spread + 100)));

  const reporterCount = distinctUsers(outages);
  const restorationCount = distinctUsers(restorations);

  // Every piece of evidence that the power is still out, oldest first.
  const outageSignals = [...outages, ...stillOut].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  const lastSignal = outageSignals[outageSignals.length - 1];
  const wentQuiet = !lastSignal || hoursSince(lastSignal.createdAt, now) > ACTIVE_WINDOW_HOURS;

  let status: Incident['status'];
  if (restorationCount >= RESTORE_THRESHOLD && restorationCount * 2 >= reporterCount) {
    // Explicit restoration always wins: people said the power came back.
    status = 'restored';
  } else if (wentQuiet) {
    // Nobody has confirmed it recently. That is silence, not restoration.
    status = 'inactive';
  } else if (restorationCount > 0) {
    status = 'restoring';
  } else if (reporterCount >= CONFIRM_THRESHOLD) {
    status = 'confirmed';
  } else {
    status = 'possible';
  }

  const reasonCounts = new Map<string, number>();
  outages.forEach((report) => {
    if (report.reasonCode) {
      reasonCounts.set(report.reasonCode, (reasonCounts.get(report.reasonCode) ?? 0) + 1);
    }
  });
  const reasons: CommunityReason[] = [...reasonCounts.entries()]
    .map(([code, reportedBy]) => ({
      code: code as CommunityReason['code'],
      label: reasonLabel(code as CommunityReason['code']),
      reportedBy,
    }))
    .sort((a, b) => b.reportedBy - a.reportedBy);

  const locality = labelFor(center);

  return {
    id: `incident-${sorted[0].id}`,
    publicCenter: center,
    radiusMeters,
    localityId: locality.id,
    localityLabel: locality.label,
    status,
    reporterCount,
    confirmationCount: stillOut.length,
    restorationCount,
    firstReportedAt: (outages[0] ?? sorted[0]).createdAt,
    lastConfirmedAt: (lastSignal ?? sorted[0]).createdAt,
    restoredAt: status === 'restored' ? restorations[restorations.length - 1].createdAt : undefined,
    reasons,
    streets: [...new Set(sorted.map((r) => r.street).filter(Boolean) as string[])],
    isMock: sorted.every((r) => r.isMock),
  };
}

/**
 * Greedy proximity clustering over every report in the derivation window.
 * No locality, area or other administrative key takes part.
 */
export function deriveIncidents(
  reports: Report[],
  labelFor: LocalityLabeller,
  now = Date.now(),
): Incident[] {
  const cutoff = now - DERIVATION_WINDOW_HOURS * 3_600_000;
  const ordered = reports
    .filter((report) => new Date(report.createdAt).getTime() >= cutoff)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const clusters: Report[][] = [];
  for (const report of ordered) {
    const match = clusters.find(
      (cluster) =>
        distanceMeters(centroid(cluster.map((r) => r.location)), report.location) <=
        CLUSTER_RADIUS_M,
    );
    if (match) match.push(report);
    else clusters.push([report]);
  }

  return clusters
    .map((cluster) => buildIncident(cluster, labelFor, now))
    .sort((a, b) => b.lastConfirmedAt.localeCompare(a.lastConfirmedAt));
}

/**
 * Incidents still worth showing as live status: neither reported restored nor
 * gone quiet. Staleness is already decided in the derivation, so this stays a
 * simple read of the status.
 */
export function isActive(incident: Incident): boolean {
  return incident.status !== 'restored' && incident.status !== 'inactive';
}

/**
 * Whether this person's own contribution to an incident has gone stale.
 *
 * Takes that user's own reports for the incident, newest last. Anything they
 * say restarts their two-hour clock; saying the power is back retires them
 * from the prompt entirely.
 */
export function deriveMyReportState(
  myReports: Report[],
  now = Date.now(),
): MyReportState {
  const ordered = [...myReports].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const latest = ordered[ordered.length - 1];
  if (!latest) return 'none';
  if (latest.type === 'restored') return 'restored';
  return hoursSince(latest.createdAt, now) >= RECONFIRM_AFTER_HOURS ? 'due' : 'reported';
}

/** Nearest first, within NEARBY_RADIUS_M of the given point. */
export function rankNearby(
  incidents: Incident[],
  from: GeoPoint,
  options: { limit?: number; radiusMeters?: number } = {},
): NearbyIncident[] {
  const { limit = Infinity, radiusMeters = NEARBY_RADIUS_M } = options;
  return incidents
    .map((incident) => ({
      incident,
      distanceMeters: distanceMeters(incident.publicCenter, from),
    }))
    .filter((entry) => entry.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

/** The incident the user is standing in, if any. */
export function incidentAtLocation(incidents: Incident[], from: GeoPoint): Incident | null {
  const [closest] = rankNearby(incidents, from, {
    limit: 1,
    radiusMeters: AT_MY_LOCATION_RADIUS_M,
  });
  return closest?.incident ?? null;
}
