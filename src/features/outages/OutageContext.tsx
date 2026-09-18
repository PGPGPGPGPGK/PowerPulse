import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Area,
  AreaStatusView,
  CommunityReasonOption,
  DemoScenario,
  GeoPoint,
  Incident,
  OfficialEvent,
  OfficialSource,
} from '../../types/outage';
import type {
  MyReportState,
  NewReportInput,
  OutageRepository,
  SubmitResult,
} from '../../services/outageRepository';
import { mockOutageRepository } from '../../services/mockOutageRepository';
import { distanceMeters } from './geo';
import { NEARBY_RADIUS_M } from './deriveIncidents';

/** An incident plus how far it is from the user's approximate location. */
export interface NearbyIncident {
  incident: Incident;
  distanceMeters: number;
}

/** Nearby means geographically nearby, never "somewhere else in the city". */
const MAX_NEARBY = 3;

/**
 * The only consumer of the repository.
 *
 * Screens read everything from this hook, so replacing the mock repository
 * with Firebase (and its async reads) is a change to this file alone.
 */

interface Snapshot {
  activeIncidents: Incident[];
  history: Incident[];
  officialEvents: OfficialEvent[];
}

const readSnapshot = (repository: OutageRepository): Snapshot => ({
  activeIncidents: repository.listActiveIncidents(),
  history: repository.listHistory(),
  officialEvents: repository.listOfficialEvents(),
});

interface OutageContextValue extends Snapshot {
  areas: Area[];
  reasonOptions: CommunityReasonOption[];
  areaId: string;
  setAreaId: (id: string) => void;
  /** Approximate reporting location. Never an exact stored GPS fix. */
  approxLocation: GeoPoint;
  areaStatus: AreaStatusView;
  /** Closest active incidents to the user, excluding the one shown as status. */
  nearbyIncidents: NearbyIncident[];
  getIncident: (id: string) => Incident | undefined;
  getMyReportState: (incident: Incident) => MyReportState;
  getOfficialSource: (id: string) => OfficialSource | undefined;
  favouriteAreaIds: string[];
  toggleFavourite: (id: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  submitReport: (input: NewReportInput) => SubmitResult;
  /** Adds a still-out or restored signal to an existing incident. */
  respondToIncident: (incident: Incident, type: 'still_out' | 'restored') => void;
  demoScenarios: DemoScenario[];
  activeScenarioId: string | null;
  applyDemoScenario: (scenario: DemoScenario) => void;
  resetDemoData: () => void;
}

const OutageContext = createContext<OutageContextValue | null>(null);

export function OutageProvider({
  children,
  repository = mockOutageRepository,
}: {
  children: ReactNode;
  repository?: OutageRepository;
}) {
  const user = repository.getCurrentUser();
  const areas = repository.listAreas();
  const defaultAreaId = user.favouriteAreaIds[0] ?? areas[0].id;

  const [snapshot, setSnapshot] = useState<Snapshot>(() => readSnapshot(repository));
  const [areaId, setAreaIdState] = useState(defaultAreaId);
  const [approxLocation, setApproxLocation] = useState<GeoPoint>(
    repository.getArea(defaultAreaId).center,
  );
  const [favouriteAreaIds, setFavouriteAreaIds] = useState(user.favouriteAreaIds);
  const [notificationsEnabled, setNotificationsEnabled] = useState(user.notificationsEnabled);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const setAreaId = (id: string) => {
    setAreaIdState(id);
    // The reporting location follows the chosen area: area-level precision only.
    setApproxLocation(repository.getArea(id).center);
  };

  const submitReport = (input: NewReportInput) => {
    const result = repository.submitReport(input);
    setSnapshot(readSnapshot(repository));
    return result;
  };

  const respondToIncident = (incident: Incident, type: 'still_out' | 'restored') => {
    submitReport({ areaId: incident.areaId, type, approxLocation: incident.center });
  };

  const area = repository.getArea(areaId);
  const inArea = snapshot.activeIncidents.filter((incident) => incident.areaId === areaId);
  const nearest = [...inArea].sort(
    (a, b) => distanceMeters(a.center, approxLocation) - distanceMeters(b.center, approxLocation),
  )[0];

  const areaStatus: AreaStatusView = {
    areaId,
    areaName: area.name,
    status: nearest?.status ?? 'none',
    incident: nearest ?? null,
    otherIncidents: inArea.filter((incident) => incident.id !== nearest?.id),
    officialEvents: repository.listOfficialEvents(areaId),
  };

  const nearbyIncidents: NearbyIncident[] = snapshot.activeIncidents
    .filter((incident) => incident.id !== nearest?.id)
    .map((incident) => ({
      incident,
      distanceMeters: distanceMeters(incident.center, approxLocation),
    }))
    .filter((entry) => entry.distanceMeters <= NEARBY_RADIUS_M)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, MAX_NEARBY);

  const value: OutageContextValue = {
    ...snapshot,
    areas,
    reasonOptions: repository.listReasonOptions(),
    areaId,
    setAreaId,
    approxLocation,
    areaStatus,
    nearbyIncidents,
    getIncident: (id) => repository.getIncident(id),
    getMyReportState: (incident) => repository.getMyReportState(incident),
    getOfficialSource: (id) => repository.getOfficialSource(id),
    favouriteAreaIds,
    toggleFavourite: (id) =>
      setFavouriteAreaIds((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      ),
    notificationsEnabled,
    setNotificationsEnabled,
    submitReport,
    respondToIncident,
    demoScenarios: repository.listDemoScenarios(),
    activeScenarioId,
    applyDemoScenario: (scenario) => {
      setActiveScenarioId(scenario.id);
      setAreaId(scenario.areaId);
    },
    resetDemoData: () => {
      repository.resetDemoData();
      setActiveScenarioId(null);
      setSnapshot(readSnapshot(repository));
    },
  };

  return <OutageContext.Provider value={value}>{children}</OutageContext.Provider>;
}

export function useOutages(): OutageContextValue {
  const context = useContext(OutageContext);
  if (!context) throw new Error('useOutages must be used inside <OutageProvider>');
  return context;
}
