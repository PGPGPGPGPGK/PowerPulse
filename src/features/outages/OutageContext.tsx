import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  Area,
  AreaStatusView,
  CommunityReasonOption,
  DemoScenario,
  GeoPoint,
  Incident,
  NearbyIncident,
  OfficialEvent,
  OfficialSource,
  UserLocation,
} from '../../types/outage';
import type {
  MyReportState,
  NewReportInput,
  OutageRepository,
  SubmitResult,
} from '../../services/outageRepository';
import { mockOutageRepository } from '../../services/mockOutageRepository';
import { LIFECYCLE_TICK_MS, incidentAtLocation, rankNearby } from './deriveIncidents';
import { coarsenForSharing } from './geo';
import { toUserLocation, useUserLocation } from '../location/useUserLocation';
import type { LocationPermission } from '../location/useUserLocation';
import {
  browserLegalStore,
  gateReportAction,
  hasAcceptedCurrentLegal,
  writeAcceptance,
} from '../legal/legal';

/**
 * The only consumer of the repository.
 *
 * Screens read everything from this hook, so replacing the mock repository
 * with Firebase (and its async reads) is a change to this file alone.
 *
 * Location concepts are kept apart here too: `userLocation` is where the
 * person is (internal, never rendered raw), while everything an incident
 * exposes is the public approximate cluster.
 */

/** How many nearby incidents the home screen lists. */
const MAX_NEARBY = 3;

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
  /** Which backend is serving this session: demo data or shared live data. */
  sourceKind: OutageRepository['sourceKind'];
  areas: Area[];
  reasonOptions: CommunityReasonOption[];
  /**
   * LOCAL ONLY. May be a precise device fix. Shown back to this user, used to
   * rank what is near them, and coarsened before any report is shared.
   */
  userLocation: UserLocation;
  locationPermission: LocationPermission;
  requestDeviceLocation: () => void;
  /** Manual fallback: pick one of the pilot localities. */
  selectLocality: (localityId: string) => void;
  areaStatus: AreaStatusView;
  /** Closest active incidents, excluding the one at the user's location. */
  nearbyIncidents: NearbyIncident[];
  getIncident: (id: string) => Incident | undefined;
  getMyReportState: (incident: Incident) => MyReportState;
  getOfficialSource: (id: string) => OfficialSource | undefined;
  favouriteAreaIds: string[];
  toggleFavourite: (id: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => void;
  /** The location is taken from `userLocation`, never passed in by a screen. */
  submitReport: (input: Omit<NewReportInput, 'location'>) => SubmitResult;
  /** True once this browser has acknowledged the current legal version. */
  legalAccepted: boolean;
  /** Whether the acknowledgement is currently being asked for. */
  legalPromptOpen: boolean;
  /**
   * Runs `action` if the current legal version has been acknowledged, and
   * otherwise asks first. Every user-created observation goes through this.
   */
  requireLegalAcknowledgement: (action: () => void) => void;
  acceptLegal: () => void;
  cancelLegal: () => void;
  /** Adds a still-out or restored signal from where the user is. */
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
  const startingArea = repository.getArea(user.favouriteAreaIds[0] ?? areas[0].id);

  const [snapshot, setSnapshot] = useState<Snapshot>(() => readSnapshot(repository));
  const [favouriteAreaIds, setFavouriteAreaIds] = useState(user.favouriteAreaIds);
  const [notificationsEnabled, setNotificationsEnabled] = useState(user.notificationsEnabled);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Acknowledgement is a local fact about this browser: never stored in
  // Firestore, never tied to the anonymous UID.
  const legalStore = browserLegalStore();
  const [legalAccepted, setLegalAccepted] = useState(() => hasAcceptedCurrentLegal(legalStore));
  const [pendingAction, setPendingAction] = useState<{ run: () => void } | null>(null);

  // Starts on a manually selected locality centre: no permission prompt on
  // startup, and nothing is presented as a device fix until one is granted.
  const { location, permission, requestDeviceLocation, setManualLocation } = useUserLocation(
    toUserLocation(startingArea.center, 'manual'),
  );

  // Realtime sources push new reports in; the mock source never fires.
  useEffect(() => repository.subscribe(() => setSnapshot(readSnapshot(repository))), [repository]);

  // Freshness is a function of time, so an app left open re-reads it on a slow
  // tick: a reconfirmation prompt appears when it falls due, and an incident
  // goes quiet after the active window, with no query and no write.
  useEffect(() => {
    const tick = setInterval(() => setSnapshot(readSnapshot(repository)), LIFECYCLE_TICK_MS);
    return () => clearInterval(tick);
  }, [repository]);

  const submitReport = (input: Omit<NewReportInput, 'location'>) => {
    // The precise device position stops here: only a grid-snapped approximate
    // point, with no accuracy and no provenance, is ever shared.
    const result = repository.submitReport({
      ...input,
      location: coarsenForSharing(location.point),
    });
    setSnapshot(readSnapshot(repository));
    return result;
  };

  const requireLegalAcknowledgement = (action: () => void) => {
    gateReportAction(legalAccepted, action, (pending) => setPendingAction({ run: pending }));
  };

  // still_out and restored are observations too, so they pass the same gate.
  const respondToIncident = (_incident: Incident, type: 'still_out' | 'restored') => {
    requireLegalAcknowledgement(() => submitReport({ type }));
  };

  const setManualPoint = (point: GeoPoint) => setManualLocation(point);

  // Status is geographic: the incident the user is standing in, whatever
  // locality it happens to be labelled with.
  const incident = incidentAtLocation(snapshot.activeIncidents, location.point);

  const areaStatus: AreaStatusView = {
    localityLabel: location.localityLabel,
    status: incident?.status ?? 'none',
    incident,
    officialEvents: repository.listOfficialEvents(location.localityId),
  };

  const nearbyIncidents = rankNearby(
    snapshot.activeIncidents.filter((candidate) => candidate.id !== incident?.id),
    location.point,
    { limit: MAX_NEARBY },
  );

  const value: OutageContextValue = {
    ...snapshot,
    sourceKind: repository.sourceKind,
    areas,
    reasonOptions: repository.listReasonOptions(),
    userLocation: location,
    locationPermission: permission,
    requestDeviceLocation,
    selectLocality: (localityId) => {
      setActiveScenarioId(null);
      setManualPoint(repository.getArea(localityId).center);
    },
    areaStatus,
    nearbyIncidents,
    getIncident: (id) => repository.getIncident(id),
    getMyReportState: (target) => repository.getMyReportState(target),
    getOfficialSource: (id) => repository.getOfficialSource(id),
    favouriteAreaIds,
    toggleFavourite: (id) =>
      setFavouriteAreaIds((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      ),
    notificationsEnabled,
    setNotificationsEnabled,
    submitReport,
    legalAccepted,
    legalPromptOpen: pendingAction !== null,
    requireLegalAcknowledgement,
    acceptLegal: () => {
      writeAcceptance(legalStore);
      setLegalAccepted(true);
      const pending = pendingAction;
      setPendingAction(null);
      pending?.run();
    },
    // Cancelling discards the pending action: nothing is submitted.
    cancelLegal: () => setPendingAction(null),
    respondToIncident,
    demoScenarios: repository.listDemoScenarios(),
    activeScenarioId,
    applyDemoScenario: (scenario) => {
      setActiveScenarioId(scenario.id);
      setManualPoint(scenario.point);
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
