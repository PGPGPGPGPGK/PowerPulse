import { ExternalLink } from 'lucide-react';
import type { LegalPage } from '../features/legal/legal';
import { LEGAL_PAGES, legalPageUrl } from '../features/legal/legal';

/**
 * Links to the static legal pages in `public/`.
 *
 * URLs are built from the app's base path, so they resolve at `/` locally and
 * under `/PowerPulse/` on GitHub Pages. The full text lives in those pages and
 * is never duplicated in React.
 */

const order: LegalPage[] = ['privacy', 'terms', 'storage', 'feedback'];

export const legalHref = (page: LegalPage): string =>
  legalPageUrl(page, import.meta.env.BASE_URL);

/** A single inline link, for use inside sentences. */
export function LegalLink({ page, children }: { page: LegalPage; children?: React.ReactNode }) {
  return <a href={legalHref(page)}>{children ?? LEGAL_PAGES[page].label}</a>;
}

/** Tappable rows, for the profile screen. */
export function LegalLinkRows() {
  return (
    <ul className="legalRows">
      {order.map((page) => (
        <li key={page}>
          <a href={legalHref(page)}>
            <span>{LEGAL_PAGES[page].label}</span>
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** One quiet line at the bottom of the app. */
export function LegalFooter() {
  return (
    <footer className="legalFooter">
      {order.map((page, index) => (
        <span key={page}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          <a href={legalHref(page)}>{LEGAL_PAGES[page].short}</a>
        </span>
      ))}
    </footer>
  );
}
