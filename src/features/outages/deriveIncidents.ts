import type { CommunityReason, Incident, Report } from '../../types/outage';
import { reasonLabel } from '../../data/reasons.ts';
import { centroid, distanceMeters } from './geo.ts';

/**
 * Turns raw reports into derived incidents.
 *
 * An incident is a *local* cluster of reports, not a neighbourhood: reports
 * join a cluster only while they sit within CLUSTER_RADIUS_M of it, and the
 * drawn radius is capped at MAX_RADIUS_M. Kothapet can therefore hold several
 * independent incidents at once.
 *
 * Thresholds are pilot parameters, not utility truth - tune them with real data.
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
/** How far "nearby" reaches on the home screen. Display parameter, tunable. */
export const NEARBY_RADIUS_M = 5_000;

const distinctUsers = (reports: Report[]) => new Set(reports.map((r) => r.userId)).size;

function buildIncident(cluster: Report[], areaName: string): Incident {
  const sorted = [...cluster].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const outages = sorted.filter((r) => r.type === 'outage');
  const stillOut = sorted.filter((r) => r.type === 'still_out');
  const restorations = sorted.filter((r) => r.type === 'restored');

  const center = centroid(sorted.map((r) => r.approxLocation));
  const spread = Math.max(...sorted.map((r) => distanceMeters(center, r.approxLocation)));
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

  return {
    id: `incident-${sorted[0].id}`,
    areaId: sorted[0].areaId,
    areaName,
    center,
    radiusMeters,
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

/** Greedy proximity clustering. Reports are grouped per area, then by distance. */
export function deriveIncidents(reports: Report[], areaName: (id: string) => string): Incident[] {
  const byArea = new Map<string, Report[]>();
  for (const report of reports) {
    const bucket = byArea.get(report.areaId) ?? [];
    bucket.push(report);
    byArea.set(report.areaId, bucket);
  }

  const incidents: Incident[] = [];
  for (const [areaId, areaReports] of byArea) {
    const ordered = [...areaReports].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const clusters: Report[][] = [];

    for (const report of ordered) {
      const match = clusters.find(
        (cluster) =>
          distanceMeters(centroid(cluster.map((r) => r.approxLocation)), report.approxLocation) <=
          CLUSTER_RADIUS_M,
      );
      if (match) match.push(report);
      else clusters.push([report]);
    }

    clusters.forEach((cluster) => incidents.push(buildIncident(cluster, areaName(areaId))));
  }

  return incidents.sort((a, b) => b.lastConfirmedAt.localeCompare(a.lastConfirmedAt));
}

/** Incidents still worth showing as live status. */
export function isActive(incident: Incident, now = Date.now()): boolean {
  if (incident.status === 'restored') return false;
  const age = now - new Date(incident.lastConfirmedAt).getTime();
  return age <= ACTIVE_WINDOW_HOURS * 3_600_000;
}
