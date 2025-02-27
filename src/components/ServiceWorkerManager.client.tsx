'use client';

import dynamic from 'next/dynamic';

const ServiceWorkerManager = dynamic(
  () => import('@/components/ServiceWorkerManager'),
  { ssr: false }
);

export default function ServiceWorkerManagerClient() {
  return <ServiceWorkerManager />;
}
