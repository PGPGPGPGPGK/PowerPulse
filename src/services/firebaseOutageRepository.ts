import {
  Timestamp,
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import type { DocumentData, Firestore, QueryDocumentSnapshot } from 'firebase/firestore';
import type {
  Area,
  CommunityReasonCode,
  CommunityReasonOption,
  DemoScenario,
  Incident,
  OfficialEvent,
  OfficialSource,
  Report,
  ReportType,
  User,
} from '../types/outage';
import type {
  MyReportState,
  NewReportInput,
  OutageRepository,
  SubmitResult,
} from './outageRepository';
import type { FirebaseContext } from './firebase';
import { buildReportFields } from './reportDocument';
import { areaById, localityFor, pilotAreas } from '../data/areas';
import { communityReasons } from '../data/reasons';
import { deriveIncidents, deriveMyReportState, isActive } from '../features/outages/deriveIncidents';
import { distanceMeters } from '../features/outages/geo';

/**
 * Firestore-backed implementation of the same repository contract the UI
 * already uses. Phase 1 scope: shared, realtime community reports only.
 *
 * Design notes:
 *
 * - Reports are append-only observations. Incidents stay *derived on the
 *   client* with the existing clustering rules, so multi-user behaviour can be
 *   validated before any aggregation moves server-side. No client ever writes
 *   an aggregate count, and security rules forbid it.
 * - A report document stores an APPROXIMATE point (grid-snapped before it
 *   leaves the device) and nothing else about place: no accuracy, no
 *   provenance, no locality key. Reports are readable by every signed-in
 *   client, so nothing precise may be written into them. Clustering runs on
 *   those approximate coordinates; locality names are attached to the derived
 *   incident afterwards, as labels.
 * - `createdAt` is always a server timestamp. Client clocks are not trusted for
 *   ordering; a locally pending write shows its optimistic time for the few
 *   milliseconds before the server value arrives.
 */

/** Rolling window of reports kept in memory. Bounds realtime read cost. */
const WINDOW_HOURS = 24;
const MAX_REPORTS = 500;

const REPORTS = 'reports';

function toReport(snapshot: QueryDocumentSnapshot<DocumentData>): Report | null {
  const data = snapshot.data();
  const location = data.location as { lat?: number; lng?: number } | undefined;
  if (typeof location?.lat !== 'number' || typeof location?.lng !== 'number') return null;

  // Pending local writes have no server timestamp yet.
  const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();

  return {
    id: snapshot.id,
    userId: data.userId,
    type: data.action as ReportType,
    location: { lat: location.lat, lng: location.lng },
    street: typeof data.street === 'string' ? data.street : undefined,
    reasonCode:
      typeof data.communityReason === 'string'
        ? (data.communityReason as CommunityReasonCode)
        : undefined,
    createdAt: createdAt.toISOString(),
    isMock: false,
  };
}

/**
 * Derived incidents are re-computed at least this often, so an incident that
 * quietly ages past the active window updates without new reports arriving.
 */
const CACHE_TTL_MS = 30_000;

export class FirebaseOutageRepository implements OutageRepository {
  readonly sourceKind = 'firebase' as const;

  private db: Firestore;

  private uid: string;

  private reports: Report[] = [];

  private incidentCache: { source: Report[]; derivedAt: number; incidents: Incident[] } | null =
    null;

  private listeners = new Set<() => void>();

  private stopStream: () => void = () => {};

  constructor(context: FirebaseContext) {
    this.db = context.db;
    this.uid = context.uid;
  }

  /**
   * Starts the realtime stream and resolves once the first snapshot lands, so
   * the UI never renders an empty screen it will immediately replace.
   */
  start(): Promise<void> {
    const since = Timestamp.fromMillis(Date.now() - WINDOW_HOURS * 3_600_000);
    const recentReports = query(
      collection(this.db, REPORTS),
      where('createdAt', '>=', since),
      orderBy('createdAt', 'desc'),
      limit(MAX_REPORTS),
    );

    return new Promise((resolve, reject) => {
      let settled = false;
      this.stopStream = onSnapshot(
        recentReports,
        (snapshot) => {
          this.reports = snapshot.docs
            .map(toReport)
            .filter((report): report is Report => report !== null);
          this.listeners.forEach((listener) => listener());
          if (!settled) {
            settled = true;
            resolve();
          }
        },
        (error) => {
          if (settled) console.error('PowerPulse: report stream failed', error);
          else {
            settled = true;
            reject(error);
          }
        },
      );
    });
  }

  stop(): void {
    this.stopStream();
    this.listeners.clear();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
    // Phase 1 keeps profile preferences on the device; no users collection.
    return {
      id: this.uid,
      favouriteAreaIds: [],
      notificationsEnabled: false,
      createdAt: new Date().toISOString(),
    };
  }

  listIncidents(): Incident[] {
    // Statuses age, so the cache expires on time as well as on new reports.
    const stale = !this.incidentCache || Date.now() - this.incidentCache.derivedAt > CACHE_TTL_MS;
    if (stale || this.incidentCache?.source !== this.reports) {
      this.incidentCache = {
        source: this.reports,
        derivedAt: Date.now(),
        incidents: deriveIncidents(this.reports, localityFor),
      };
    }
    return this.incidentCache.incidents;
  }

  listActiveIncidents(): Incident[] {
    return this.listIncidents().filter((incident) => isActive(incident));
  }

  getIncident(incidentId: string): Incident | undefined {
    return this.listIncidents().find((incident) => incident.id === incidentId);
  }

  getMyReportState(incident: Incident): MyReportState {
    const mine = this.reports.filter(
      (report) =>
        report.userId === this.uid &&
        distanceMeters(incident.publicCenter, report.location) <= incident.radiusMeters,
    );
    return deriveMyReportState(mine);
  }

  /** Official-source integration is a later phase: nothing to serve yet. */
  listOfficialEvents(): OfficialEvent[] {
    return [];
  }

  getOfficialSource(): OfficialSource | undefined {
    return undefined;
  }

  /** Incidents from the window that have already been reported restored. */
  listHistory(): Incident[] {
    return this.listIncidents().filter((incident) => !isActive(incident));
  }

  listDemoScenarios(): DemoScenario[] {
    return [];
  }

  resetDemoData(): void {
    // Shared live data is never reset from a client.
  }

  submitReport(input: NewReportInput): SubmitResult {
    const now = new Date();
    const fields = buildReportFields(this.uid, input);
    const document = { ...fields, createdAt: serverTimestamp() };

    // Fire and forget: the Firestore SDK applies the write locally at once, so
    // the stream (and therefore the UI) updates before the server acknowledges.
    addDoc(collection(this.db, REPORTS), document).catch((error) => {
      console.error('PowerPulse: report could not be saved', error);
    });

    const optimistic: Report = {
      id: `pending-${now.getTime()}`,
      userId: this.uid,
      type: input.type,
      location: fields.location,
      street: fields.street,
      reasonCode: input.reasonCode,
      createdAt: now.toISOString(),
      isMock: false,
    };

    const incident =
      this.listIncidents().find(
        (candidate) =>
          distanceMeters(candidate.publicCenter, optimistic.location) <= candidate.radiusMeters,
      ) ?? null;

    return { report: optimistic, incident };
  }
}
