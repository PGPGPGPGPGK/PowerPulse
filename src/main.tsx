import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createRepository } from './services/createRepository';
import './styles.css';

// The data source is resolved once - anonymous sign-in and the first Firestore
// snapshot happen before the first render, so no screen flashes empty.
// A minimal static-shell worker: it makes the app reliably installable and
// caches only hashed build assets. Registered in production builds only, so it
// never interferes with the dev server.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.error('PowerPulse: service worker not registered', error));
  });
}

createRepository().then((repository) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App repository={repository} />
    </React.StrictMode>,
  );
});
