// components/ServiceWorkerManager.tsx
'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (
      'serviceWorker' in navigator &&
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
    ) {
      window.addEventListener('load', registerServiceWorker);
      return () => window.removeEventListener('load', registerServiceWorker);
    } else {
      console.error('[SW Manager] Service workers not supported or insecure context.');
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW Manager] Registered SW:', reg);
      setRegistration(reg);

      navigator.serviceWorker.ready.then((readyReg) => {
        console.log('[SW Manager] SW Ready:', readyReg);
      });

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[SW Manager] New SW state:', newWorker.state);
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[SW Manager] New SW installed and waiting to activate.');
              setUpdateAvailable(true);
            }
            if (newWorker.state === 'activated') {
              console.log('[SW Manager] SW Activated.');
            }
          });
        }
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW Manager] Controller changed, reloading...');
        window.location.reload();
      });
    } catch (error) {
      console.error('[SW Manager] SW registration failed:', error);
    }
  };

  const updateServiceWorker = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
    }
  };

  if (!updateAvailable) return null;

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
