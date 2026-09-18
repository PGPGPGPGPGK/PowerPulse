import { Bolt, Check, HelpCircle, RotateCcw } from 'lucide-react';
import type { MyReportState } from '../services/outageRepository';
import { RECONFIRM_AFTER_HOURS } from '../features/outages/deriveIncidents';

/**
 * What the user can do next, driven by their own latest report for this
 * incident - not by the community status.
 *
 * Once their observation has gone stale (`due`) the same two actions are
 * raised into an explicit question. Before that the app stays quiet: the
 * buttons are there, but nobody is being nagged.
 */
export function ReportActions({
  myState,
  onReport,
  onStillOut,
  onRestored,
}: {
  myState: MyReportState;
  onReport: () => void;
  onStillOut?: () => void;
  onRestored?: () => void;
}) {
  if (myState === 'restored') {
    return (
      <p className="myState" aria-live="polite">
        <Check size={18} aria-hidden="true" /> You reported that your power is back
      </p>
    );
  }

  if (myState === 'due') {
    return (
      <section className="reconfirm" aria-live="polite">
        <p className="reconfirm__question">
          <HelpCircle size={18} aria-hidden="true" /> Is your power still out?
        </p>
        <p className="note">
          It has been over {RECONFIRM_AFTER_HOURS} hours since you last told us. Answering keeps the
          status useful for your neighbours.
        </p>
        <div className="actions__row">
          <button type="button" className="btn btn--primary" onClick={onStillOut}>
            <Bolt size={18} aria-hidden="true" /> Still out
          </button>
          <button type="button" className="btn btn--ghost" onClick={onRestored}>
            <RotateCcw size={18} aria-hidden="true" /> Power is back
          </button>
        </div>
      </section>
    );
  }

  if (myState === 'reported') {
    return (
      <div className="actions">
        <p className="myState" aria-live="polite">
          <Check size={18} aria-hidden="true" /> You have reported this outage
        </p>
        <div className="actions__row">
          <button type="button" className="btn btn--ghost" onClick={onStillOut}>
            Still out
          </button>
          <button type="button" className="btn btn--primary" onClick={onRestored}>
            <RotateCcw size={18} aria-hidden="true" /> My power is back
          </button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="btn btn--primary btn--lg" onClick={onReport}>
      <Bolt size={20} aria-hidden="true" /> My power is out
    </button>
  );
}
