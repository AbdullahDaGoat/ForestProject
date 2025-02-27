import './globals.css';
import type { Metadata } from 'next';
// Import the client components
import MediaSessionManager from '@/components/MediaSessionManager.client';
import ServiceWorkerManagerClient from '@/components/ServiceWorkerManager.client';

export const metadata: Metadata = {
  title: 'Environmental Monitoring Dashboard',
  description: 'Real-time environmental monitoring from drone data',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/icons/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>
        {children}
        <MediaSessionManager />
        <ServiceWorkerManagerClient />
      </body>
    </html>
  );
}
