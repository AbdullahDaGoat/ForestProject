// Service Worker for PWA functionality

// Configure backend URL - change this when deploying
const BACKEND_URL = 'http://localhost:4000';
const CACHE_NAME = 'env-monitor-v1';

// Frontend assets to cache
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
  // Note: Removed '/inputData' since it's now part of the backend
];

// Helper function to determine if a request should be routed to the backend
function isBackendRequest(url) {
  const paths = ['/inputData', '/dangerZones'];
  const urlPath = new URL(url).pathname;
  return paths.some(path => urlPath.startsWith(path));
}

// Helper to rewrite URLs to the backend when needed
function rewriteUrlIfNeeded(url) {
  if (isBackendRequest(url)) {
    const urlObj = new URL(url);
    return `${BACKEND_URL}${urlObj.pathname}${urlObj.search}`;
  }
  return url;
}

// Install event - cache assets and activate new SW immediately
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting SW to become active
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim() // Take control of uncontrolled clients
    ])
  );
});

// Fetch event - handle routing to backend when needed
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // If this is a backend request, rewrite the URL
  if (isBackendRequest(url)) {
    const backendUrl = rewriteUrlIfNeeded(url);
    
    event.respondWith(
      fetch(backendUrl, {
        method: event.request.method,
        headers: event.request.headers,
        body: event.request.method !== 'GET' ? event.request.clone().body : undefined,
        mode: 'cors',
        credentials: 'include'
      }).catch(error => {
        console.error('Backend fetch failed:', error);
        // Queue data for sync if it's a POST request
        if (event.request.method === 'POST' && url.includes('/inputData')) {
          return event.request.clone().json().then(data => {
            return queueDataForSync(data).then(() => {
              return new Response(JSON.stringify({ 
                success: true, 
                message: 'Data saved for sync when online'
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            });
          });
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
  
  // Standard cache-first strategy for frontend assets
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        return response;
      }
      // Otherwise, fetch from network
      return fetch(event.request).then((networkResponse) => {
        // Validate response before caching
        if (
          !networkResponse ||
          networkResponse.status !== 200 ||
          networkResponse.type !== 'basic'
        ) {
          return networkResponse;
        }
        // Clone response so one copy can be cached
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Optionally, return a fallback page for offline situations
      });
    })
  );
});

// Function to queue data for sync
async function queueDataForSync(data) {
  try {
    const db = await openDB('environmentalData', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        }
      }
    });
    
    return db.add('outbox', {
      ...data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to queue data for sync:', error);
    throw error;
  }
}

// Background sync for offline data submission
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-environmental-data') {
    event.waitUntil(syncEnvironmentalData());
  }
});

// Function to sync queued data
async function syncEnvironmentalData() {
  try {
    const db = await openDB('environmentalData', 1);
    const offlineData = await db.getAll('outbox');
    
    for (const data of offlineData) {
      try {
        const response = await fetch(`${BACKEND_URL}/inputData`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
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

// Push notification event handler
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Environmental Alert',
    body: 'New environmental alert detected!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'environmental-alert',
    data: {
      url: '/'
    }
  };

  // Try to parse the push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data
      };
    } catch (e) {
      console.error('Error parsing push notification data:', e);
    }
  }

  // Set vibration pattern based on danger level
  if (notificationData.dangerLevel === 'extreme' || notificationData.dangerLevel === 'high') {
    notificationData.vibrate = [100, 50, 100, 50, 100, 50, 200];
  } else if (notificationData.dangerLevel === 'medium') {
    notificationData.vibrate = [100, 50, 100];
  }

  // Show notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // This looks to see if the current is already open and focuses it
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

// Periodic background sync for regular environmental checks
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'environmental-check') {
    event.waitUntil(performEnvironmentalCheck());
  }
});

// Function to perform a background check of user's location against danger zones
async function performEnvironmentalCheck() {
  if ('geolocation' in self) {
    try {
      // Get user's current position
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Fetch current danger zones from backend
        const response = await fetch(`${BACKEND_URL}/dangerZones`);
        if (!response.ok) return;
        
        const { dangerZones } = await response.json();
        
        // Check if user is near any danger zone
        for (const zone of dangerZones) {
          const distance = calculateDistance(
            latitude, 
            longitude, 
            zone.location.lat, 
            zone.location.lng
          );
          
          // If within 2km of a 5km danger zone, show notification
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
              data: {
                url: '/',
                zoneId: zone.id
              },
              vibrate: distance < 5 ? [100, 50, 100, 50, 200] : [100, 50, 100]
            });
            
            // Only notify about the closest danger zone
            break;
          }
        }
      });
    } catch (error) {
      console.error('Error performing background check:', error);
    }
  }
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; // Distance in km
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Helper function for IndexedDB operations
function openDB(name, version, upgradeCallback) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    if (upgradeCallback) {
      request.onupgradeneeded = event => {
        upgradeCallback(event.target.result);
      };
    }
    
    request.onsuccess = event => {
      resolve(event.target.result);
    };
    
    request.onerror = event => {
      reject(event.target.error);
    };
  });
}