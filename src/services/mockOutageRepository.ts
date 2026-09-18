import type {
  Area,
  CommunityReasonOption,
  DemoScenario,
  Incident,
  OfficialEvent,
  OfficialSource,
  Report,
  User,
} from '../types/outage';
import type {
  MyReportState,
  NewReportInput,
  OutageRepository,
  SubmitResult,
} from './outageRepository';
import { areaById, localityFor, pilotAreas } from '../data/areas';
import { communityReasons } from '../data/reasons';
import {
  demoScenarios,
  demoUser,
  historyIncidents,
  officialEvents,
  officialSources,
  seedReports,
} from '../data/mockData';
import { deriveIncidents, deriveMyReportState, isActive } from '../features/outages/deriveIncidents';
import { coarsenForSharing, distanceMeters } from '../features/outages/geo';

/**
 * In-memory implementation backed by the demo dataset.
 *
 * This is the file Firebase replaces. It is the only place that imports
 * `data/mockData`.
 */
/**
 * Derived incidents are re-computed at least this often, so an incident that
 * quietly ages past the active window updates without new reports arriving.
 */
const CACHE_TTL_MS = 30_000;

class MockOutageRepository implements OutageRepository {
  readonly sourceKind = 'mock' as const;

  private reports: Report[] = [...seedReports];

  private cache: { source: Report[]; derivedAt: number; incidents: Incident[] } | null = null;

  private nextId = 0;

  /** Local data never changes underneath the UI, so nothing to notify. */
  subscribe(): () => void {
    return () => {};
  }

  listAreas(): Area[] {
    return pilotAreas;
  }

  getArea(areaId: string): Area {
    return areaById(areaId);
  }

  listReasonOptions(): CommunityReasonOption[] {
    return communityReasons;
  }

  getCurrentUser(): User {
    return demoUser;
  }

  listIncidents(): Incident[] {
    // Statuses age, so the cache expires on time as well as on new reports.
    const stale = !this.cache || Date.now() - this.cache.derivedAt > CACHE_TTL_MS;
    if (stale || this.cache?.source !== this.reports) {
      this.cache = {
        source: this.reports,
        derivedAt: Date.now(),
        incidents: deriveIncidents(this.reports, localityFor),
      };
    }
    return this.cache.incidents;
  }

  listActiveIncidents(): Incident[] {
    return this.listIncidents().filter((incident) => isActive(incident));
  }

  getIncident(incidentId: string): Incident | undefined {
    return (
      this.listIncidents().find((incident) => incident.id === incidentId) ??
      historyIncidents.find((incident) => incident.id === incidentId)
    );
  }

  getMyReportState(incident: Incident): MyReportState {
    // Same predicate submitReport uses to attach a report to a cluster.
    const mine = this.reports.filter(
      (report) =>
        report.userId === demoUser.id &&
        distanceMeters(incident.publicCenter, report.location) <= incident.radiusMeters,
    );
    return deriveMyReportState(mine);
  }

  listOfficialEvents(localityId?: string): OfficialEvent[] {
    if (!localityId) return officialEvents;
    return officialEvents.filter((event) => event.areaIds.includes(localityId));
  }

  getOfficialSource(sourceId: string): OfficialSource | undefined {
    return officialSources.find((source) => source.id === sourceId);
  }

  listHistory(): Incident[] {
    return historyIncidents;
  }

  listDemoScenarios(): DemoScenario[] {
    return demoScenarios;
  }

  resetDemoData(): void {
    this.reports = [...seedReports];
  }

  submitReport(input: NewReportInput): SubmitResult {
    const report: Report = {
      id: `local-${this.nextId++}`,
      userId: demoUser.id,
      type: input.type,
      // Same boundary as the shared repository: stored points are approximate.
      location: coarsenForSharing(input.location),
      street: input.street?.trim() || undefined,
      reasonCode: input.reasonCode,
      createdAt: new Date().toISOString(),
      isMock: false,
    };

    this.reports = [...this.reports, report];

    const incident =
      this.listIncidents().find(
        (candidate) =>
          distanceMeters(candidate.publicCenter, report.location) <= candidate.radiusMeters,
      ) ?? null;

    return { report, incident };
  }
}

export const mockOutageRepository: OutageRepository = new MockOutageRepository();
