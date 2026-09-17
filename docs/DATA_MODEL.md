# Data model

Firestore-oriented draft. This will evolve during implementation.

## `areas/{areaId}`

- `name`
- `city`
- `activeIncidentId?`
- `updatedAt`

## `incidents/{incidentId}`

- `areaId`
- `status`: `possible | confirmed | restoring | restored`
- `firstReportedAt`
- `lastConfirmedAt`
- `restoredAt?`
- `reportCount`
- `restorationCount`

## `reports/{reportId}`

- `anonymousUserId`
- `areaId`
- `incidentId?`
- `type`: `outage | still_out | restored`
- `createdAt`
- `locationGrid?`

`locationGrid` must not contain publicly exposed household-level coordinates.

## `users/{userId}`

- `createdAt`
- `homeAreaId?`
- `lastReportAt?`
- `notificationOptIn?`

## Invariants

- A user cannot repeatedly inflate one incident's confirmation count inside the configured cooldown.
- Client-visible incident aggregates should not depend on trusting arbitrary client-provided counters.
- Server timestamps are preferred for production writes.
- Incident status changes should eventually be performed transactionally/server-side.
