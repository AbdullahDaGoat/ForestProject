/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Settings,
  Info,
  MapPin
} from 'lucide-react';

// Paste your public VAPID key here
const SERVER_PUBLIC_KEY = "BFvwfwSPtFBlC6QOB8h2RcapVKbn0PL3Yxj4J96pQIwkWu4fWTjgqv1eJ9N8lfk4sMPVKZkt19BCI49kMuQcpns";
const BACKEND_URL = 'https://forestproject-backend-production.up.railway.app';

export default function PushNotificationSetup() {
  const [permission, setPermission] = useState<NotificationPermission | 'default'>('default');
  const [supported, setSupported] = useState(true);
  const [pushSubscription, setPushSubscription] = useState<PushSubscription | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | 'default'>('default');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [notificationRange, setNotificationRange] = useState<number>(2);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isPushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
      setSupported(isPushSupported);
      
      if (isPushSupported) {
        setPermission(Notification.permission);
        navigator.serviceWorker.ready.then(registration => {
          registration.pushManager.getSubscription().then(subscription => {
            setPushSubscription(subscription);
            // Optionally, notify your backend if the user is already subscribed.
          });
        });
      }
      
      if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' as PermissionName }).then(result => {
          setLocationPermission(result.state);
          result.onchange = function() {
            setLocationPermission(this.state);
          };
        });
      }
    }
  }, []);

  // Helper: Convert base64 string to Uint8Array
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
  
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
  
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Subscribe user to push notifications and send subscription to backend
  const subscribeToPush = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Request permission if not granted
      if (Notification.permission !== 'granted') {
        const permissionResult = await Notification.requestPermission();
        setPermission(permissionResult);
        if (permissionResult !== 'granted') {
          setError('Notification permission denied');
          setLoading(false);
          return;
        }
      }
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(SERVER_PUBLIC_KEY)
      });
      
      console.log('Push subscription:', JSON.stringify(subscription));
      setPushSubscription(subscription);

      // Send the subscription to your backend API
      await fetch(`${BACKEND_URL}/save-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
      
      // Optionally register periodic background sync if needed
      if ('periodicSync' in registration) {
        try {
          const status = await navigator.permissions.query({
            name: 'periodic-background-sync' as any
          });
          if (status.state === 'granted') {
            await (registration as any).periodicSync.register('environmental-check', {
              minInterval: 15 * 60 * 1000 // 15 minutes
            });
          }
        } catch (err) {
          console.warn('Periodic background sync not supported', err);
        }
      }
      
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to subscribe to push notifications:', err);
      setError(err.message || 'Failed to subscribe to push notifications');
      setLoading(false);
    }
  };

  // Unsubscribe user from push notifications
  const unsubscribeFromPush = async () => {
    try {
      setLoading(true);
      if (pushSubscription) {
        await pushSubscription.unsubscribe();
        setPushSubscription(null);
        const registration = await navigator.serviceWorker.ready;
        if ('periodicSync' in registration) {
          await (registration as any).periodicSync.unregister('environmental-check');
        }
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Failed to unsubscribe:', err);
      setError(err.message || 'Failed to unsubscribe');
      setLoading(false);
    }
  };

  const requestLocationPermission = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        position => {
          setLocationPermission('granted');
          console.log('Location permission granted');
        },
        error => {
          console.error('Location permission denied:', error);
          setLocationPermission('denied');
        }
      );
    }
  };

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setNotificationRange(value);
    localStorage.setItem('notificationRange', value.toString());
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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <h3 className="text-xl font-bold text-white flex items-center">
          <Bell className="mr-2 h-5 w-5" />
          Environmental Alert Settings
        </h3>
        <p className="text-blue-100 text-sm mt-1">
          Customize how and when you receive critical environmental alerts
        </p>
      </div>

      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Notification Permission Section */}
          <div className="border-b border-gray-100 pb-6">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Push Notifications</h4>
            
            {permission === 'granted' ? (
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">Notifications enabled</p>
                  <p className="text-green-700 text-sm mt-1">
                    You&apos;ll receive real-time alerts for environmental hazards.
                  </p>
                  
                  {pushSubscription ? (
                    <button
                      onClick={unsubscribeFromPush}
                      disabled={loading}
                      className="mt-3 text-sm font-medium text-red-600 hover:text-red-800 flex items-center"
                    >
                      {loading ? 'Unsubscribing...' : 'Disable notifications'}
                    </button>
                  ) : (
                    <button
                      onClick={subscribeToPush}
                      disabled={loading}
                      className="mt-3 bg-green-100 text-green-700 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-green-200 transition"
                    >
                      {loading ? 'Enabling...' : 'Enable push notifications'}
                    </button>
                  )}
                </div>
              </div>
            ) : permission === 'denied' ? (
              <div className="flex items-start space-x-3 bg-red-50 border border-red-100 rounded-lg p-4">
                <XCircle className="h-6 w-6 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800">Notifications blocked</p>
                  <p className="text-red-700 text-sm mt-1">
                    Please update your browser settings to enable environmental alerts.
                  </p>
                  <div className="mt-3">
                    <a 
                      href="#"
                      onClick={() => window.open('chrome://settings/content/notifications')}
                      className="text-red-600 text-sm font-medium underline hover:text-red-800"
                    >
                      Learn how to enable notifications
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-4">
                <div className="mt-1 bg-blue-100 p-2 rounded-full flex-shrink-0">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Receive critical alerts</p>
                  <p className="text-gray-600 text-sm mt-1">
                    Get notified about forest fires, air quality warnings, and other environmental hazards near your location.
                  </p>
                  <button
                    onClick={subscribeToPush}
                    disabled={loading}
                    className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow-sm"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center">
                        <Bell className="h-4 w-4 mr-1.5" />
                        Enable Alert Notifications
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Location Permission Section */}
          <div className="border-b border-gray-100 pb-6">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Location Access</h4>
            
            {locationPermission === 'granted' ? (
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">Location access enabled</p>
                  <p className="text-green-700 text-sm mt-1">
                    We can alert you about environmental hazards near your current location.
                  </p>
                </div>
              </div>
            ) : locationPermission === 'denied' ? (
              <div className="flex items-start space-x-3 bg-yellow-50 border border-yellow-100 rounded-lg p-4">
                <AlertTriangle className="h-6 w-6 text-yellow-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-800">Location access blocked</p>
                  <p className="text-yellow-700 text-sm mt-1">
                    Without location access, we can&apos;t send you alerts about hazards near you.
                  </p>
                  <div className="mt-3">
                    <a 
                      href="#"
                      onClick={() => window.open('chrome://settings/content/location')}
                      className="text-yellow-600 text-sm font-medium underline hover:text-yellow-800"
                    >
                      Update location settings
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start space-x-4">
                <div className="mt-1 bg-green-100 p-2 rounded-full flex-shrink-0">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Enable location access</p>
                  <p className="text-gray-600 text-sm mt-1">
                    This allows us to send you alerts about environmental hazards based on your current location.
                  </p>
                  <button
                    onClick={requestLocationPermission}
                    className="mt-3 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow-sm"
                  >
                    <span className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1.5" />
                      Enable Location Access
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Advanced Settings */}
          <div>
            <button
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center text-gray-700 font-medium hover:text-gray-900"
            >
              <Settings className="h-4 w-4 mr-1.5" />
              {showAdvancedOptions ? 'Hide advanced settings' : 'Show advanced settings'}
            </button>
            
            {showAdvancedOptions && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h5 className="font-medium text-gray-800 mb-3">Notification Range</h5>
                
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Choose how far from a danger zone you want to receive alerts:
                  </p>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={notificationRange}
                      onChange={handleRangeChange}
                      className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>
                  
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1km</span>
                    <span>2km</span>
                    <span>3km</span>
                    <span>4km</span>
                    <span>5km</span>
                  </div>
                  
                  <p className="text-sm font-medium text-gray-700 mt-2">
                    Current setting: Notify me when I&apos;m within {notificationRange}km of a danger zone border
                  </p>
                </div>
                
                <div className="mt-4 bg-blue-50 rounded-md p-3 flex items-start">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-sm text-blue-700">
                    More advanced settings like notification frequency and alert types will be available in a future update.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}