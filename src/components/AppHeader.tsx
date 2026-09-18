import { Bolt, ChevronLeft } from 'lucide-react';

/** App bar. Shows a back affordance on secondary screens. */
export function AppHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <header className="appHeader">
      {onBack ? (
        <button type="button" className="iconButton" onClick={onBack} aria-label="Go back">
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
      ) : (
        <span className="appHeader__mark" aria-hidden="true">
          <Bolt size={20} />
        </span>
      )}

      <div className="appHeader__text">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
}
