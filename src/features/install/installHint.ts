/**
 * Rules for the "add to home screen" suggestion.
 *
 * Free of React and browser globals so they can be checked with
 * `npm run check`. Everything here stays in this browser: no analytics, no
 * install tracking, no Firestore write, no identity.
 */

export const INSTALL_HINT_KEY = 'powerpulseInstallHint';

/** How long a dismissal is respected before the suggestion may return. */
export const DISMISS_DAYS = 7;

/**
 * The only thing worth persisting is when the person last said "Not now".
 *
 * Installation is NOT recorded: a browser cannot reliably observe an
 * uninstall, so a stored flag would suppress the suggestion forever for
 * someone who removed the app. Installed state is detected at runtime instead.
 */
export interface InstallHintState {
  /** ISO timestamp of the last "Not now", if any. */
  dismissedAt?: string;
}

/** Minimal storage surface, so this is testable without a browser. */
export interface HintStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function browserHintStore(): HintStore | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function readHintState(store: HintStore | undefined): InstallHintState {
  if (!store) return {};
  try {
    const raw = store.getItem(INSTALL_HINT_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const value = parsed as InstallHintState;
    return { dismissedAt: typeof value.dismissedAt === 'string' ? value.dismissedAt : undefined };
  } catch {
    return {};
  }
}

function write(store: HintStore | undefined, state: InstallHintState): void {
  if (!store) return;
  try {
    store.setItem(INSTALL_HINT_KEY, JSON.stringify(state));
  } catch {
    // A browser that refuses storage simply asks again another day.
  }
}

export function recordDismissal(store: HintStore | undefined, now = Date.now()): void {
  write(store, { dismissedAt: new Date(now).toISOString() });
}

/** True while a recent dismissal should keep the card away. */
export function isHintSuppressed(store: HintStore | undefined, now = Date.now()): boolean {
  const state = readHintState(store);
  if (!state.dismissedAt) return false;

  const dismissed = new Date(state.dismissedAt).getTime();
  if (Number.isNaN(dismissed)) return false;
  return now - dismissed < DISMISS_DAYS * 24 * 3_600_000;
}

/**
 * iOS and iPadOS, where `beforeinstallprompt` does not exist and installing is
 * a manual Share-sheet action. Deliberately coarse: platform and touch points
 * only, nothing that identifies a device.
 */
export function isIosLike(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS reports a desktop Mac user agent, but a Mac has no touch screen.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** Already running as an installed app, by either platform's signal. */
export function isStandalone(displayModeStandalone: boolean, iosStandalone?: boolean): boolean {
  return displayModeStandalone || iosStandalone === true;
}

export type InstallHint = 'none' | 'prompt' | 'ios-instructions';

/**
 * The single decision: what, if anything, to suggest.
 *
 * Installed apps are never nagged, a recent dismissal is respected, Chromium
 * gets the real prompt only when the browser has said it is installable, and
 * iOS gets instructions because nothing else is possible there.
 */
export function chooseInstallHint(input: {
  standalone: boolean;
  suppressed: boolean;
  canPrompt: boolean;
  iosLike: boolean;
}): InstallHint {
  if (input.standalone || input.suppressed) return 'none';
  if (input.canPrompt) return 'prompt';
  return input.iosLike ? 'ios-instructions' : 'none';
}
