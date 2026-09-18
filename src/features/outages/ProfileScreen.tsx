import type { Route } from '../../types/outage';
import { useOutages } from './OutageContext';
import { Card } from '../../components/ui';
import { LegalLinkRows, legalHref } from '../../components/LegalLinks';
import { InstallCard } from '../../components/InstallCard';

export function ProfileScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const {
    areas,
    favouriteAreaIds,
    toggleFavourite,
    notificationsEnabled,
    setNotificationsEnabled,
    demoScenarios,
    activeScenarioId,
    applyDemoScenario,
    resetDemoData,
  } = useOutages();

  return (
    <div className="screen">
      <InstallCard />

      <Card title="Your areas">
        <ul className="checkList">
          {areas.map((area) => (
            <li key={area.id}>
              <label>
                <input
                  type="checkbox"
                  checked={favouriteAreaIds.includes(area.id)}
                  onChange={() => toggleFavourite(area.id)}
                />
                {area.name}
              </label>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Notifications">
        <label className="switchRow">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(event) => setNotificationsEnabled(event.target.checked)}
          />
          Alert me about outages in my areas
        </label>
        <p className="note">
          Placeholder only. No notification service is connected in this prototype.
        </p>
      </Card>

      <Card title="Privacy">
        <ul className="bullets">
          <li>
            Reports are saved with a coarsened location, on a grid of roughly 100 m. Your exact
            device position never leaves this device, so no other user can receive it.
          </li>
          <li>Accuracy readings from your device are shown to you only, and are never stored.</li>
          <li>Map circles show where reports cluster, not who reported.</li>
          <li>
            The map loads its tiles from OpenFreeMap, so opening it makes requests to that service.
            Its privacy policy states IP addresses are not kept in regular server logs, though
            infrastructure providers may process request information. No report data is sent there.
          </li>
          <li>This prototype stores everything in your browser session only.</li>
        </ul>
      </Card>

      <Card title="Feedback">
        <p>
          Pilot testers: tell us what was unclear, what was missing, and whether the status matched
          reality.
        </p>
        <a className="btn btn--ghost btn--sm" href={legalHref('feedback')}>
          Give feedback
        </a>
        <p className="note">
          The feedback page describes what we would like to know. Submission is not connected yet,
          so nothing is sent from that form.
        </p>
      </Card>

      <Card title="Privacy &amp; Legal">
        <LegalLinkRows />
        <p className="note">
          Reporting is for people aged 18 or older. Report locations are coarsened before they are
          stored, and the intended retention period for report records is up to 30 days - automated
          deletion is still being implemented.
        </p>
      </Card>

      <Card title="About PowerPulse">
        <p>
          PowerPulse answers one question: is the power out only for me, or are people around me
          affected?
        </p>
        <p className="note">
          Community-reported information alongside clearly labelled demo official entries. Not an
          official utility outage source.
        </p>
      </Card>

      {demoScenarios.length === 0 ? null : (
        <details className="optional">
          <summary>Developer / demo controls</summary>

          <p className="note">Each option jumps to the area whose demo data shows that state.</p>
          <div className="scenarioList">
            {demoScenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                className={`scenario${activeScenarioId === scenario.id ? ' is-active' : ''}`}
                onClick={() => {
                  applyDemoScenario(scenario);
                  onNavigate({ name: 'home' });
                }}
              >
                <span className="scenario__label">{scenario.label}</span>
                <span className="scenario__description">{scenario.description}</span>
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={resetDemoData}>
            Reset demo data
          </button>
        </details>
      )}
    </div>
  );
}
