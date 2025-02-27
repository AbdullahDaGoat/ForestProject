'use client';
import dynamic from 'next/dynamic';

const MediaSessionManager = dynamic(
  () => import('@/components/MediaSessionManager'),
  { ssr: false }
);

export default MediaSessionManager;
