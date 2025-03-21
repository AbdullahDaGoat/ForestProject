'use client';

import { useEffect } from 'react';

export default function ServiceWorkerManager() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register(`/sw-v4.js?ts=${Date.now()}`, {
        updateViaCache: 'none'
      })
      .then((reg) => console.log('✅ SW-v4 Registered:', reg))
      .catch((err) => console.error('❌ SW-v4 Failed:', err));
    }
  }, []);

  return null; // Temporarily no UI needed for debugging
}
