import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker: registers in production only. When an updated worker is
// waiting, App shows an update banner; tapping it posts SKIP_WAITING and the
// controllerchange below reloads into the new version (Dukandar pattern).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        const notify = () => window.dispatchEvent(new Event('sw-update-available'));
        if (registration.waiting && navigator.serviceWorker.controller) {
          notify();
        }
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              notify();
            }
          });
        });
      })
      .catch((err) => {
        console.warn('Service worker registration failed', err);
      });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}
