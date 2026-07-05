const CACHE_NAME = 'sapekkho-v12';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.svg',
  './logo.png',
  'https://unpkg.com/react@18/umd/react.development.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@300;400;500;600;700&display=swap'
];

// Install Event - Caching Assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Pre-caching offline assets');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale While Revalidate Caching Strategy
self.addEventListener('fetch', event => {
  // Only cache GET requests and bypass other protocols (e.g. chrome-extension://)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin) && !event.request.url.startsWith('https://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      }).catch(() => {
        // Silent catch for network errors when offline
      });

      return cachedResponse || fetchPromise;
    })
  );
});

// Notification Click Handler - Action buttons ("Mark Done")
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const taskId = event.notification.tag;

  if (event.action === 'complete-action' && taskId) {
    // Send a message to clients to complete the task
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        let messaged = false;
        for (const client of clients) {
          client.postMessage({ type: 'COMPLETE_TASK', taskId: taskId });
          messaged = true;
        }
        // Focus client if open
        for (const client of clients) {
          if (client.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (!messaged && self.clients.openWindow) {
          return self.clients.openWindow('./');
        }
      })
    );
  } else {
    // Standard click - Open or Focus the app window
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        for (const client of clients) {
          if (client.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('./');
        }
      })
    );
  }
});
