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
import { areaById, pilotAreas } from '../data/areas';
import { communityReasons } from '../data/reasons';
import {
  demoScenarios,
  demoUser,
  historyIncidents,
  officialEvents,
  officialSources,
  seedReports,
} from '../data/mockData';
import { deriveIncidents, isActive } from '../features/outages/deriveIncidents';
import { coarsen, distanceMeters } from '../features/outages/geo';

/**
 * In-memory implementation backed by the demo dataset.
 *
 * This is the file Firebase replaces. It is the only place that imports
 * `data/mockData`.
 */
class MockOutageRepository implements OutageRepository {
  private reports: Report[] = [...seedReports];

  private cache: { source: Report[]; incidents: Incident[] } | null = null;

  private nextId = 0;

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
    if (this.cache?.source !== this.reports) {
      this.cache = {
        source: this.reports,
        incidents: deriveIncidents(this.reports, (id) => areaById(id).name),
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
    const mine = this.reports
      .filter(
        (report) =>
          report.userId === demoUser.id &&
          report.areaId === incident.areaId &&
          distanceMeters(incident.center, report.approxLocation) <= incident.radiusMeters,
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const latest = mine[mine.length - 1];
    if (!latest) return 'none';
    return latest.type === 'restored' ? 'restored' : 'reported';
  }

  listOfficialEvents(areaId?: string): OfficialEvent[] {
    if (!areaId) return officialEvents;
    return officialEvents.filter((event) => event.areaIds.includes(areaId));
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
      areaId: input.areaId,
      type: input.type,
      // Coarsened here so no precise position can reach storage or the UI.
      approxLocation: coarsen(input.approxLocation),
      street: input.street?.trim() || undefined,
      reasonCode: input.reasonCode,
      createdAt: new Date().toISOString(),
      isMock: false,
    };

    this.reports = [...this.reports, report];

    const incident =
      this.listIncidents().find(
        (candidate) =>
          candidate.areaId === report.areaId &&
          distanceMeters(candidate.center, report.approxLocation) <= candidate.radiusMeters,
      ) ?? null;

    return { report, incident };
  }
}

export const mockOutageRepository: OutageRepository = new MockOutageRepository();
