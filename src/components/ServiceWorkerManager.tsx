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
    } else {
      console.error('[SW Manager] Service workers not supported or insecure context.');
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      console.log('[SW Manager] Attempting to register SW...');
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW Manager] SW registered:', reg);
      setRegistration(reg);

      // Explicitly check if Service Worker becomes ready
      navigator.serviceWorker.ready
        .then((readyReg) => {
          console.log('[SW Manager] Service Worker is ready:', readyReg);
        })
        .catch((readyErr) => {
          console.error('[SW Manager] SW failed to become ready:', readyErr);
        });

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          console.log('[SW Manager] New SW found:', newWorker);
          newWorker.addEventListener('statechange', () => {
            console.log('[SW Manager] SW state changed:', newWorker.state);
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[SW Manager] Update available: waiting to activate.');
                setUpdateAvailable(true);
              } else {
                console.log('[SW Manager] SW installed for the first time.');
              }
            } else if (newWorker.state === 'activated') {
              console.log('[SW Manager] SW activated.');
            }
          });
        }
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW Manager] SW controller changed. Reloading page...');
        window.location.reload();
      });
    } catch (error) {
      console.error('[SW Manager] SW registration error:', error);
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
