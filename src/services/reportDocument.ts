import type { ApproximateLocation } from '../types/outage';
import type { NewReportInput } from './outageRepository';
import { coarsenForSharing } from '../features/outages/geo.ts';

/**
 * Builds the exact field set a shared report is persisted with.
 *
 * This is the last point before a report leaves the device, so it is where the
 * privacy guarantee is enforced: the location is coarsened here (again -
 * snapping is idempotent), and nothing else about position is included. No
 * accuracy, no provenance, no locality key.
 *
 * `createdAt` is added by the caller as a server timestamp; client clocks are
 * not authoritative.
 */
export interface ReportFields {
  userId: string;
  action: NewReportInput['type'];
  location: ApproximateLocation;
  street?: string;
  communityReason?: string;
}

export function buildReportFields(userId: string, input: NewReportInput): ReportFields {
  const fields: ReportFields = {
    userId,
    action: input.type,
    location: coarsenForSharing(input.location),
  };

  const street = input.street?.trim();
  if (street) fields.street = street;
  if (input.reasonCode) fields.communityReason = input.reasonCode;

  return fields;
}
