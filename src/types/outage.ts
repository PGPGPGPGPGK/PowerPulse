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
 *
 * Location has two distinct kinds, which must not be confused:
 *
 *   - LOCAL ONLY: `UserLocation` may be a precise device fix. It stays in this
 *     browser, is shown only to the person it belongs to, and is never stored
 *     or shared.
 *   - SHARED:  `ApproximateLocation` is what a report actually carries. It is
 *     grid-snapped (~111 x 106 m) before it leaves the device, so no other
 *     client ever receives a precise position.
 *   - PUBLIC:  `Incident.publicCenter` + `radiusMeters` describe where a group
 *     of approximate reports clusters. This is the only location the UI shows.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Where a position came from. Manual positions are never called device-derived. */
export type LocationSource = 'device' | 'manual';

/**
 * SHARED. A coordinate that has been coarsened for sharing (see
 * `coarsenForSharing`). Deliberately approximate: it is never the device
 * position, and it carries no accuracy or provenance that could imply more
 * precision than the grid provides.
 */
export type ApproximateLocation = GeoPoint;

/**
 * LOCAL ONLY. Where the person using the app currently is, or says they are.
 * May be a precise device fix; never leaves this browser at that precision.
 */
export interface UserLocation {
  point: GeoPoint;
  accuracyMeters?: number;
  source: LocationSource;
  /** Nearest pilot locality. A label for the UI, not a grouping key. */
  localityId: string;
  localityLabel: string;
}

// ------------------------------------------------------------- 1. RAW INPUT

export interface User {
  id: string;
  /** The prototype is anonymous-first; no registration or login UI. */
  displayName?: string;
  favouriteAreaIds: string[];
  notificationsEnabled: boolean;
  createdAt: string;
}

/**
 * A pilot locality. Used for navigation, labelling and as the manual location
 * fallback - never as an incident boundary.
 */
export interface Area {
  id: string;
  name: string;
  city: 'Hyderabad';
  /** Approximate locality centre, used as the manual fallback position. */
  center: GeoPoint;
}

export type ReportType = 'outage' | 'still_out' | 'restored';

/** One contribution from one person. */
export interface Report {
  id: string;
  userId: string;
  type: ReportType;
  /** SHARED approximate location. Already coarsened. Never rendered raw. */
  location: ApproximateLocation;
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
  /** How many independent reporters mentioned it. */
  reportedBy: number;
}

/**
 * Derived from a purely geographic cluster of reports. Never written by a
 * client, and never bounded by a locality: reports on opposite sides of a
 * locality boundary belong to the same incident when they are close enough.
 *
 * `publicCenter` + `radiusMeters` (<= 500 m) is the PUBLIC representation: it
 * says where reports cluster, not that every property inside is affected.
 */
export interface Incident {
  id: string;
  publicCenter: GeoPoint;
  radiusMeters: number;
  /** Nearest pilot locality to the centroid. A label only. */
  localityId: string;
  localityLabel: string;
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

/** An incident together with how far it is from the person looking at it. */
export interface NearbyIncident {
  incident: Incident;
  distanceMeters: number;
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
  /** Localities the source names. Official data keeps its own geography. */
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
  | { name: 'map'; focusIncidentId?: string }
  | { name: 'incident'; incidentId: string }
  | { name: 'history' }
  | { name: 'profile' };

/** Everything the home screen needs for where the user currently is. */
export interface AreaStatusView {
  localityLabel: string;
  status: IncidentStatus;
  /** The active incident at the user's location, if any. */
  incident: Incident | null;
  /** Official events for the surrounding locality. Never merged with above. */
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
  /** The locality whose demo data shows this state. */
  localityId: string;
  /** Where to stand to see it. Becomes the viewer's manual location. */
  point: GeoPoint;
}
