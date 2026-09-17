import { useMemo, useState } from 'react';
import { Bolt, CheckCircle2, MapPin, Radio, RotateCcw } from 'lucide-react';
import { pilotAreas } from './data/areas';

type LocalReport = { areaId: string; type: 'outage' | 'restored'; at: Date };

export default function App() {
  const [areaId, setAreaId] = useState('kothapet');
  const [reports, setReports] = useState<LocalReport[]>([]);
  const area = useMemo(() => pilotAreas.find((item) => item.id === areaId)!, [areaId]);
  const activeReports = reports.filter((report) => report.areaId === areaId && report.type === 'outage').length;
  const restored = reports.some((report) => report.areaId === areaId && report.type === 'restored');

  const report = (type: LocalReport['type']) => {
    setReports((current) => [...current, { areaId, type, at: new Date() }]);
  };

  return (
    <main className="shell">
      <header className="brand">
        <div className="brandMark"><Bolt size={22} /></div>
        <div><strong>PowerPulse</strong><span>Hyderabad pilot</span></div>
      </header>

      <section className="hero">
        <p className="eyebrow"><Radio size={15} /> Community status</p>
        <h1>Is the power out around you?</h1>
        <p>Report it in one tap and see whether neighbours are experiencing the same thing.</p>
      </section>

      <section className="card areaCard">
        <label htmlFor="area"><MapPin size={18} /> Your area</label>
        <select id="area" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
          {pilotAreas.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select>
      </section>

      <section className={`statusCard ${activeReports > 0 && !restored ? 'statusOut' : 'statusOk'}`}>
        {activeReports > 0 && !restored ? <Bolt size={28} /> : <CheckCircle2 size={28} />}
        <div>
          <span className="statusLabel">{area.name}</span>
          <h2>{activeReports > 0 && !restored ? 'Possible outage reported' : 'No active outage reported'}</h2>
          <p>{activeReports > 0 && !restored ? `${activeReports} community report${activeReports === 1 ? '' : 's'} in this demo session.` : 'No current community reports in this demo session.'}</p>
        </div>
      </section>

      <section className="actions">
        <button className="primary" onClick={() => report('outage')}><Bolt size={20} /> My power is out</button>
        <button className="secondary" onClick={() => report('restored')}><RotateCcw size={19} /> My power is back</button>
      </section>

      <section className="card explanation">
        <h3>How PowerPulse works</h3>
        <p>One report is a signal. Multiple independent reports from an area can confirm an incident. Exact household locations are never shown publicly.</p>
      </section>

      <footer>Community reported data · Not an official utility outage source</footer>
    </main>
  );
}
