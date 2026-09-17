export type IncidentStatus = 'possible' | 'confirmed' | 'restoring' | 'restored';

export interface Area {
  id: string;
  name: string;
  city: 'Hyderabad';
}

export interface OutageIncident {
  id: string;
  areaId: string;
  areaName: string;
  status: IncidentStatus;
  reportCount: number;
  restorationCount: number;
  firstReportedAt: string;
  lastConfirmedAt: string;
}

export interface OutageReport {
  id: string;
  anonymousUserId: string;
  areaId: string;
  incidentId: string | null;
  type: 'outage' | 'still_out' | 'restored';
  createdAt: string;
}
