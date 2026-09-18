import type {
  Area,
  CommunityReasonCode,
  CommunityReasonOption,
  DemoScenario,
  Incident,
  OfficialEvent,
  OfficialSource,
  ApproximateLocation,
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
 * The read methods are synchronous on purpose: an implementation keeps an
 * in-memory view of the reports it has (seeded, or streamed from Firestore)
 * and answers from that, then calls its `subscribe` listeners when the view
 * changes. That keeps the UI free of loading states and per-call promises.
 * Writes are fire-and-forget: the new state arrives through `subscribe`.
 */

/** Raw user input for a new contribution. Nothing derived, nothing official. */
export interface NewReportInput {
  type: ReportType;
  /**
   * The location this report will be SHARED with. Callers pass an already
   * coarsened point (see `coarsenForSharing`); implementations coarsen again
   * before persisting. A precise device coordinate must never reach here.
   */
  location: ApproximateLocation;
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
  /** Which backend is answering. Used to label demo vs shared live data. */
  readonly sourceKind: 'mock' | 'firebase';

  /**
   * Called whenever the underlying data changes. Returns an unsubscribe
   * function. The mock implementation never fires.
   */
  subscribe(listener: () => void): () => void;

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

  /**
   * Official/public-source information for a locality label. Official data
   * keeps its own geography; it is never merged with community reports.
   */
  listOfficialEvents(localityId?: string): OfficialEvent[];
  getOfficialSource(sourceId: string): OfficialSource | undefined;

  /** Past community-reported incidents. */
  listHistory(): Incident[];

  /** Demo-only helpers, used by the prototype's scenario switcher. */
  listDemoScenarios(): DemoScenario[];
  resetDemoData(): void;

  submitReport(input: NewReportInput): SubmitResult;
}
