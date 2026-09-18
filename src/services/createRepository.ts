import type { OutageRepository } from './outageRepository';
import { mockOutageRepository } from './mockOutageRepository';
import { connectFirebase, isFirebaseConfigured } from './firebase';
import { FirebaseOutageRepository } from './firebaseOutageRepository';

/**
 * Picks the data source once, at startup.
 *
 * Firestore is used when the Firebase environment variables are present and
 * `VITE_DATA_SOURCE` is not set to `mock`. Anything missing or failing falls
 * back to the demo repository, and the UI says which one is live.
 */
export async function createRepository(): Promise<OutageRepository> {
  if (import.meta.env.VITE_DATA_SOURCE === 'mock' || !isFirebaseConfigured()) {
    return mockOutageRepository;
  }

  try {
    const context = await connectFirebase();
    const repository = new FirebaseOutageRepository(context);
    await repository.start();
    return repository;
  } catch (error) {
    console.error('PowerPulse: Firebase unavailable, using demo data instead', error);
    return mockOutageRepository;
  }
}
