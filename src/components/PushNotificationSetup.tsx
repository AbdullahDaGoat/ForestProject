'use client';

import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function PushNotificationSetup() {
  const [permission, setPermission] = useState<NotificationPermission | 'default'>('default');
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // Ensure this logic runs only in the client-side
    if (typeof window !== 'undefined' && 'Notification' in window) {
      // Check if notifications are supported
      setSupported(true);
      // Get current permission status
      setPermission(Notification.permission);
    } else {
      setSupported(false);
    }
  }, []);

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Show a test notification
        new Notification('Forest Fire Alert System', {
          body: 'You will now receive alerts when forest fires are detected near you.',
          icon: '/icons/icon-192x192.png',
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  if (!supported) {
    return (
      <div className="flex items-center space-x-3 bg-amber-50 border border-amber-200 text-amber-800 px-6 py-4 rounded-lg shadow-sm">
        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <p className="font-medium">Push notifications are not supported in your browser.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <Bell className="mr-2 h-5 w-5" />
          Forest Fire Alerts
        </h3>
      </div>

      <div className="p-6">
        {permission === 'granted' ? (
          <div className="flex items-start space-x-3 bg-green-50 border border-green-100 rounded-lg p-4">
            <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-800">Notifications enabled</p>
              <p className="text-green-700 text-sm mt-1">
                You&apos;ll receive real-time alerts when forest fires are detected in your area.
              </p>
            </div>
          </div>
        ) : permission === 'denied' ? (
          <div className="flex items-start space-x-3 bg-red-50 border border-red-100 rounded-lg p-4">
            <XCircle className="h-6 w-6 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Notifications blocked</p>
              <p className="text-red-700 text-sm mt-1">Please update your browser settings to enable forest fire alerts.</p>
              <div className="mt-3">
                <a href="#" className="text-red-600 text-sm font-medium underline hover:text-red-800">
                  Learn how to enable notifications
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="mt-1 mr-4 bg-amber-100 p-3 rounded-full flex-shrink-0">
                <Bell className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 mb-1">Stay informed about forest fires</p>
                <p className="text-gray-600">Receive timely alerts when forest fires are detected near your location, helping you stay safe and prepared.</p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">Critical alerts</span> will be sent to your device
                </div>
                <button
                  onClick={requestPermission}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition duration-150 ease-in-out flex items-center"
                >
                  <Bell className="h-4 w-4 mr-1.5" />
                  Enable Alerts
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}