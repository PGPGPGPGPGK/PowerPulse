import type {
  Area,
  CommunityReasonCode,
  CommunityReasonOption,
  DemoScenario,
  GeoPoint,
  Incident,
  OfficialEvent,
  OfficialSource,
  Report,
  ReportType,
  User,
} from '../types/outage';

/**
 * The boundary between the UI and wherever outage data actually lives.
 *
 * Screens and components talk to this interface only (through
 * `features/outages/OutageContext`), never to `data/mockData`. Swapping the
 * mock implementation for Firestore means writing one new class here.
 *
 * ponytail: the methods are synchronous because the prototype's data is
 * in-memory. A Firebase implementation will be async - only OutageContext
 * calls the repository, so that migration touches one file.
 */

/** Raw user input for a new contribution. Nothing derived, nothing official. */
export interface NewReportInput {
  areaId: string;
  type: ReportType;
  /** Approximate location. Exact addresses are never captured or stored. */
  approxLocation: GeoPoint;
  /** Optional. */
  street?: string;
  /** Optional community-reported reason. */
  reasonCode?: CommunityReasonCode;
}

/** What the current user has most recently told us about one incident. */
export type MyReportState = 'none' | 'reported' | 'restored';

export interface SubmitResult {
  report: Report;
  /** The incident this report landed in, if it joined or formed one. */
  incident: Incident | null;
}

export interface OutageRepository {
  listAreas(): Area[];
  getArea(areaId: string): Area;
  listReasonOptions(): CommunityReasonOption[];
  getCurrentUser(): User;

  /** Derived from the stored reports. */
  listIncidents(): Incident[];
  /** Derived incidents that are still live. */
  listActiveIncidents(): Incident[];
  getIncident(incidentId: string): Incident | undefined;
  /** The current user's own latest contribution to an incident, if any. */
  getMyReportState(incident: Incident): MyReportState;

  /** Official/public-source information. Never merged with community data. */
  listOfficialEvents(areaId?: string): OfficialEvent[];
  getOfficialSource(sourceId: string): OfficialSource | undefined;

  /** Past community-reported incidents. */
  listHistory(): Incident[];

  /** Demo-only helpers, used by the prototype's scenario switcher. */
  listDemoScenarios(): DemoScenario[];
  resetDemoData(): void;

  submitReport(input: NewReportInput): SubmitResult;
}
