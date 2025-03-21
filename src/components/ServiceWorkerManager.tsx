// components/ServiceWorkerManager.tsx
'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check that service workers are supported and we're in a secure context.
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      // Wait until the window loads before registering the service worker.
      window.addEventListener('load', registerServiceWorker);
      // Clean up the event listener when unmounting.
      return () => {
        window.removeEventListener('load', registerServiceWorker);
      };
    } else {
      console.error('Service workers are not supported or the page is not in a secure context.');
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      // Register the service worker after the page has fully loaded.
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered successfully', reg);
      setRegistration(reg);

      // Listen for updates.
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        }
      });

      // Listen for a controller change (i.e., when a new service worker takes over).
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  };

  const updateServiceWorker = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
    }
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center">
      <span>Update available!</span>
      <button
        onClick={updateServiceWorker}
        className="ml-3 bg-white text-blue-600 px-3 py-1 rounded-md text-sm font-medium"
      >
        Refresh
      </button>
    </div>
  );
}
