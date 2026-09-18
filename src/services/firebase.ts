import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

/**
 * Firebase bootstrap: web config from environment variables, anonymous sign-in,
 * Firestore handle.
 *
 * The Firebase web config is public browser configuration, not a secret, but it
 * still differs per deployment environment, so it is read from `.env` files and
 * never committed. No service-account credential ever belongs in this app.
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True when every required config value is present. */
export const isFirebaseConfigured = (): boolean =>
  Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);

export interface FirebaseContext {
  app: FirebaseApp;
  db: Firestore;
  /** The anonymous user's UID. This is the `userId` on every report. */
  uid: string;
}

/**
 * Signs in anonymously (no registration UI, per Phase 1) and returns the
 * handles the Firestore repository needs.
 */
export async function connectFirebase(): Promise<FirebaseContext> {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const credential = await signInAnonymously(auth);
  return { app, db: getFirestore(app), uid: credential.user.uid };
}
