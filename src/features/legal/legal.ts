/**
 * Legal acknowledgement and the links to the static legal pages.
 *
 * Deliberately free of React, `import.meta` and browser globals so the rules
 * can be checked directly with `npm run check`. Callers pass in the base URL
 * and a storage object.
 *
 * Acceptance is a LOCAL fact about this browser. It is never sent to Firestore,
 * never attached to the anonymous Firebase UID, and records nothing about the
 * person: no date of birth, no identity, no contact details.
 */

/**
 * Bumped whenever the published legal pages change materially. The value
 * matches the effective date printed on those pages; changing it makes every
 * browser acknowledge again.
 */
export const LEGAL_VERSION = '2026-09-18';

/** Key in the browser's local storage. */
export const LEGAL_STORAGE_KEY = 'powerpulseLegalAcceptance';

export interface LegalAcceptance {
  accepted: boolean;
  legalVersion: string;
}

/** The static pages published under `public/`. */
export const LEGAL_PAGES = {
  privacy: { file: 'privacy.html', label: 'Privacy Policy', short: 'Privacy' },
  terms: { file: 'terms.html', label: 'Terms of Use', short: 'Terms' },
  storage: { file: 'data-storage.html', label: 'Data & Browser Storage', short: 'Data & Storage' },
  feedback: { file: 'feedback.html', label: 'Feedback & Contact', short: 'Feedback' },
} as const;

export type LegalPage = keyof typeof LEGAL_PAGES;

/**
 * Builds a page URL from the app's base path, so links work both at `/` in
 * development and under `/PowerPulse/` (or any fork's base) on GitHub Pages.
 * Never produces a root-absolute `/privacy.html`.
 */
export function legalPageUrl(page: LegalPage, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${LEGAL_PAGES[page].file}`;
}

/** Minimal storage surface, so this is testable without a browser. */
export interface LegalStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The browser's local storage, or undefined where it is unavailable. */
export function browserLegalStore(): LegalStore | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    // Storage can throw outright in some privacy modes.
    return undefined;
  }
}

export function readAcceptance(store: LegalStore | undefined): LegalAcceptance | null {
  if (!store) return null;
  try {
    const raw = store.getItem(LEGAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const value = parsed as Partial<LegalAcceptance>;
    if (typeof value.accepted !== 'boolean' || typeof value.legalVersion !== 'string') return null;
    return { accepted: value.accepted, legalVersion: value.legalVersion };
  } catch {
    return null;
  }
}

/** True only for an acceptance of the version currently published. */
export function hasAcceptedCurrentLegal(
  store: LegalStore | undefined,
  version: string = LEGAL_VERSION,
): boolean {
  const acceptance = readAcceptance(store);
  return acceptance?.accepted === true && acceptance.legalVersion === version;
}

/** Exactly what is stored. Nothing identifying, by construction. */
export function acceptanceRecord(version: string = LEGAL_VERSION): LegalAcceptance {
  return { accepted: true, legalVersion: version };
}

export function writeAcceptance(
  store: LegalStore | undefined,
  version: string = LEGAL_VERSION,
): void {
  if (!store) return;
  try {
    store.setItem(LEGAL_STORAGE_KEY, JSON.stringify(acceptanceRecord(version)));
  } catch {
    // A browser that refuses storage simply asks again next time.
  }
}

/**
 * The gate every user-created observation passes through: outage, still_out
 * and restored alike. When the current legal version has been acknowledged the
 * action runs straight away; otherwise it is handed to the prompt and runs only
 * if the person accepts.
 */
export function gateReportAction(
  hasAccepted: boolean,
  action: () => void,
  prompt: (pendingAction: () => void) => void,
): void {
  if (hasAccepted) action();
  else prompt(action);
}
