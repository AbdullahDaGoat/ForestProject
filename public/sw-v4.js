// public/sw-v4.js
self.addEventListener('install', (event) => {
    console.log('[SW] Installed (v4)');
    self.skipWaiting();
  });
  
  self.addEventListener('activate', (event) => {
    console.log('[SW] Activated (v4)');
    event.waitUntil(self.clients.claim());
  });
  
  self.addEventListener('fetch', () => {});  