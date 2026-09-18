import { useState } from 'react';
import type { Route } from './types/outage';
import type { OutageRepository } from './services/outageRepository';
import { OutageProvider } from './features/outages/OutageContext';
import { HomeScreen } from './features/outages/HomeScreen';
import { ReportOutageScreen } from './features/outages/ReportOutageScreen';
import { ReportConfirmationScreen } from './features/outages/ReportConfirmationScreen';
import { IncidentDetailScreen } from './features/outages/IncidentDetailScreen';
import { MapScreen } from './features/outages/MapScreen';
import { HistoryScreen } from './features/outages/HistoryScreen';
import { ProfileScreen } from './features/outages/ProfileScreen';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';

/** Prototype navigation: plain React state, no router dependency. */
const titles: Record<Route['name'], { title: string; subtitle?: string }> = {
  home: { title: 'PowerPulse', subtitle: 'Hyderabad pilot' },
  report: { title: 'Report outage', subtitle: 'Takes one tap' },
  confirmation: { title: 'Report received' },
  map: { title: 'Map', subtitle: 'Approximate areas only' },
  incident: { title: 'Incident detail' },
  history: { title: 'History', subtitle: 'Community-reported' },
  profile: { title: 'Profile' },
};

const isSecondary = (name: Route['name']) =>
  name === 'report' || name === 'confirmation' || name === 'incident';

export default function App({ repository }: { repository?: OutageRepository }) {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const { title, subtitle } = titles[route.name];
  const isLive = repository?.sourceKind === 'firebase';

  return (
    <OutageProvider repository={repository}>
      <div className="app">
        <AppHeader
          title={title}
          subtitle={subtitle}
          onBack={isSecondary(route.name) ? () => setRoute({ name: 'home' }) : undefined}
        />

        <p className={isLive ? 'demoBanner demoBanner--live' : 'demoBanner'}>
          {isLive
            ? 'Prototype · Community reports are shared live between devices.'
            : 'Prototype · All outage information shown is demo data.'}
        </p>

        <main className="content">
          {route.name === 'home' && <HomeScreen onNavigate={setRoute} />}
          {route.name === 'report' && <ReportOutageScreen onNavigate={setRoute} />}
          {route.name === 'confirmation' && (
            <ReportConfirmationScreen incidentId={route.incidentId} onNavigate={setRoute} />
          )}
          {route.name === 'incident' && (
            <IncidentDetailScreen incidentId={route.incidentId} onNavigate={setRoute} />
          )}
          {route.name === 'map' && (
            <MapScreen focusIncidentId={route.focusIncidentId} onNavigate={setRoute} />
          )}
          {route.name === 'history' && <HistoryScreen onNavigate={setRoute} />}
          {route.name === 'profile' && <ProfileScreen onNavigate={setRoute} />}
        </main>

        <BottomNav current={route.name} onNavigate={setRoute} />
      </div>
    </OutageProvider>
  );
}
