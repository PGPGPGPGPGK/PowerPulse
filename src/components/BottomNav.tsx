import { Clock, Home, Map, User } from 'lucide-react';
import type { Route } from '../types/outage';

const tabs = [
  { name: 'home', label: 'Home', Icon: Home },
  { name: 'map', label: 'Map', Icon: Map },
  { name: 'history', label: 'History', Icon: Clock },
  { name: 'profile', label: 'Profile', Icon: User },
] as const;

/** Primary mobile navigation. Becomes a rail on wide screens via CSS. */
export function BottomNav({
  current,
  onNavigate,
}: {
  current: Route['name'];
  onNavigate: (route: Route) => void;
}) {
  return (
    <nav className="bottomNav" aria-label="Main">
      {tabs.map(({ name, label, Icon }) => {
        const active = current === name;
        return (
          <button
            key={name}
            type="button"
            className={`bottomNav__tab${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate({ name } as Route)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
