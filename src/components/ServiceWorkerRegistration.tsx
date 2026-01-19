'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration Component
 * Registers the service worker for push notifications
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if browser supports service workers
    if ('serviceWorker' in navigator) {
      // First, unregister all existing service workers to clear cache
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          // Unregister old service workers to force fresh load
          registration.unregister().then((success) => {
            if (success) {
              console.log('🗑️ Old service worker unregistered');
            }
          });
        });
      });

      // Then register the new one
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);
          // Force update check
          registration.update();
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }
  }, []);

  return null; // This component doesn't render anything
}

