import type {
  CommunityReasonCode,
  DemoScenario,
  GeoPoint,
  Incident,
  OfficialEvent,
  OfficialSource,
  Report,
  User,
} from '../types/outage';
import { areaById } from './areas';

/**
 * DEMO DATA ONLY.
 *
 * Every record here is fictional and carries `isMock: true`. Nothing in this
 * file describes a real outage, a real utility, or a real government notice.
 * UI components must not import this file - they go through
 * `services/mockOutageRepository`, which is what Firebase will replace.
 */

const now = Date.now();
const minutesAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString();

const METRES_PER_DEG_LAT = 111_320;

/** Move a point by a metre offset, used to fan demo reports around a street. */
const offset = (point: GeoPoint, northM: number, eastM: number): GeoPoint => ({
  lat: point.lat + northM / METRES_PER_DEG_LAT,
  lng: point.lng + eastM / (METRES_PER_DEG_LAT * Math.cos((point.lat * Math.PI) / 180)),
});

// --------------------------------------------------------------- demo user

export const demoUser: User = {
  id: 'demo-local-user',
  favouriteAreaIds: ['kothapet', 'dilsukhnagar'],
  notificationsEnabled: false,
  createdAt: new Date(now).toISOString(),
};

// ------------------------------------------------------------ demo reports

interface ClusterSpec {
  key: string;
  areaId: string;
  /** Cluster offset from the area centre, in metres. */
  north: number;
  east: number;
  reporters: number;
  firstReportMinutesAgo: number;
  stillOutMinutesAgo?: number[];
  restoredMinutesAgo?: number[];
  streets?: string[];
  reasons?: CommunityReasonCode[];
}

/** One fictional scenario per primary state in the PRD. */
const clusters: ClusterSpec[] = [
  {
    // Community-confirmed outage, large cluster.
    key: 'kothapet-ring',
    areaId: 'kothapet',
    north: 120,
    east: -90,
    reporters: 12,
    firstReportMinutesAgo: 18,
    stillOutMinutesAgo: [2, 6, 11],
    streets: ['Sagar Ring Road', 'Balaji Nagar Lane 3'],
    reasons: ['transformer', 'transformer', 'line_fault'],
  },
  {
    // A second, separate incident inside the same neighbourhood.
    key: 'kothapet-market',
    areaId: 'kothapet',
    north: -480,
    east: 520,
    reporters: 2,
    firstReportMinutesAgo: 7,
    streets: ['Market Street'],
    reasons: ['street_pole'],
  },
  {
    // Possible outage - a single reporter.
    key: 'uppal-depot',
    areaId: 'uppal',
    north: 60,
    east: 140,
    reporters: 1,
    firstReportMinutesAgo: 4,
    streets: ['Depot Road'],
  },
  {
    // Possible restoration - restoration signals while others are still out.
    key: 'dilsukhnagar-bus',
    areaId: 'dilsukhnagar',
    north: -80,
    east: 60,
    reporters: 5,
    firstReportMinutesAgo: 52,
    stillOutMinutesAgo: [14],
    restoredMinutesAgo: [3],
    streets: ['Bus Depot Road'],
    reasons: ['line_fault'],
  },
  {
    // Restored.
    key: 'chaitanyapuri-colony',
    areaId: 'chaitanyapuri',
    north: 90,
    east: -60,
    reporters: 4,
    firstReportMinutesAgo: 95,
    restoredMinutesAgo: [9, 12, 15],
    streets: ['Vijaypuri Colony'],
    reasons: ['weather'],
  },
  {
    // Community reports overlapping official information.
    key: 'kondapur-botanical',
    areaId: 'kondapur',
    north: -140,
    east: 180,
    reporters: 6,
    firstReportMinutesAgo: 34,
    stillOutMinutesAgo: [5],
    streets: ['Botanical Garden Road'],
    reasons: ['local_works', 'unknown'],
  },
  {
    // Small confirmed cluster with no official information.
    key: 'lb-nagar-chowrasta',
    areaId: 'lb-nagar',
    north: 200,
    east: 240,
    reporters: 3,
    firstReportMinutesAgo: 23,
    stillOutMinutesAgo: [8],
    streets: ['Chowrasta'],
    reasons: ['transformer'],
  },
];

const buildCluster = (spec: ClusterSpec): Report[] => {
  const anchor = offset(areaById(spec.areaId).center, spec.north, spec.east);
  const reports: Report[] = [];

  for (let i = 0; i < spec.reporters; i += 1) {
    // Fan reporters around the anchor, within roughly 200 m.
    const angle = (i / Math.max(spec.reporters, 1)) * Math.PI * 2;
    const distance = 40 + (i % 4) * 45;
    reports.push({
      id: `${spec.key}-outage-${i}`,
      userId: `demo-user-${spec.key}-${i}`,
      areaId: spec.areaId,
      type: 'outage',
      approxLocation: offset(anchor, Math.sin(angle) * distance, Math.cos(angle) * distance),
      street: spec.streets?.[i % spec.streets.length],
      reasonCode: spec.reasons?.[i % spec.reasons.length],
      createdAt: minutesAgo(spec.firstReportMinutesAgo - i * 0.8),
      isMock: true,
    });
  }

  spec.stillOutMinutesAgo?.forEach((mins, i) => {
    reports.push({
      id: `${spec.key}-stillout-${i}`,
      userId: `demo-user-${spec.key}-${i}`,
      areaId: spec.areaId,
      type: 'still_out',
      approxLocation: offset(anchor, 30 * (i + 1), -20 * (i + 1)),
      createdAt: minutesAgo(mins),
      isMock: true,
    });
  });

  spec.restoredMinutesAgo?.forEach((mins, i) => {
    reports.push({
      id: `${spec.key}-restored-${i}`,
      userId: `demo-user-${spec.key}-${i}`,
      areaId: spec.areaId,
      type: 'restored',
      approxLocation: offset(anchor, -25 * (i + 1), 25 * (i + 1)),
      createdAt: minutesAgo(mins),
      isMock: true,
    });
  });

  return reports;
};

export const seedReports: Report[] = clusters.flatMap(buildCluster);

// ----------------------------------------------------------- demo official

export const officialSources: OfficialSource[] = [
  {
    id: 'mock-utility',
    name: 'Demo Utility Notices (mock source)',
    kind: 'utility',
    reference: 'Demo bulletin PP-MOCK-114',
    isMock: true,
  },
  {
    id: 'mock-municipal',
    name: 'Demo Municipal Works Board (mock source)',
    kind: 'municipal',
    reference: 'Demo works order PP-MOCK-287',
    isMock: true,
  },
];

const at = (hours: number, minutes: number): string => {
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

export const officialEvents: OfficialEvent[] = [
  {
    id: 'official-madhapur-maintenance',
    sourceId: 'mock-utility',
    kind: 'scheduled_interruption',
    title: 'Scheduled interruption for feeder maintenance',
    reason: 'Feeder maintenance',
    areaIds: ['madhapur'],
    center: areaById('madhapur').center,
    radiusMeters: 500,
    startsAt: at(10, 0),
    endsAt: at(13, 0),
    publishedAt: minutesAgo(1440),
    updatedAt: minutesAgo(240),
    isMock: true,
  },
  {
    id: 'official-kondapur-shutdown',
    sourceId: 'mock-municipal',
    kind: 'planned_works',
    title: 'Planned works: cable relocation',
    reason: 'Cable relocation along the service road',
    areaIds: ['kondapur'],
    center: areaById('kondapur').center,
    radiusMeters: 450,
    startsAt: at(9, 30),
    endsAt: at(17, 0),
    publishedAt: minutesAgo(2880),
    updatedAt: minutesAgo(120),
    isMock: true,
  },
];

// ------------------------------------------------------------ demo history

interface HistorySpec {
  id: string;
  areaId: string;
  street: string;
  reporters: number;
  confirmations: number;
  restorations: number;
  day: number;
  startHour: number;
  endHour: number;
  reason?: Incident['reasons'][number];
}

const daysAgo = (days: number, hour: number, minutes = 0): string => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hour, minutes, 0, 0);
  return date.toISOString();
};

const historySpecs: HistorySpec[] = [
  {
    id: 'history-kothapet-1',
    areaId: 'kothapet',
    street: 'Sagar Ring Road',
    reporters: 9,
    confirmations: 4,
    restorations: 5,
    day: 1,
    startHour: 19,
    endHour: 21,
    reason: { code: 'transformer', label: 'Transformer issue', reportedBy: 4 },
  },
  {
    id: 'history-dilsukhnagar-1',
    areaId: 'dilsukhnagar',
    street: 'Bus Depot Road',
    reporters: 5,
    confirmations: 2,
    restorations: 3,
    day: 2,
    startHour: 6,
    endHour: 7,
  },
  {
    id: 'history-uppal-1',
    areaId: 'uppal',
    street: 'Depot Road',
    reporters: 3,
    confirmations: 1,
    restorations: 2,
    day: 3,
    startHour: 14,
    endHour: 17,
    reason: { code: 'weather', label: 'Storm or heavy rain', reportedBy: 2 },
  },
  {
    id: 'history-gachibowli-1',
    areaId: 'gachibowli',
    street: 'Wipro Circle Lane',
    reporters: 4,
    confirmations: 0,
    restorations: 2,
    day: 5,
    startHour: 11,
    endHour: 12,
  },
  {
    id: 'history-kukatpally-1',
    areaId: 'kukatpally',
    street: 'JNTU Road',
    reporters: 7,
    confirmations: 3,
    restorations: 4,
    day: 6,
    startHour: 20,
    endHour: 23,
    reason: { code: 'line_fault', label: 'Line fault or snapped wire', reportedBy: 3 },
  },
];

export const historyIncidents: Incident[] = historySpecs.map((spec) => ({
  id: spec.id,
  areaId: spec.areaId,
  areaName: areaById(spec.areaId).name,
  center: areaById(spec.areaId).center,
  radiusMeters: 350,
  status: 'restored',
  reporterCount: spec.reporters,
  confirmationCount: spec.confirmations,
  restorationCount: spec.restorations,
  firstReportedAt: daysAgo(spec.day, spec.startHour),
  lastConfirmedAt: daysAgo(spec.day, spec.endHour - 1, 30),
  restoredAt: daysAgo(spec.day, spec.endHour),
  reasons: spec.reason ? [spec.reason] : [],
  streets: [spec.street],
  isMock: true,
}));

// ---------------------------------------------------------- demo scenarios

/** Each scenario points at the area whose seeded data shows that state. */
export const demoScenarios: DemoScenario[] = [
  {
    id: 'clear',
    label: 'Clear',
    description: 'No community reports and no official information.',
    areaId: 'gachibowli',
  },
  {
    id: 'possible',
    label: 'Possible outage',
    description: 'A single report, not yet independently confirmed.',
    areaId: 'uppal',
  },
  {
    id: 'confirmed',
    label: 'Community-confirmed outage',
    description: 'Twelve nearby reports, plus a separate cluster in the same area.',
    areaId: 'kothapet',
  },
  {
    id: 'restoring',
    label: 'Possible restoration',
    description: 'Restoration signals arriving while others are still out.',
    areaId: 'dilsukhnagar',
  },
  {
    id: 'restored',
    label: 'Restored',
    description: 'Enough independent restoration reports to read as back on.',
    areaId: 'chaitanyapuri',
  },
  {
    id: 'official',
    label: 'Scheduled official information',
    description: 'A mock scheduled interruption with no community reports.',
    areaId: 'madhapur',
  },
  {
    id: 'official-community',
    label: 'Official information + community reports',
    description: 'Mock planned works alongside active community reports.',
    areaId: 'kondapur',
  },
];
