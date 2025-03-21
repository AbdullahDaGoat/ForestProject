'use client';

import { useEffect } from 'react';

export default function LocationManager() {
  useEffect(() => {
    // Listen for messages from the service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'REQUEST_LOCATION') {
          // Request location when the SW asks for it.
          // Note: Ideally this should be triggered by a user gesture,
          // so consider linking it to a button click if needed.
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords;
              // Send location data back to the service worker.
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'LOCATION_DATA',
                  latitude,
                  longitude
                });
              }
            },
            (error) => {
              console.error('Error getting location:', error);
            }
          );
        }
      });
    }
  }, []);

  return null;
}
