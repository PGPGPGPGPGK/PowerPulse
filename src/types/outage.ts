/**
 * Domain models for PowerPulse.
 *
 * Four layers are kept deliberately separate so the mock data layer can be
 * replaced by Firebase without touching the UI:
 *
 *   1. RAW INPUT ....... User, Report            - exactly what a person submitted
 *   2. DERIVED ......... Incident, CommunityReason - computed from clustered reports
 *   3. OFFICIAL ........ OfficialEvent, OfficialSource - public-source information
 *   4. UI/DISPLAY ...... Route, AreaStatusView, StatusPresentation
 *
 * Community-reported reasons (2) and official reasons (3) are never merged.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

// ------------------------------------------------------------- 1. RAW INPUT

export interface User {
  id: string;
  /** The prototype is anonymous-first; no authentication is implemented. */
  displayName?: string;
  favouriteAreaIds: string[];
  notificationsEnabled: boolean;
  createdAt: string;
}

export interface Area {
  id: string;
  name: string;
  city: 'Hyderabad';
  /** Approximate neighbourhood centre. Used for map placement and defaults. */
  center: GeoPoint;
}

export type ReportType = 'outage' | 'still_out' | 'restored';

/**
 * One contribution from one person.
 *
 * `approxLocation` is coarsened before it is stored and is the only location
 * ever kept. No exact address or device GPS fix is stored or displayed.
 */
export interface Report {
  id: string;
  userId: string;
  areaId: string;
  type: ReportType;
  approxLocation: GeoPoint;
  /** Optional. Free text, e.g. "Sagar Ring Road". */
  street?: string;
  /** Optional. A community-reported reason, never an established cause. */
  reasonCode?: CommunityReasonCode;
  createdAt: string;
  /** True for demo seed data. Reports created in-session are false. */
  isMock: boolean;
}

export type CommunityReasonCode =
  | 'transformer'
  | 'line_fault'
  | 'weather'
  | 'local_works'
  | 'street_pole'
  | 'unknown';

export interface CommunityReasonOption {
  code: CommunityReasonCode;
  label: string;
}

// --------------------------------------------------------------- 2. DERIVED

export type IncidentStatus = 'none' | 'possible' | 'confirmed' | 'restoring' | 'restored';

/** Aggregated optional reasons. A community claim, not a verified cause. */
export interface CommunityReason {
  code: CommunityReasonCode;
  label: string;
  /** Number of independent reporters who selected it. */
  reportedBy: number;
}

/**
 * Derived from a proximity cluster of reports. Never written by a client.
 *
 * `radiusMeters` (<= 500 m) describes where reports are clustered. It does not
 * claim that every property inside the circle is without power.
 */
export interface Incident {
  id: string;
  areaId: string;
  areaName: string;
  center: GeoPoint;
  radiusMeters: number;
  status: IncidentStatus;
  /** Distinct people reporting an outage. */
  reporterCount: number;
  /** "Still out" confirmations. */
  confirmationCount: number;
  /** Distinct people reporting that power is back. */
  restorationCount: number;
  firstReportedAt: string;
  lastConfirmedAt: string;
  restoredAt?: string;
  reasons: CommunityReason[];
  streets: string[];
  /** True when every contributing report is demo data. */
  isMock: boolean;
}

// -------------------------------------------------------------- 3. OFFICIAL

export interface OfficialSource {
  id: string;
  name: string;
  kind: 'utility' | 'municipal' | 'government';
  /** Placeholder reference only. No external request is ever made. */
  reference?: string;
  /** Always true in the prototype: no real source is integrated. */
  isMock: boolean;
}

export type OfficialEventKind = 'scheduled_interruption' | 'planned_works' | 'notice';

export interface OfficialEvent {
  id: string;
  sourceId: string;
  kind: OfficialEventKind;
  title: string;
  /** Stated by the source. Kept apart from community-reported reasons. */
  reason: string;
  areaIds: string[];
  center: GeoPoint;
  radiusMeters: number;
  startsAt: string;
  endsAt: string;
  publishedAt: string;
  updatedAt: string;
  isMock: boolean;
}

// ------------------------------------------------------------ 4. UI/DISPLAY

export type Route =
  | { name: 'home' }
  | { name: 'report' }
  | { name: 'confirmation'; incidentId: string | null }
  | { name: 'map' }
  | { name: 'incident'; incidentId: string }
  | { name: 'history' }
  | { name: 'profile' };

/** Everything the home screen needs for the currently selected area. */
export interface AreaStatusView {
  areaId: string;
  areaName: string;
  status: IncidentStatus;
  /** Active incident nearest the user's approximate location, if any. */
  incident: Incident | null;
  otherIncidents: Incident[];
  /** Official events for the area. Never merged into the community data. */
  officialEvents: OfficialEvent[];
}

export interface StatusPresentation {
  label: string;
  tone: 'ok' | 'warn' | 'alert' | 'restoring';
}

/** A one-tap way to jump the prototype into a given demo state. */
export interface DemoScenario {
  id: string;
  label: string;
  description: string;
  areaId: string;
}
