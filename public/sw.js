/**
 * Fully Refactored Service Worker for PWA functionality.
 * - Uses self.registration.showNotification() to display notifications.
 * - Instead of directly calling geolocation (which causes violations), it
 *   sends a message to the client requesting location data.
 * - Rewrites backend requests to your configured BACKEND_URL.
 */

// Configuration
const BACKEND_URL = 'https://forestproject-backend-production.up.railway.app';
const CACHE_NAME = 'env-monitor-v1';
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
 * Checks if a URL should be routed to the backend.
 */
function isBackendRequest(url) {
  const paths = ['/inputData'];
  const urlObj = new URL(url);
  const urlPath = urlObj.pathname;
  // Do not intercept SSE requests
  if (urlPath.startsWith('/inputData') && (urlObj.searchParams.has('subscribe') || url.includes('subscribe=true'))) {
    return false;
  }
  return paths.some(path => urlPath.startsWith(path));
}

/**
 * Rewrites a URL to point to the backend.
 */
function rewriteUrlIfNeeded(url) {
  if (isBackendRequest(url)) {
    const urlObj = new URL(url);
    return `${BACKEND_URL}${urlObj.pathname}${urlObj.search}`;
  }
  return url;
}

// INSTALL: Cache essential frontend assets.
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

// ACTIVATE: Clean up old caches and claim clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
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

// FETCH: For backend requests, rewrite URL; otherwise use cache-first.
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;
  // Bypass SSE connections.
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
      }).catch((error) => {
        console.error('Backend fetch failed:', error);
        // For POST requests, queue data for background sync.
        if (event.request.method === 'POST' && requestUrl.includes('/inputData')) {
          return event.request.clone().json().then((data) => {
            return queueDataForSync(data).then(() => {
              return new Response(
                JSON.stringify({
                  success: true,
                  message: 'Data saved for sync when online'
                }),
                { headers: { 'Content-Type': 'application/json' } }
              );
            });
          });
        }
        return new Response(
          JSON.stringify({ error: 'Network error, please try again later' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }
  // For other requests, use a cache-first strategy.
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Optionally, you can return a fallback response.
      });
    })
  );
});

// IndexedDB helper: Open a database.
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

// Queue data for background sync.
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
  let notificationData = {
    title: 'Environmental Alert',
    body: 'New environmental alert detected!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'environmental-alert',
    data: { url: '/' }
  };
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      console.error('Error parsing push notification data:', e);
    }
  }
  if (notificationData.dangerLevel === 'extreme' || notificationData.dangerLevel === 'high') {
    notificationData.vibrate = [100, 50, 100, 50, 100, 50, 200];
  } else if (notificationData.dangerLevel === 'medium') {
    notificationData.vibrate = [100, 50, 100];
  }
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
      .catch(err => console.error('Error showing notification:', err))
  );
});

// NOTIFICATION CLICK: Handle user clicks on notifications.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
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

// PERIODIC SYNC: Instead of directly accessing geolocation in SW,
// send a message to the client requesting location data.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'environmental-check') {
    event.waitUntil(performEnvironmentalCheck());
  }
});

async function performEnvironmentalCheck() {
  try {
    const allClients = await self.clients.matchAll();
    if (allClients.length > 0) {
      // Send a message to the first client to request location.
      allClients[0].postMessage({ type: 'REQUEST_LOCATION' });
    }
  } catch (error) {
    console.error('Error performing background check:', error);
  }
}

// Listen for messages from clients.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'LOCATION_DATA') {
    const { latitude, longitude } = event.data;
    checkDangerZones(latitude, longitude);
  }
});

// Check danger zones given the user's location.
async function checkDangerZones(latitude, longitude) {
  try {
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
  } catch (error) {
    console.error('Error checking danger zones:', error);
  }
}

/**
 * Calculates the Haversine distance between two points (in km).
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
