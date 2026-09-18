import type { CommunityReason, GeoPoint, Incident, NearbyIncident, Report } from '../../types/outage';
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
/** Reports older than this stop driving the live status. */
export const ACTIVE_WINDOW_HOURS = 6;
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

function buildIncident(cluster: Report[], labelFor: LocalityLabeller): Incident {
  const sorted = [...cluster].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const outages = sorted.filter((r) => r.type === 'outage');
  const stillOut = sorted.filter((r) => r.type === 'still_out');
  const restorations = sorted.filter((r) => r.type === 'restored');

  const center = centroid(sorted.map((r) => r.location));
  const spread = Math.max(...sorted.map((r) => distanceMeters(center, r.location)));
  const radiusMeters = Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(spread + 100)));

  const reporterCount = distinctUsers(outages);
  const restorationCount = distinctUsers(restorations);

  let status: Incident['status'];
  if (restorationCount >= RESTORE_THRESHOLD && restorationCount * 2 >= reporterCount) {
    status = 'restored';
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

  const lastConfirmed = [...outages, ...stillOut].pop() ?? sorted[0];
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
    lastConfirmedAt: lastConfirmed.createdAt,
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
    .map((cluster) => buildIncident(cluster, labelFor))
    .sort((a, b) => b.lastConfirmedAt.localeCompare(a.lastConfirmedAt));
}

/** Incidents still worth showing as live status. */
export function isActive(incident: Incident, now = Date.now()): boolean {
  if (incident.status === 'restored') return false;
  const age = now - new Date(incident.lastConfirmedAt).getTime();
  return age <= ACTIVE_WINDOW_HOURS * 3_600_000;
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
