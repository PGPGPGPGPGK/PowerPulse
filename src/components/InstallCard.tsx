import { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useInstallPrompt } from '../features/install/useInstallPrompt';

/**
 * A small, dismissible suggestion to keep PowerPulse one tap away during an
 * outage. It never blocks anything and never appears over the reporting flow.
 *
 * No browser lets a page install itself silently: on Chromium this opens the
 * browser's own dialog from the button below, and on iOS it can only explain
 * where the Share button is.
 */
export function InstallCard() {
  const { hint, install, dismiss } = useInstallPrompt();
  const [showingSteps, setShowingSteps] = useState(false);

  if (hint === 'none') return null;

  return (
    <section className="installCard">
      <button type="button" className="installCard__close" onClick={dismiss} aria-label="Not now">
        <X size={16} aria-hidden="true" />
      </button>

      <p className="installCard__title">
        Add PowerPulse to your Home Screen for quick access during an outage.
      </p>

      {hint === 'prompt' ? (
        <div className="installCard__actions">
          <button type="button" className="btn btn--primary btn--sm" onClick={() => void install()}>
            <Download size={16} aria-hidden="true" /> Add to Home Screen
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={dismiss}>
            Not now
          </button>
        </div>
      ) : showingSteps ? (
        <ol className="installCard__steps">
          <li>
            Tap the Share button <Share size={14} aria-hidden="true" /> in Safari
          </li>
          <li>Choose &ldquo;Add to Home Screen&rdquo;</li>
          <li>Tap &ldquo;Add&rdquo;</li>
        </ol>
      ) : (
        <div className="installCard__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => setShowingSteps(true)}
          >
            <Share size={16} aria-hidden="true" /> Show me how
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={dismiss}>
            Not now
          </button>
        </div>
      )}
    </section>
  );
}
