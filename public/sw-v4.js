// public/sw-v4.js (Clean, notification-only version)

const BACKEND_URL = 'https://forestproject-backend-production.up.railway.app';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
self.addEventListener('install', event => {
  console.log('[SW] Installed (v4)');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('[SW] Activated (v4)');
  event.waitUntil(self.clients.claim());
});

// Push Notification Handling
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      image: data.image,
      vibrate: data.vibrate || [100, 50, 100],
      actions: data.actions || [],
      tag: data.tag || 'environmental-alert',
      requireInteraction: data.requireInteraction !== false,
      timestamp: data.timestamp || Date.now(),
      silent: data.silent || false,
      data: data.data || { url: '/' },
      color: data.color || '#E53935'
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Environmental Alert', options)
    );
  }
});

// Notification Click Handling
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// Optional: Periodic sync for location checks
self.addEventListener('periodicsync', event => {
  if (event.tag === 'environmental-check') {
    event.waitUntil(requestLocationUpdate());
  }
});

// Request client location
async function requestLocationUpdate() {
  const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (allClients.length > 0) {
    allClients[0].postMessage({ type: 'REQUEST_LOCATION' });
  }
}

// Listen to client messages (for location responses)
self.addEventListener('message', event => {
  if (event.data?.type === 'LOCATION_DATA') {
    const { latitude, longitude } = event.data;
    checkDangerZones(latitude, longitude);
  }
});

// Check Danger Zones (no caching, real-time fetch)
async function checkDangerZones(lat, lng) {
  try {
    const response = await fetch(`${BACKEND_URL}/inputData`);
    if (!response.ok) return;
    const { dangerZones = [] } = await response.json();

    for (const zone of dangerZones) {
      const dist = calculateDistance(lat, lng, zone.location.lat, zone.location.lng);
      if (dist < 7) {
        const title = dist < 5 ? '⚠️ You are in a danger zone!' : '⚡ Approaching a danger zone';
        const body = dist < 5
          ? `Inside a ${zone.dangerLevel} risk area. Take precautions.`
          : `${Math.round(dist - 5)} km from ${zone.dangerLevel} risk area. Stay alert.`;

        await self.registration.showNotification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          vibrate: [100, 50, 100],
          requireInteraction: true,
          data: { url: '/' },
          tag: `zone-alert-${zone.id}`,
          actions: [{ action: 'view', title: 'View Details', icon: '/icons/view-icon.png' }]
        });
        break;
      }
    }
  } catch (err) {
    console.error('[SW] Danger zone check failed:', err);
  }
}

// Utility: Calculate distance (Haversine)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
