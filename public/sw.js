/**
 * Service Worker for PWA functionality with push notifications and background sync.
 */

// Configure backend URL (change this when deploying)
const BACKEND_URL = 'https://forestproject-backend-production.up.railway.app';
const CACHE_NAME = 'env-monitor-v1';

// Assets to cache for offline support
const urlsToCache = [
  '/',
  '/manifest.json',
  '/pushService.js',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

/**
 * Determines if a URL should be routed to the backend.
 * SSE requests (subscribe=true) are bypassed.
 * @param {string} url
 * @returns {boolean}
 */
function isBackendRequest(url) {
  const paths = ['/inputData'];
  const urlObj = new URL(url);
  const urlPath = urlObj.pathname;
  
  // Bypass SSE connections
  if (
    urlPath.startsWith('/inputData') &&
    (urlObj.searchParams.has('subscribe') || url.includes('subscribe=true'))
  ) {
    return false;
  }
  
  return paths.some(path => urlPath.startsWith(path));
}

/**
 * Rewrites URLs to point to the backend.
 * @param {string} url
 * @returns {string}
 */
function rewriteUrlIfNeeded(url) {
  if (isBackendRequest(url)) {
    const urlObj = new URL(url);
    return `${BACKEND_URL}${urlObj.pathname}${urlObj.search}`;
  }
  return url;
}

// INSTALL: Cache frontend assets and immediately activate new SW.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// ACTIVATE: Clean up old caches and take control of clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames =>
        Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        )
      ),
      self.clients.claim()
    ])
  );
});

// FETCH: Route backend requests to the backend URL; otherwise use cache-first.
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;
  
  // Bypass service worker for SSE connections.
  if (requestUrl.includes('subscribe=true')) {
    return;
  }
  
  if (isBackendRequest(requestUrl)) {
    const backendUrl = rewriteUrlIfNeeded(requestUrl);
    event.respondWith(
      fetch(backendUrl, {
        method: event.request.method,
        headers: event.request.headers,
        body: event.request.method !== 'GET' ? event.request.clone().body : undefined,
        mode: 'cors',
        credentials: 'same-origin'
      }).catch(error => {
        console.error('Backend fetch failed:', error);
        // For POST requests, try queueing data for sync.
        if (event.request.method === 'POST' && requestUrl.includes('/inputData')) {
          return event.request.clone().json().then(data =>
            queueDataForSync(data).then(() =>
              new Response(JSON.stringify({
                success: true,
                message: 'Data saved for sync when online'
              }), {
                headers: { 'Content-Type': 'application/json' }
              })
            )
          );
        }
        return new Response(JSON.stringify({
          error: 'Network error, please try again later'
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // Use a cache-first strategy for other requests.
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(networkResponse => {
        // Only cache valid responses.
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Optionally, return a fallback response.
      });
    })
  );
});

/**
 * Queue data for background sync using IndexedDB.
 * @param {any} data
 */
async function queueDataForSync(data) {
  try {
    const db = await openDB('environmentalData', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        }
      }
    });
    return db.add('outbox', { ...data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Failed to queue data for sync:', error);
    throw error;
  }
}

// BACKGROUND SYNC: Process queued data when connectivity is restored.
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-environmental-data') {
    event.waitUntil(syncEnvironmentalData());
  }
});

async function syncEnvironmentalData() {
  try {
    const db = await openDB('environmentalData', 1);
    const offlineData = await db.getAll('outbox');
    for (const data of offlineData) {
      try {
        const response = await fetch(`${BACKEND_URL}/inputData`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (response.ok) {
          await db.delete('outbox', data.id);
        }
      } catch (error) {
        console.error('Failed to sync data:', error);
      }
    }
  } catch (error) {
    console.error('Error accessing IndexedDB:', error);
  }
}

// PUSH EVENT: Handle incoming push notifications.
self.addEventListener('push', (event) => {
  // Default notification options.
  let notificationData = {
    title: 'Environmental Alert',
    body: 'New environmental alert detected!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'environmental-alert',
    data: { url: '/' }
  };

  // If a payload is provided, merge it with the default.
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      console.error('Error parsing push notification data:', e);
    }
  }

  // Set vibration pattern based on danger level.
  if (notificationData.dangerLevel === 'extreme' || notificationData.dangerLevel === 'high') {
    notificationData.vibrate = [100, 50, 100, 50, 100, 50, 200];
  } else if (notificationData.dangerLevel === 'medium') {
    notificationData.vibrate = [100, 50, 100];
  }
  
  // Use ServiceWorkerRegistration.showNotification() to display the notification.
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .catch(err => console.error('Error showing notification:', err))
  );
});

// NOTIFICATION CLICK: Handle user clicks on notifications.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if ('url' in client && client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

// PERIODIC BACKGROUND SYNC: Perform environmental checks.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'environmental-check') {
    event.waitUntil(performEnvironmentalCheck());
  }
});

async function performEnvironmentalCheck() {
  if ('geolocation' in self) {
    try {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const response = await fetch(`${BACKEND_URL}/inputData`);
        if (!response.ok) return;
        const data = await response.json();
        const dangerZones = data.dangerZones || [];
        for (const zone of dangerZones) {
          const distance = calculateDistance(
            latitude,
            longitude,
            zone.location.lat,
            zone.location.lng
          );
          if (distance < 7) {
            const notificationTitle = distance < 5
              ? '⚠️ You are in a danger zone!'
              : '⚡ You are approaching a danger zone';
            const notificationBody = distance < 5
              ? `You are currently inside a ${zone.dangerLevel} risk area. Take necessary precautions.`
              : `You are ${Math.round(distance - 5)}km from a ${zone.dangerLevel} risk area. Be alert.`;
            await self.registration.showNotification(notificationTitle, {
              body: notificationBody,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
              tag: 'proximity-alert',
              data: { url: '/', zoneId: zone.id },
              vibrate: distance < 5 ? [100, 50, 100, 50, 200] : [100, 50, 100]
            });
            break;
          }
        }
      });
    } catch (error) {
      console.error('Error performing background check:', error);
    }
  }
}

/**
 * Calculates the Haversine distance between two latitude/longitude points.
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {number} Distance in kilometers.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Converts degrees to radians.
 * @param {number} deg 
 * @returns {number}
 */
function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Simple wrapper for opening an IndexedDB database.
 * @param {string} name 
 * @param {number} version 
 * @param {Function} upgradeCallback 
 * @returns {Promise<any>}
 */
function openDB(name, version, upgradeCallback) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    if (upgradeCallback) {
      request.onupgradeneeded = (event) => {
        upgradeCallback(event.target.result);
      };
    }
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}
