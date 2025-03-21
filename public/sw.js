// /**
//  * Fully Refactored Service Worker for PWA functionality.
//  * - Uses self.registration.showNotification() to display notifications.
//  * - Instead of directly calling geolocation, it sends a message to the client requesting location data.
//  * - Rewrites backend requests to your configured BACKEND_URL.
//  */

// // Configuration
// const BACKEND_URL = 'https://forestproject-backend-production.up.railway.app';
// const CACHE_NAME = 'env-monitor-v1';
// const urlsToCache = [
//   '/',
//   '/manifest.json',
//   '/pushService.js',
//   '/icons/icon-72x72.png',
//   '/icons/icon-96x96.png',
//   '/icons/icon-128x128.png',
//   '/icons/icon-144x144.png',
//   '/icons/icon-152x152.png',
//   '/icons/icon-192x192.png',
//   '/icons/icon-512x512.png'
// ];

// console.log('[SW] Service Worker script executing...');

// /**
//  * Checks if a URL should be routed to the backend.
//  */
// function isBackendRequest(url) {
//   const paths = ['/inputData'];
//   const urlObj = new URL(url);
//   const urlPath = urlObj.pathname;
//   // Do not intercept SSE requests
//   if (urlPath.startsWith('/inputData') && (urlObj.searchParams.has('subscribe') || url.includes('subscribe=true'))) {
//     console.log('[SW] Bypassing backend interception for SSE request:', url);
//     return false;
//   }
//   return paths.some(path => urlPath.startsWith(path));
// }

// /**
//  * Rewrites a URL to point to the backend.
//  */
// function rewriteUrlIfNeeded(url) {
//   if (isBackendRequest(url)) {
//     const urlObj = new URL(url);
//     const rewrittenUrl = `${BACKEND_URL}${urlObj.pathname}${urlObj.search}`;
//     console.log('[SW] Rewriting URL:', url, 'to', rewrittenUrl);
//     return rewrittenUrl;
//   }
//   return url;
// }

// // INSTALL: Cache essential frontend assets.
// self.addEventListener('install', (event) => {
//   console.log('[SW] Install event triggered');
//   self.skipWaiting();
//   event.waitUntil(
//     caches.open(CACHE_NAME).then((cache) => {
//       console.log('[SW] Caching essential assets:', urlsToCache);
//       return cache.addAll(urlsToCache);
//     }).then(() => {
//       console.log('[SW] Caching completed successfully');
//     }).catch(err => {
//       console.error('[SW] Error during caching assets:', err);
//     })
//   );
// });

// // ACTIVATE: Clean up old caches and claim clients.
// self.addEventListener('activate', (event) => {
//   console.log('[SW] Activate event triggered');
//   event.waitUntil(
//     Promise.all([
//       caches.keys().then((cacheNames) => {
//         console.log('[SW] Found caches:', cacheNames);
//         return Promise.all(
//           cacheNames.map((cacheName) => {
//             if (cacheName !== CACHE_NAME) {
//               console.log('[SW] Deleting outdated cache:', cacheName);
//               return caches.delete(cacheName);
//             }
//           })
//         );
//       }),
//       self.clients.claim().then(() => {
//         console.log('[SW] Clients claimed');
//       })
//     ]).then(() => {
//       console.log('[SW] Activation completed successfully');
//     }).catch(err => {
//       console.error('[SW] Activation error:', err);
//     })
//   );
// });

// // FETCH: Handle requests by rewriting backend URLs or using cache-first strategy.
// self.addEventListener('fetch', (event) => {
//   const requestUrl = event.request.url;
//   console.log('[SW] Fetch event for:', requestUrl);

//   // Bypass SSE connections.
//   if (requestUrl.includes('subscribe=true')) {
//     console.log('[SW] SSE connection detected. Bypassing fetch handler for:', requestUrl);
//     return;
//   }
  
//   if (isBackendRequest(requestUrl)) {
//     const backendUrl = rewriteUrlIfNeeded(requestUrl);
//     event.respondWith(
//       fetch(backendUrl, {
//         method: event.request.method,
//         headers: event.request.headers,
//         body: event.request.method !== 'GET' ? event.request.clone().body : undefined,
//         mode: 'cors',
//         credentials: 'same-origin'
//       }).then(response => {
//         console.log('[SW] Fetched backend data successfully from:', backendUrl);
//         return response;
//       }).catch((error) => {
//         console.error('[SW] Backend fetch failed for:', backendUrl, 'Error:', error);
//         // For POST requests, queue data for background sync.
//         if (event.request.method === 'POST' && requestUrl.includes('/inputData')) {
//           return event.request.clone().json().then((data) => {
//             return queueDataForSync(data).then(() => {
//               return new Response(
//                 JSON.stringify({
//                   success: true,
//                   message: 'Data saved for sync when online'
//                 }),
//                 { headers: { 'Content-Type': 'application/json' } }
//               );
//             });
//           });
//         }
//         return new Response(
//           JSON.stringify({ error: 'Network error, please try again later' }),
//           { status: 503, headers: { 'Content-Type': 'application/json' } }
//         );
//       })
//     );
//     return;
//   }
  
//   // For other requests, use a cache-first strategy.
//   event.respondWith(
//     caches.match(event.request).then((response) => {
//       if (response) {
//         console.log('[SW] Serving from cache:', event.request.url);
//         return response;
//       }
//       console.log('[SW] Fetching from network:', event.request.url);
//       return fetch(event.request).then((networkResponse) => {
//         if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
//           console.log('[SW] Network response not cacheable for:', event.request.url);
//           return networkResponse;
//         }
//         const responseToCache = networkResponse.clone();
//         caches.open(CACHE_NAME).then((cache) => {
//           console.log('[SW] Caching new resource:', event.request.url);
//           cache.put(event.request, responseToCache);
//         });
//         return networkResponse;
//       }).catch((error) => {
//         console.error('[SW] Fetch error for:', event.request.url, 'Error:', error);
//         // Optionally, return a fallback response.
//       });
//     })
//   );
// });

// // IndexedDB helper: Open a database.
// function openDB(name, version, upgradeCallback) {
//   return new Promise((resolve, reject) => {
//     const request = indexedDB.open(name, version);
//     if (upgradeCallback) {
//       request.onupgradeneeded = (event) => {
//         console.log('[SW] Upgrading IndexedDB:', name);
//         upgradeCallback(event.target.result);
//       };
//     }
//     request.onsuccess = (event) => {
//       console.log('[SW] IndexedDB opened successfully:', name);
//       resolve(event.target.result);
//     };
//     request.onerror = (event) => {
//       console.error('[SW] IndexedDB error:', event.target.error);
//       reject(event.target.error);
//     };
//   });
// }

// // Queue data for background sync.
// async function queueDataForSync(data) {
//   console.log('[SW] Queueing data for background sync:', data);
//   try {
//     const db = await openDB('environmentalData', 1, (db) => {
//       if (!db.objectStoreNames.contains('outbox')) {
//         console.log('[SW] Creating "outbox" object store in IndexedDB');
//         db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
//       }
//     });
//     const tx = db.transaction('outbox', 'readwrite');
//     const store = tx.objectStore('outbox');
//     await store.add({ ...data, timestamp: new Date().toISOString() });
//     await tx.complete;
//     console.log('[SW] Data queued successfully for background sync');
//     return Promise.resolve();
//   } catch (error) {
//     console.error('[SW] Failed to queue data for sync:', error);
//     throw error;
//   }
// }

// // BACKGROUND SYNC: Process queued data when connectivity is restored.
// self.addEventListener('sync', (event) => {
//   console.log('[SW] Sync event received:', event.tag);
//   if (event.tag === 'sync-environmental-data') {
//     event.waitUntil(syncEnvironmentalData());
//   }
// });

// async function syncEnvironmentalData() {
//   console.log('[SW] Starting environmental data sync');
//   try {
//     const db = await openDB('environmentalData', 1);
//     const tx = db.transaction('outbox', 'readonly');
//     const store = tx.objectStore('outbox');
//     const offlineData = await store.getAll();
//     await tx.complete;
//     console.log('[SW] Retrieved', offlineData.length, 'items from outbox');

//     for (const data of offlineData) {
//       try {
//         console.log('[SW] Syncing data for ID:', data.id);
//         const response = await fetch(`${BACKEND_URL}/inputData`, {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify(data)
//         });
//         if (response.ok) {
//           const deleteTx = db.transaction('outbox', 'readwrite');
//           const deleteStore = deleteTx.objectStore('outbox');
//           await deleteStore.delete(data.id);
//           await deleteTx.complete;
//           console.log('[SW] Synced and deleted queued data for ID:', data.id);
//         } else {
//           console.warn('[SW] Failed to sync data for ID:', data.id);
//         }
//       } catch (error) {
//         console.error('[SW] Error syncing data for ID:', data.id, 'Error:', error);
//       }
//     }
//   } catch (error) {
//     console.error('[SW] Error accessing IndexedDB during sync:', error);
//   }
// }

// // PUSH EVENT: Handle incoming push notifications.
// self.addEventListener('push', (event) => {
//   console.log('[SW] Push event received:', event);
  
//   // Create default notification data
//   let notificationData = {
//     title: 'Environmental Alert',
//     body: 'New environmental alert detected!',
//     icon: '/icons/icon-192x192.png',
//     badge: '/icons/icon-72x72.png',
//     tag: 'environmental-alert',
//     data: { url: '/' },
//     requireInteraction: true  // Keeps notification visible on mobile
//   };
  
//   // Try to parse the payload
//   if (event.data) {
//     try {
//       const data = event.data.json();
//       console.log('[SW] Push payload parsed successfully:', data);
//       notificationData = { ...notificationData, ...data };
//     } catch (e) {
//       console.error('[SW] Error parsing push notification data:', e);
//     }
//   }
  
//   // Set vibration patterns based on danger level
//   if (notificationData.dangerLevel === 'extreme' || notificationData.dangerLevel === 'high') {
//     notificationData.vibrate = [100, 50, 100, 50, 100, 50, 200];
//   } else if (notificationData.dangerLevel === 'medium') {
//     notificationData.vibrate = [100, 50, 100];
//   } else {
//     notificationData.vibrate = [100];
//   }
  
//   // Ensure actions are present for mobile
//   if (!notificationData.actions) {
//     notificationData.actions = [
//       { action: 'view', title: 'View Details' }
//     ];
//   }
  
//   event.waitUntil(
//     self.registration.pushManager.permissionState({ userVisibleOnly: true })
//       .then(permissionState => {
//         console.log('[SW] Push permission state:', permissionState);
//         if (permissionState === 'granted') {
//           return self.registration.showNotification(notificationData.title, notificationData)
//             .then(() => {
//               console.log('[SW] Notification shown successfully:', notificationData.title);
//               return self.clients.matchAll({ type: 'window' })
//                 .then(clients => {
//                   clients.forEach(client => {
//                     client.postMessage({
//                       type: 'NOTIFICATION_SHOWN',
//                       notificationId: notificationData.tag
//                     });
//                   });
//                 });
//             })
//             .catch(err => {
//               console.error('[SW] Error showing notification:', err);
//               return self.registration.showNotification('Environmental Alert', {
//                 body: 'New alert detected in your area.',
//                 icon: '/icons/icon-192x192.png',
//                 vibrate: [100]
//               });
//             });
//         } else {
//           console.warn('[SW] Notification permission not granted');
//           return Promise.resolve();
//         }
//       })
//   );
// });

// // NOTIFICATION CLICK: Handle user clicks on notifications.
// self.addEventListener('notificationclick', (event) => {
//   console.log('[SW] Notification clicked:', event.notification.tag);
//   event.notification.close();
  
//   if (event.action === 'view') {
//     console.log('[SW] "View" action clicked on notification:', event.notification.tag);
//   }
  
//   event.waitUntil(
//     clients.matchAll({ type: 'window' }).then((clientList) => {
//       for (const client of clientList) {
//         if ('url' in client && client.url === (event.notification.data?.url || '/') && 'focus' in client) {
//           console.log('[SW] Focusing existing client for URL:', client.url);
//           return client.focus();
//         }
//       }
//       if (clients.openWindow) {
//         console.log('[SW] Opening new window for URL:', event.notification.data?.url || '/');
//         return clients.openWindow(event.notification.data?.url || '/');
//       }
//     })
//   );
// });

// // PERIODIC SYNC: Send a message to the client requesting location data.
// self.addEventListener('periodicsync', (event) => {
//   console.log('[SW] Periodic sync event received:', event.tag);
//   if (event.tag === 'environmental-check') {
//     event.waitUntil(performEnvironmentalCheck());
//   }
// });

// async function performEnvironmentalCheck() {
//   try {
//     const allClients = await self.clients.matchAll();
//     if (allClients.length > 0) {
//       console.log('[SW] Sending location request to client');
//       allClients[0].postMessage({ type: 'REQUEST_LOCATION' });
//     } else {
//       console.log('[SW] No active clients found for location request');
//     }
//   } catch (error) {
//     console.error('[SW] Error during periodic sync (environmental check):', error);
//   }
// }

// // Listen for messages from clients.
// self.addEventListener('message', (event) => {
//   console.log('[SW] Message received:', event.data?.type);
  
//   if (event.data && event.data.type === 'LOCATION_DATA') {
//     const { latitude, longitude } = event.data;
//     console.log('[SW] Received location data:', latitude, longitude);
//     checkDangerZones(latitude, longitude);
//   }
  
//   if (event.data && event.data.type === 'SUBSCRIPTION_SUCCESSFUL') {
//     console.log('[SW] Subscription successful message received');
//     self.clients.matchAll({ type: 'window' }).then(clients => {
//       clients.forEach(client => {
//         client.postMessage({
//           type: 'SUBSCRIPTION_STATE_UPDATE',
//           state: 'enabled'
//         });
//       });
//     });
//     if (event.data.userAgent && /Mobi|Android/i.test(event.data.userAgent)) {
//       self.registration.showNotification('Notifications Enabled', {
//         body: 'You will now receive environmental alerts',
//         icon: '/icons/icon-192x192.png',
//         badge: '/icons/icon-72x72.png',
//         tag: 'subscription-confirmation',
//         vibrate: [100, 50, 100],
//         requireInteraction: false,
//         data: { url: '/' }
//       }).then(() => {
//         console.log('[SW] Mobile test notification shown successfully for subscription confirmation');
//       }).catch(err => {
//         console.error('[SW] Failed to show mobile test notification:', err);
//       });
//     }
//   }
  
//   if (event.data && event.data.type === 'TEST_NOTIFICATION') {
//     console.log('[SW] Test notification requested');
//     self.registration.showNotification('Test Notification', {
//       body: 'This is a test notification from your environmental monitoring app',
//       icon: '/icons/icon-192x192.png',
//       badge: '/icons/icon-72x72.png',
//       tag: 'test-notification',
//       vibrate: [100, 50, 100],
//       requireInteraction: true,
//       data: { url: '/' },
//       actions: [
//         { action: 'view', title: 'View App' }
//       ]
//     }).then(() => {
//       event.source.postMessage({
//         type: 'NOTIFICATION_SHOWN',
//         notificationId: 'test-notification'
//       });
//       console.log('[SW] Test notification shown and client notified');
//     }).catch(err => {
//       console.error('[SW] Error showing test notification:', err);
//       event.source.postMessage({
//         type: 'NOTIFICATION_ERROR',
//         error: err.message || 'Unknown error'
//       });
//     });
//   }
  
//   if (event.data && event.data.type === 'SUBSCRIPTION_REMOVED') {
//     console.log('[SW] Subscription removal message received');
//     self.clients.matchAll({ type: 'window' }).then(clients => {
//       clients.forEach(client => {
//         client.postMessage({
//           type: 'SUBSCRIPTION_STATE_UPDATE',
//           state: 'disabled'
//         });
//       });
//     });
//   }
// });

// // Check danger zones given the user's location.
// async function checkDangerZones(latitude, longitude) {
//   console.log('[SW] Checking danger zones for location:', latitude, longitude);
//   try {
//     const response = await fetch(`${BACKEND_URL}/inputData`);
//     if (!response.ok) {
//       console.error('[SW] Failed to fetch danger zones data. Status:', response.status);
//       return;
//     }
//     const data = await response.json();
//     const dangerZones = data.dangerZones || [];
//     console.log('[SW] Received', dangerZones.length, 'danger zones');
    
//     for (const zone of dangerZones) {
//       const distance = calculateDistance(
//         latitude,
//         longitude,
//         zone.location.lat,
//         zone.location.lng
//       );
//       console.log(`[SW] Distance to zone ${zone.id}: ${distance} km`);
      
//       if (distance < 7) {
//         const notificationTitle = distance < 5
//           ? '⚠️ You are in a danger zone!'
//           : '⚡ You are approaching a danger zone';
//         const notificationBody = distance < 5
//           ? `You are currently inside a ${zone.dangerLevel} risk area. Take necessary precautions.`
//           : `You are ${Math.round(distance - 5)} km from a ${zone.dangerLevel} risk area. Be alert.`;
        
//         try {
//           await self.registration.showNotification(notificationTitle, {
//             body: notificationBody,
//             icon: '/icons/icon-192x192.png',
//             badge: '/icons/icon-72x72.png',
//             tag: `proximity-alert-${zone.id}`,
//             data: { url: '/', zoneId: zone.id },
//             vibrate: distance < 5 ? [100, 50, 100, 50, 200] : [100, 50, 100],
//             requireInteraction: true,
//             actions: [
//               { action: 'view', title: 'View Details' }
//             ]
//           });
//           console.log('[SW] Proximity notification shown successfully for zone:', zone.id);
//         } catch (err) {
//           console.error('[SW] Error showing proximity notification for zone:', zone.id, 'Error:', err);
//         }
//         // Only show one proximity notification per check.
//         break;
//       }
//     }
//   } catch (error) {
//     console.error('[SW] Error checking danger zones:', error);
//   }
// }

// /**
//  * Calculates the Haversine distance between two points (in km).
//  * @param {number} lat1 
//  * @param {number} lon1 
//  * @param {number} lat2 
//  * @param {number} lon2 
//  * @returns {number} Distance in kilometers.
//  */
// function calculateDistance(lat1, lon1, lat2, lon2) {
//   const R = 6371;
//   const dLat = deg2rad(lat2 - lat1);
//   const dLon = deg2rad(lon2 - lon1);
//   const a = Math.sin(dLat / 2) ** 2 +
//             Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
//             Math.sin(dLon / 2) ** 2;
//   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
//   return R * c;
// }

// /**
//  * Converts degrees to radians.
//  * @param {number} deg 
//  * @returns {number}
//  */
// function deg2rad(deg) {
//   return deg * (Math.PI / 180);
// }

// public/sw.js
self.addEventListener('install', () => {
    console.log('[SW] Install event.');
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event.');
    event.waitUntil(self.clients.claim());
  });
  
  self.addEventListener('fetch', () => {});
  
  