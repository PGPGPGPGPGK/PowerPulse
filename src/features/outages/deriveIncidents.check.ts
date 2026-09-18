/**
 * Self-check for the geographic clustering and ranking rules. No test
 * framework and no live GPS: run with `npm run check`.
 */
import assert from 'node:assert/strict';
import type { Report } from '../../types/outage';
import { deriveIncidents, isActive, rankNearby } from './deriveIncidents.ts';
import { coarsenForSharing, distanceMeters } from './geo.ts';
import { buildReportFields } from '../../services/reportDocument.ts';
import { localityFor } from '../../data/areas.ts';

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

console.log('deriveIncidents: all checks passed');
