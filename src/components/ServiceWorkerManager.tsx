// components/ServiceWorkerManager.tsx
'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
      window.addEventListener('load', registerServiceWorker);
      return () => window.removeEventListener('load', registerServiceWorker);
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('Service worker registered successfully', reg);
      setRegistration(reg);

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
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
    }
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center">
      <span>Update available!</span>
      <button onClick={updateServiceWorker} className="ml-3 bg-white text-blue-600 px-3 py-1 rounded-md text-sm font-medium">
        Refresh
      </button>
    </div>
  );
}
