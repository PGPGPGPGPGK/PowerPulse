/**
 * Self-check for the incident derivation rules. No test framework: run with
 *   npm run check
 */
import assert from 'node:assert/strict';
import type { Report } from '../../types/outage';
import { deriveIncidents, isActive } from './deriveIncidents.ts';

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const areaName = () => 'Kothapet';

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
  areaId: 'kothapet',
  type,
  approxLocation: { lat, lng },
  createdAt: minutesAgo(mins),
  isMock: false,
});

// Two clusters ~1.5 km apart in one area must stay two incidents.
const far = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 20),
    report('outage', 'b', 17.3676, 78.5312, 18),
    report('outage', 'c', 17.3805, 78.531, 10),
  ],
  areaName,
);
assert.equal(far.length, 2, 'distant reports must not merge into one incident');

// Threshold: 1-2 reporters = possible, 3+ = confirmed.
const possible = deriveIncidents([report('outage', 'a', 17.3675, 78.531, 5)], areaName);
assert.equal(possible[0].status, 'possible');

const confirmed = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 12),
    report('outage', 'b', 17.3676, 78.5311, 10),
    report('outage', 'c', 17.3677, 78.5312, 8),
  ],
  areaName,
);
assert.equal(confirmed[0].status, 'confirmed');
assert.equal(confirmed[0].reporterCount, 3);

// The same person reporting repeatedly must not confirm an incident alone.
const spam = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 12),
    report('outage', 'a', 17.3675, 78.531, 8),
    report('outage', 'a', 17.3675, 78.531, 4),
  ],
  areaName,
);
assert.equal(spam[0].reporterCount, 1, 'reporter count must be distinct users');
assert.equal(spam[0].status, 'possible');

// One restoration among several outage reports = restoring, not restored.
const restoring = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 40),
    report('outage', 'b', 17.3676, 78.5311, 38),
    report('outage', 'c', 17.3677, 78.5312, 36),
    report('restored', 'a', 17.3675, 78.531, 2),
  ],
  areaName,
);
assert.equal(restoring[0].status, 'restoring');

const restored = deriveIncidents(
  [
    report('outage', 'a', 17.3675, 78.531, 40),
    report('outage', 'b', 17.3676, 78.5311, 38),
    report('restored', 'a', 17.3675, 78.531, 3),
    report('restored', 'b', 17.3676, 78.5311, 2),
  ],
  areaName,
);
assert.equal(restored[0].status, 'restored');
assert.ok(restored[0].restoredAt, 'restored incidents carry a restoration time');
assert.equal(isActive(restored[0]), false);

// Radius stays local, never a whole neighbourhood.
assert.ok(confirmed[0].radiusMeters <= 500 && confirmed[0].radiusMeters >= 120);

// Stale incidents drop out of the live view.
assert.equal(isActive(deriveIncidents([report('outage', 'a', 17.3675, 78.531, 600)], areaName)[0]), false);

console.log('deriveIncidents: all checks passed');
