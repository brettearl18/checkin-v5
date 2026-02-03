/**
 * Service Worker for Push Notifications
 * Handles push events and notification clicks
 */

const CACHE_NAME = 'vana-checkin-v3';
const urlsToCache = [
  '/',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache static assets ONLY (not JavaScript)
self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event - DON'T cache JavaScript files, let them load fresh
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Don't cache JavaScript or CSS files - always fetch fresh
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.includes('/_next/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Only fallback to cache if network fails
        return caches.match(event.request);
      })
    );
    return;
  }
  
  // For other resources, check cache first
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});

// Push event - show notification when push is received
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: 'Vana Check-In',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'vana-notification',
    requireInteraction: false,
    data: {
      url: '/client-portal'
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || notificationData.tag,
        requireInteraction: data.requireInteraction !== undefined ? data.requireInteraction : notificationData.requireInteraction,
        data: {
          url: data.url || data.data?.url || notificationData.data.url
        }
      };
    } catch (e) {
      // If not JSON, treat as plain text
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      actions: [
        {
          action: 'open',
          title: 'View'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ]
    })
  );
});

// Notification click event - navigate to action URL
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Default action or 'open' action
  const urlToOpen = event.notification.data?.url || '/client-portal';
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no existing window, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

