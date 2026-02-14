'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * Unregisters any existing service workers so the app always loads fresh code.
 * Re-enable registration here when sw.js is stable and you need push notifications.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
    }
  }, []);

  return null;
}

