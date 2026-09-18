import { useEffect, useRef } from 'react';
import { LegalLink } from './LegalLinks';

/**
 * Shown once per legal version, immediately before a person's first community
 * observation. It asks for a confirmation, not for information: no date of
 * birth, no identity document, no name, email or phone, and no parental
 * consent flow.
 */
export function LegalGate({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  const confirmButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="legalGate" role="presentation" onClick={onCancel}>
      <div
        className="legalGate__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legalGateTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="legalGateTitle">Before you report</h2>

        <p>PowerPulse community reporting is available to people aged 18 or older.</p>
        <p>
          By continuing, you confirm that you are at least 18 years old and agree to the{' '}
          <LegalLink page="terms" /> and <LegalLink page="privacy" />.
        </p>

        <div className="legalGate__actions">
          <button ref={confirmButton} type="button" className="btn btn--primary" onClick={onAccept}>
            I&rsquo;m 18 or older — continue
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
