import { useEffect, useState } from 'react';
import {
  browserHintStore,
  chooseInstallHint,
  isHintSuppressed,
  isIosLike,
  isStandalone,
  recordDismissal,
} from './installHint';
import type { InstallHint } from './installHint';

/**
 * Wires the browser's install signals to the rules in `installHint`.
 *
 * A page cannot add itself to a home screen: on Chromium the native prompt
 * only opens from a user gesture, and on iOS it does not exist at all. This
 * hook therefore either holds the browser's own prompt event until the person
 * asks for it, or falls back to telling them where the Share button is.
 *
 * Installed state is always detected at runtime - display mode, iOS standalone,
 * or an `appinstalled` event in this session. Nothing about installation is
 * persisted, so someone who uninstalls becomes eligible for the suggestion
 * again instead of being silenced for good.
 */

/** Chromium's event. Not in the DOM typings. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standaloneNow = (): boolean => {
  if (typeof window === 'undefined') return false;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  // iOS marks installed apps on the navigator instead.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone;
  return isStandalone(displayMode, iosStandalone);
};

export interface InstallPromptState {
  hint: InstallHint;
  /** Opens the browser's own install dialog. Chromium only, user-gesture only. */
  install: () => Promise<void>;
  /** "Not now": remembered locally for a week. */
  dismiss: () => void;
}

export function useInstallPrompt(): InstallPromptState {
  const store = browserHintStore();
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(standaloneNow);
  const [suppressed, setSuppressed] = useState(() => isHintSuppressed(store));
  // Session-only: hides the card the moment the app is installed, without
  // writing anything that would outlive an uninstall.
  const [installedThisSession, setInstalledThisSession] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Hold the event so the mini-infobar does not appear; the card below is
      // shown instead and only a click opens the real dialog.
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setPromptEvent(null);
      setInstalledThisSession(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // Catches an install that happens while the tab stays open.
    const displayMode = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayModeChange = () => setStandalone(standaloneNow());
    displayMode?.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode?.removeEventListener('change', onDisplayModeChange);
    };
  }, [store]);

  const hint = chooseInstallHint({
    standalone: standalone || installedThisSession,
    suppressed,
    canPrompt: promptEvent !== null,
    iosLike:
      typeof navigator !== 'undefined' &&
      isIosLike(navigator.userAgent, navigator.maxTouchPoints ?? 0),
  });

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    // The event can only be used once, whatever the answer.
    setPromptEvent(null);
    if (outcome === 'accepted') {
      // `appinstalled` normally follows; this covers browsers that skip it.
      setInstalledThisSession(true);
    } else {
      recordDismissal(store);
      setSuppressed(true);
    }
  };

  const dismiss = () => {
    recordDismissal(store);
    setSuppressed(true);
  };

  return { hint, install, dismiss };
}
