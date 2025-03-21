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
      // ✅ Cache-busting with timestamp query parameter to bypass cached versions
      const reg = await navigator.serviceWorker.register(`/sw-v3.js?ts=${Date.now()}`, {
        updateViaCache: 'none' // Forces a fresh fetch instead of cached file
      });

      console.log('✅ Service worker registered successfully:', reg);
      setRegistration(reg);

      // ✅ Detect new service worker installation
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('⚠️ New service worker available');
              setUpdateAvailable(true);
            }
          });
        }
      });

      // ✅ Handle auto-reload when new service worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('🔄 New service worker activated — Reloading page...');
          window.location.reload();
        }
      });
    } catch (error) {
      console.error('❌ Service worker registration failed:', error);
    }
  };

  const updateServiceWorker = () => {
    if (registration?.waiting) {
      console.log('🔄 Sending SKIP_WAITING message to service worker...');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
    }
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center">
      <span>🔔 Update available!</span>
      <button
        onClick={updateServiceWorker}
        className="ml-3 bg-white text-blue-600 px-3 py-1 rounded-md text-sm font-medium"
      >
        Refresh  
      </button>
    </div>
  );
}
