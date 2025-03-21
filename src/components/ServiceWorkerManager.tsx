'use client';

import { useEffect } from 'react';

export default function ServiceWorkerManager() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          console.log('[SW Manager] Registered:', reg);

          return navigator.serviceWorker.ready;
        })
        .then(readyReg => {
          console.log('[SW Manager] SW is ready!', readyReg);
        })
        .catch(err => {
          console.error('[SW Manager] SW registration failed:', err);
        });
    } else {
      console.error('[SW Manager] SW unsupported');
    }
  }, []);

  return null;
}
