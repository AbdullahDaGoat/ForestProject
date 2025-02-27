/* eslint-disable @next/next/no-img-element */
// components/MediaSessionManager.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { Info, X } from 'lucide-react';

interface MediaNotification {
  id: string;
  title: string;
  message: string;
  sourceIcon?: string;
  timestamp: Date;
  read: boolean;
}

export default function MediaSessionManager() {
  const [notifications, setNotifications] = useState<MediaNotification[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [currentNotification, setCurrentNotification] = useState<MediaNotification | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if Media Session API is supported
    if ('mediaSession' in navigator) {
      setupMediaSession();
    }
    // Remove mock/demo notification code for production
    // (Real notifications will come via push or server events.)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show next unread notification when current one is dismissed
  useEffect(() => {
    if (!showNotification) {
      const nextUnread = notifications.find(n => !n.read);
      if (nextUnread) {
        setCurrentNotification(nextUnread);
        setShowNotification(true);
        
        // Auto-dismiss after 8 seconds
        timerRef.current = setTimeout(() => {
          dismissNotification(nextUnread.id);
        }, 8000);
      }
    }
  }, [showNotification, notifications]);

  const setupMediaSession = () => {
    // Set default metadata (you can update this as new data comes in)
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Environmental Monitoring',
      artist: 'Forest Guard',
      album: 'Environmental Updates',
      artwork: [
        { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
        { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
      ]
    });

    // Set up action handlers for media session
    navigator.mediaSession.setActionHandler('play', () => {
      const latestNotification = notifications[0];
      if (latestNotification) {
        setCurrentNotification(latestNotification);
        setShowNotification(true);
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      setShowNotification(false);
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const currentIndex = notifications.findIndex(n => n.id === currentNotification?.id);
      if (currentIndex > 0) {
        setCurrentNotification(notifications[currentIndex - 1]);
        setShowNotification(true);
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      const currentIndex = notifications.findIndex(n => n.id === currentNotification?.id);
      if (currentIndex < notifications.length - 1) {
        setCurrentNotification(notifications[currentIndex + 1]);
        setShowNotification(true);
      }
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const addMediaNotification = ({ title, message, sourceIcon }: { title: string, message: string, sourceIcon?: string }) => {
    const newNotification: MediaNotification = {
      id: `notification-${Date.now()}`,
      title,
      message,
      sourceIcon: sourceIcon || '/icons/icon-96x96.png',
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Update media session metadata
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: message,
        album: 'Environmental Updates',
        artwork: [
          { src: sourceIcon || '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }
        ]
      });
    }

    if (!showNotification) {
      setCurrentNotification(newNotification);
      setShowNotification(true);
      timerRef.current = setTimeout(() => {
        dismissNotification(newNotification.id);
      }, 8000);
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
    setShowNotification(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  if (!showNotification || !currentNotification) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center space-x-2">
          <img 
            src={currentNotification.sourceIcon} 
            alt="Notification Source" 
            className="w-6 h-6"
          />
          <h3 className="font-medium text-blue-800">{currentNotification.title}</h3>
        </div>
        <button 
          onClick={() => dismissNotification(currentNotification.id)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-gray-700">{currentNotification.message}</p>
            <p className="text-xs text-gray-500 mt-1">
              {currentNotification.timestamp.toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
