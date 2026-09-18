import type { CommunityReasonCode, CommunityReasonOption } from '../types/outage';

/**
 * Optional causes a reporter can pick. Always presented as a
 * community-reported reason, never as an established cause.
 */
export const communityReasons: CommunityReasonOption[] = [
  { code: 'transformer', label: 'Transformer issue' },
  { code: 'line_fault', label: 'Line fault or snapped wire' },
  { code: 'weather', label: 'Storm or heavy rain' },
  { code: 'local_works', label: 'Digging or local works' },
  { code: 'street_pole', label: 'Street pole or meter box' },
  { code: 'unknown', label: 'I am not sure' },
];

export const reasonLabel = (code: CommunityReasonCode): string =>
  communityReasons.find((reason) => reason.code === code)?.label ?? 'Not specified';
