/**
 * Self-check for the geographic clustering and ranking rules. No test
 * framework and no live GPS: run with `npm run check`.
 */
import assert from 'node:assert/strict';
import type { Report } from '../../types/outage';
import {
  ACTIVE_WINDOW_HOURS,
  LIFECYCLE_TICK_MS,
  RECONFIRM_AFTER_HOURS,
  deriveIncidents,
  deriveMyReportState,
  isActive,
  rankNearby,
} from './deriveIncidents.ts';
import { coarsenForSharing, distanceMeters } from './geo.ts';
import { buildReportFields } from '../../services/reportDocument.ts';
import { localityFor } from '../../data/areas.ts';
import {
  LEGAL_STORAGE_KEY,
  LEGAL_VERSION,
  acceptanceRecord,
  gateReportAction,
  hasAcceptedCurrentLegal,
  legalPageUrl,
  readAcceptance,
  writeAcceptance,
} from '../legal/legal.ts';
import type { LegalStore } from '../legal/legal.ts';
import {
  circleRing,
  describeIncident,
  toIncidentAreas,
  toIncidentPoints,
} from '../map/incidentLayers.ts';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let seq = 0;
const report = (
  type: Report['type'],
  userId: string,
  lat: number,
  lng: number,
  mins: number,
): Report => ({
  id: `r${seq++}`,
  userId,
  type,
  location: { lat, lng, source: 'manual' },
  createdAt: minutesAgo(mins),
  isMock: false,
});

// Points either side of the Kothapet / Chaitanyapuri line, 175 m apart.
const NEAR_KOTHAPET = { lat: 17.3655, lng: 78.5315 };
const NEAR_CHAITANYAPURI = { lat: 17.364, lng: 78.532 };

// 1. Two reports under 300 m apart in the same locality cluster together.
const sameLocality = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 20),
    report('outage', 'b', 17.3677, 78.5312, 18),
  ],
  localityFor,
);
assert.equal(sameLocality.length, 1, 'close reports in one locality must form one incident');
assert.equal(sameLocality[0].reporterCount, 2);

// 2. Two reports under 300 m apart with DIFFERENT locality labels still cluster.
assert.notEqual(
  localityFor(NEAR_KOTHAPET).id,
  localityFor(NEAR_CHAITANYAPURI).id,
  'test fixture must straddle a locality boundary',
);
const acrossBoundary = deriveIncidents(
  [
    report('outage', 'a', NEAR_KOTHAPET.lat, NEAR_KOTHAPET.lng, 20),
    report('outage', 'b', NEAR_CHAITANYAPURI.lat, NEAR_CHAITANYAPURI.lng, 18),
  ],
  localityFor,
);
assert.equal(acrossBoundary.length, 1, 'a locality boundary must not split an incident');
assert.equal(acrossBoundary[0].reporterCount, 2);

// 3. Reports far apart stay separate incidents.
const farApart = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 20),
    report('outage', 'b', 17.3805, 78.531, 18),
  ],
  localityFor,
);
assert.equal(farApart.length, 2, 'distant reports must not merge');

// 4. Repeat observations from one UID do not inflate independent reporters.
const repeated = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 12),
    report('outage', 'a', 17.3675, 78.531, 8),
    report('outage', 'a', 17.3675, 78.531, 4),
  ],
  localityFor,
);
assert.equal(repeated[0].reporterCount, 1, 'reporter count must be distinct users');
assert.equal(repeated[0].status, 'possible');

// 5. "Still out" is a confirmation, not a new independent reporter.
const stillOut = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 30),
    report('outage', 'b', 17.3676, 78.5311, 28),
    report('still_out', 'a', 17.3675, 78.531, 5),
    report('still_out', 'b', 17.3676, 78.5311, 4),
  ],
  localityFor,
);
assert.equal(stillOut[0].reporterCount, 2, 'still_out must not raise the reporter count');
assert.equal(stillOut[0].confirmationCount, 2);
assert.equal(stillOut[0].status, 'possible', 'two reporters is below the confirm threshold');

// Three distinct reporters reach the confirmed threshold.
const confirmed = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 12),
    report('outage', 'b', 17.3676, 78.5311, 10),
    report('outage', 'c', 17.3677, 78.5312, 8),
  ],
  localityFor,
);
assert.equal(confirmed[0].status, 'confirmed');
assert.ok(confirmed[0].radiusMeters <= 500 && confirmed[0].radiusMeters >= 120);

// 6. Restoration attaches to the geographically correct incident.
const twoClusters = deriveIncidents(
  [
    // cluster one
    report('outage', 'a', 17.3675, 78.531, 40),
    report('outage', 'b', 17.3676, 78.5311, 38),
    // cluster two, ~1.4 km north
    report('outage', 'c', 17.3805, 78.531, 36),
    report('outage', 'd', 17.3806, 78.5311, 34),
    // both members of cluster two report power back
    report('restored', 'c', 17.3805, 78.531, 3),
    report('restored', 'd', 17.3806, 78.5311, 2),
  ],
  localityFor,
);
assert.equal(twoClusters.length, 2);
const restored = twoClusters.find((incident) => incident.restorationCount > 0);
const stillOutCluster = twoClusters.find((incident) => incident.restorationCount === 0);
assert.ok(restored && stillOutCluster);
assert.equal(restored.status, 'restored');
assert.ok(restored.restoredAt, 'restored incidents carry a restoration time');
assert.equal(isActive(restored), false);
assert.equal(stillOutCluster.status, 'possible', 'the other cluster must be untouched');
assert.ok(restored.publicCenter.lat > stillOutCluster.publicCenter.lat, 'restored is the north one');

// One restoration among several reporters reads as restoring, not restored.
const restoring = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 40),
    report('outage', 'b', 17.3676, 78.5311, 38),
    report('outage', 'c', 17.3677, 78.5312, 36),
    report('restored', 'a', 17.3675, 78.531, 2),
  ],
  localityFor,
);
assert.equal(restoring[0].status, 'restoring');

// 7. Nearby incidents are ordered by geographic distance from the viewer.
const spread = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 20), // ~0 m from the viewer
    report('outage', 'b', 17.3765, 78.531, 18), // ~1.0 km
    report('outage', 'c', 17.3945, 78.531, 16), // ~3.0 km
  ],
  localityFor,
);
const ranked = rankNearby(spread, { lat: 17.3675, lng: 78.531 });
assert.equal(ranked.length, 3);
assert.ok(
  ranked[0].distanceMeters < ranked[1].distanceMeters &&
    ranked[1].distanceMeters < ranked[2].distanceMeters,
  'nearby must be sorted by distance',
);
// The radius filter keeps distant city incidents out of "nearby".
assert.equal(rankNearby(spread, { lat: 17.3675, lng: 78.531 }, { radiusMeters: 1500 }).length, 2);
assert.equal(rankNearby(spread, { lat: 17.3675, lng: 78.531 }, { limit: 1 }).length, 1);

// Stale reports drop out of the live view, and out of derivation entirely.
assert.equal(isActive(deriveIncidents([report('outage', 'a', 17.3675, 78.531, 600)], localityFor)[0]), false);
assert.equal(
  deriveIncidents([report('outage', 'a', 17.3675, 78.531, 60 * 30)], localityFor).length,
  0,
  'reports older than the derivation window are not clustered at all',
);

// ------------------------------------------------------- incident lifecycle

const hoursAgo = (h: number) => h * 60;

// 15. A person is not prompted while their own observation is still fresh.
assert.equal(
  deriveMyReportState([report('outage', 'a', 17.3675, 78.531, hoursAgo(1))]),
  'reported',
  `no prompt before ${RECONFIRM_AFTER_HOURS} hours`,
);
assert.equal(deriveMyReportState([]), 'none');

// 16. ...and is prompted once it has gone stale.
assert.equal(
  deriveMyReportState([report('outage', 'a', 17.3675, 78.531, hoursAgo(3))]),
  'due',
  `prompt after ${RECONFIRM_AFTER_HOURS} hours`,
);

// 17. Any still_out answer restarts that person's clock.
assert.equal(
  deriveMyReportState([
    report('outage', 'a', 17.3675, 78.531, hoursAgo(5)),
    report('still_out', 'a', 17.3675, 78.531, 10),
  ]),
  'reported',
  'still_out resets the reconfirmation timer',
);

// 18. Saying the power is back retires them from the prompt for good.
assert.equal(
  deriveMyReportState([
    report('outage', 'a', 17.3675, 78.531, hoursAgo(9)),
    report('restored', 'a', 17.3675, 78.531, hoursAgo(8)),
  ]),
  'restored',
  'a restored report removes the prompt even when it is old',
);

// 19. An incident with a recent confirmation stays active.
const freshlyConfirmed = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, hoursAgo(5)),
    report('outage', 'b', 17.3676, 78.5311, hoursAgo(5)),
    report('outage', 'c', 17.3677, 78.5312, hoursAgo(5)),
    report('still_out', 'a', 17.3675, 78.531, 20),
  ],
  localityFor,
)[0];
assert.equal(freshlyConfirmed.status, 'confirmed');
assert.equal(isActive(freshlyConfirmed), true);

// 20. Without a fresh confirmation it stops being treated as active.
const quiet = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, hoursAgo(9)),
    report('outage', 'b', 17.3676, 78.5311, hoursAgo(8)),
    report('outage', 'c', 17.3677, 78.5312, hoursAgo(7)),
  ],
  localityFor,
)[0];
assert.equal(quiet.status, 'inactive', `no confirmation for ${ACTIVE_WINDOW_HOURS} hours`);
assert.equal(isActive(quiet), false);

// A still_out inside the window keeps the same reports active.
const keptAlive = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, hoursAgo(9)),
    report('outage', 'b', 17.3676, 78.5311, hoursAgo(8)),
    report('still_out', 'b', 17.3676, 78.5311, hoursAgo(1)),
  ],
  localityFor,
)[0];
assert.equal(isActive(keptAlive), true, 'a still_out inside the window keeps it active');

// 21. Going quiet is NOT a restoration and must never be labelled as one.
assert.notEqual(quiet.status, 'restored');
assert.equal(quiet.restorationCount, 0);
assert.equal(quiet.restoredAt, undefined, 'silence never produces a restoration time');

// 22. Explicit restoration still works on its own terms, however old.
const explicitlyRestored = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, hoursAgo(9)),
    report('outage', 'b', 17.3676, 78.5311, hoursAgo(8)),
    report('restored', 'a', 17.3675, 78.531, hoursAgo(7)),
    report('restored', 'b', 17.3676, 78.5311, hoursAgo(7)),
  ],
  localityFor,
)[0];
assert.equal(explicitlyRestored.status, 'restored', 'restoration outranks staleness');
assert.ok(explicitlyRestored.restoredAt);
assert.equal(isActive(explicitlyRestored), false);

// ...and a fresh restoration is still distinguished from a stale silence.
assert.equal(restored.status, 'restored');
assert.notEqual(restored.status, quiet.status);

// --------------------------------------------------------------- privacy

// A precise device fix, as getCurrentPosition would give it.
const PRECISE = { lat: 17.3676413, lng: 78.5312987 };

// 8. The coordinate is coarsened before it can be persisted.
const shared = coarsenForSharing(PRECISE);
assert.notDeepEqual(shared, PRECISE, 'the shared point must not equal the device point');
assert.equal(shared.lat, 17.368);
assert.equal(shared.lng, 78.531);
assert.ok(
  String(shared.lat).split('.')[1].length <= 3 && String(shared.lng).split('.')[1].length <= 3,
  'shared coordinates are snapped to the 3-decimal grid',
);
// Within half a grid cell of the truth: coarse enough to hide a household,
// fine enough to stay well inside the 300 m clustering radius.
assert.ok(distanceMeters(PRECISE, shared) < 80);
// Snapping again changes nothing, so the defensive second pass is safe.
assert.deepEqual(coarsenForSharing(shared), shared);
// Every device fix inside one cell collapses onto the same stored point.
assert.deepEqual(coarsenForSharing({ lat: 17.3676999, lng: 78.5313999 }), shared);

// 9. The persisted document carries the coarsened point and nothing else.
const fields = buildReportFields('uid-1', {
  type: 'outage',
  location: PRECISE,
  street: '  Sagar Ring Road  ',
});
assert.deepEqual(Object.keys(fields).sort(), ['action', 'location', 'street', 'userId']);
assert.deepEqual(Object.keys(fields.location).sort(), ['lat', 'lng']);
assert.deepEqual(fields.location, shared, 'the stored location is the coarsened one');
assert.notDeepEqual(fields.location, PRECISE, 'the precise coordinate is never written');
assert.equal(JSON.stringify(fields).includes('17.3676413'), false, 'no precise value leaks');
assert.equal(JSON.stringify(fields).includes('accuracy'), false, 'accuracy is not persisted');
assert.equal(fields.street, 'Sagar Ring Road');

const minimal = buildReportFields('uid-1', { type: 'still_out', location: PRECISE });
assert.deepEqual(Object.keys(minimal).sort(), ['action', 'location', 'userId']);

// 10. Clustering still behaves sensibly once every point is coarsened.
const coarse = (point: { lat: number; lng: number }) => coarsenForSharing(point);

// Close neighbours (~175 m apart, across a locality boundary) still cluster.
const coarsenedBoundary = deriveIncidents(
  [
    report('outage', 'a', coarse(NEAR_KOTHAPET).lat, coarse(NEAR_KOTHAPET).lng, 20),
    report('outage', 'b', coarse(NEAR_CHAITANYAPURI).lat, coarse(NEAR_CHAITANYAPURI).lng, 18),
  ],
  localityFor,
);
assert.equal(coarsenedBoundary.length, 1, 'coarsening must not split a cross-boundary incident');
assert.equal(coarsenedBoundary[0].reporterCount, 2);

// Around the 300 m threshold: ~250 m apart still groups...
const justInside = { lat: 17.3675 + 0.00225, lng: 78.531 };
const inside = deriveIncidents(
  [
    report('outage', 'a', coarse({ lat: 17.3675, lng: 78.531 }).lat, coarse({ lat: 17.3675, lng: 78.531 }).lng, 20),
    report('outage', 'b', coarse(justInside).lat, coarse(justInside).lng, 18),
  ],
  localityFor,
);
assert.equal(inside.length, 1, 'reports ~250 m apart still cluster after coarsening');

// ...and a clearly separate pair (~1.4 km) still does not.
const outside = deriveIncidents(
  [
    report('outage', 'a', coarse({ lat: 17.3675, lng: 78.531 }).lat, coarse({ lat: 17.3675, lng: 78.531 }).lng, 20),
    report('outage', 'b', coarse({ lat: 17.3805, lng: 78.531 }).lat, coarse({ lat: 17.3805, lng: 78.531 }).lng, 18),
  ],
  localityFor,
);
assert.equal(outside.length, 2, 'distant reports stay separate after coarsening');

// ------------------------------------------------------------- map layers

// Build an incident out of several reports, so its centroid is distinct from
// every individual report position.
const mapped = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 20),
    report('outage', 'b', 17.3679, 78.5314, 18),
    report('outage', 'c', 17.3677, 78.5312, 16),
  ],
  localityFor,
)[0];

// 11. Only the public centre and radius reach the map.
const points = toIncidentPoints([mapped]);
assert.equal(points.features.length, 1);
assert.deepEqual(points.features[0].geometry.coordinates, [
  mapped.publicCenter.lng,
  mapped.publicCenter.lat,
]);
assert.deepEqual(
  Object.keys(points.features[0].properties).sort(),
  ['id', 'localityLabel', 'radiusMeters', 'reporterCount', 'status'],
  'map features carry aggregates only',
);

// 12. No raw report coordinate is present anywhere in the map payload.
const payload = JSON.stringify([points, toIncidentAreas([mapped])]);
for (const raw of ['17.3675,', '78.5314', '17.3679']) {
  assert.equal(payload.includes(raw), false, `raw report coordinate ${raw} must not reach the map`);
}
assert.equal(payload.includes('location'), false, 'no report location field reaches the map');
assert.equal(payload.includes('userId'), false, 'no reporter identity reaches the map');

// 13. The drawn area uses the incident's own radius, on the ground.
const areas = toIncidentAreas([mapped]);
const ring = areas.features[0].geometry.coordinates[0];
assert.equal(ring.length, 49, 'closed ring of 48 segments');
assert.deepEqual(ring[0], ring[ring.length - 1], 'the ring is closed');
for (const [lng, lat] of ring) {
  const spread = distanceMeters(mapped.publicCenter, { lat, lng });
  assert.ok(
    Math.abs(spread - mapped.radiusMeters) < 2,
    'every vertex sits on the incident radius',
  );
}
assert.equal(areas.features[0].properties.radiusMeters, mapped.radiusMeters);

// A circle of a known size comes out the right size.
const ring500 = circleRing({ lat: 17.4, lng: 78.5 }, 500);
assert.ok(Math.abs(distanceMeters({ lat: 17.4, lng: 78.5 }, { lat: ring500[0][1], lng: ring500[0][0] }) - 500) < 2);

// 14. The text alternative states the cluster meaning, not coverage.
const described = describeIncident(mapped, 350);
assert.ok(described.includes('3 reporting'));
assert.ok(described.includes('350 m away'));
assert.ok(described.includes('clustered'));

// 31. Time-dependent state is a pure function of the clock, which is what the
// 60-second tick re-evaluates. The same reports are read at two moments.
const standingReports = [
  report('outage', 'a', 17.3675, 78.531, 30),
  report('outage', 'b', 17.3676, 78.5311, 28),
  report('outage', 'c', 17.3677, 78.5312, 26),
];
const nowMs = Date.now();

const asSeenNow = deriveIncidents(standingReports, localityFor, nowMs)[0];
assert.equal(asSeenNow.status, 'confirmed');
assert.equal(isActive(asSeenNow), true);

// The same data, read later, without anything new arriving.
const asSeenLater = deriveIncidents(
  standingReports,
  localityFor,
  nowMs + (ACTIVE_WINDOW_HOURS + 1) * 3_600_000,
)[0];
assert.equal(asSeenLater.status, 'inactive', 'the tick alone moves it to inactive');
assert.equal(isActive(asSeenLater), false);
assert.equal(asSeenLater.restoredAt, undefined, 'and still never claims restoration');

// The same for one person's reconfirmation prompt.
const myReport = [report('outage', 'a', 17.3675, 78.531, 5)];
assert.equal(deriveMyReportState(myReport, nowMs), 'reported');
assert.equal(
  deriveMyReportState(myReport, nowMs + RECONFIRM_AFTER_HOURS * 3_600_000 + 1_000),
  'due',
  'the prompt falls due purely with the passage of time',
);

// The tick is slow on purpose: a minute, not a second.
assert.equal(LIFECYCLE_TICK_MS, 60_000);

// ------------------------------------------------------- legal gate

/** In-memory stand-in for localStorage. */
const fakeStore = (initial: Record<string, string> = {}): LegalStore & { data: Record<string, string> } => ({
  data: { ...initial },
  getItem(key) {
    return this.data[key] ?? null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
});

// 23. Legal URLs are built from the base path, never root-absolute.
assert.equal(legalPageUrl('privacy', '/PowerPulse/'), '/PowerPulse/privacy.html');
assert.equal(legalPageUrl('terms', '/PowerPulse/'), '/PowerPulse/terms.html');
assert.equal(legalPageUrl('storage', '/PowerPulse/'), '/PowerPulse/data-storage.html');
assert.equal(legalPageUrl('feedback', '/PowerPulse/'), '/PowerPulse/feedback.html');
// Local development, and a base that forgot its trailing slash.
assert.equal(legalPageUrl('privacy', '/'), '/privacy.html');
assert.equal(legalPageUrl('privacy', '/PowerPulse'), '/PowerPulse/privacy.html');
assert.equal(legalPageUrl('privacy', '/my-fork/'), '/my-fork/privacy.html');

// 24. The first reporting action is blocked until the acknowledgement is given.
let submitted = 0;
let captured: (() => void) | null = null;
const prompt = (pending: () => void) => {
  captured = pending;
};

gateReportAction(false, () => submitted++, prompt);
assert.equal(submitted, 0, 'an unacknowledged action must not run');
assert.ok(captured, 'the action is held pending instead');

// 25. Accepting runs exactly the action that was held.
(captured as unknown as () => void)();
assert.equal(submitted, 1);

// 26. Acceptance persists locally, in the documented shape and nothing more.
const store = fakeStore();
assert.equal(hasAcceptedCurrentLegal(store), false, 'a fresh browser has not accepted');
writeAcceptance(store);
assert.deepEqual(JSON.parse(store.data[LEGAL_STORAGE_KEY]), {
  accepted: true,
  legalVersion: LEGAL_VERSION,
});
assert.deepEqual(Object.keys(acceptanceRecord()).sort(), ['accepted', 'legalVersion']);

// 27. Having accepted the current version, the user is not asked again.
assert.equal(hasAcceptedCurrentLegal(store), true);
let promptedAgain = false;
gateReportAction(hasAcceptedCurrentLegal(store), () => submitted++, () => {
  promptedAgain = true;
});
assert.equal(promptedAgain, false, 'no re-prompt for the accepted version');
assert.equal(submitted, 2, 'the action ran straight away');

// 28. A new legal version asks again.
assert.equal(
  hasAcceptedCurrentLegal(store, '2027-01-01'),
  false,
  'a newer legal version must be acknowledged again',
);
// Damaged or foreign values are treated as "not accepted", never as consent.
assert.equal(hasAcceptedCurrentLegal(fakeStore({ [LEGAL_STORAGE_KEY]: 'not json' })), false);
assert.equal(
  hasAcceptedCurrentLegal(fakeStore({ [LEGAL_STORAGE_KEY]: '{"accepted":"yes"}' })),
  false,
);
assert.equal(readAcceptance(undefined), null, 'no storage means no acceptance');

// 29. Cancelling submits nothing.
const before = submitted;
gateReportAction(false, () => submitted++, () => {
  /* the user closes the dialog: the pending action is simply dropped */
});
assert.equal(submitted, before, 'cancelling must not submit a report');

// 30. Acknowledgement never reaches Firestore.
const reportFields = buildReportFields('uid-1', { type: 'outage', location: PRECISE });
const reportJson = JSON.stringify(reportFields);
assert.equal(reportJson.includes('legal'), false, 'no legal field is persisted with a report');
assert.equal(reportJson.includes(LEGAL_VERSION), false, 'no legal version is persisted');
assert.equal(reportJson.includes('accepted'), false);
assert.equal(
  JSON.stringify(acceptanceRecord()).includes('uid'),
  false,
  'acceptance is not tied to an account identifier',
);

console.log('deriveIncidents: all checks passed');
