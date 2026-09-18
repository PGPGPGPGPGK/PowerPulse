import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { createRepository } from './services/createRepository';
import './styles.css';

// The data source is resolved once - anonymous sign-in and the first Firestore
// snapshot happen before the first render, so no screen flashes empty.
createRepository().then((repository) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App repository={repository} />
    </React.StrictMode>,
  );
});
